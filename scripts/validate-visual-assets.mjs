#!/usr/bin/env -S npx tsx
/**
 * Version 1.2A — validates the visual asset manifest and theme registry.
 *
 * Run via `npm run validate:visual-assets` (invoked through `tsx` so it
 * can import the pure, RN-free TypeScript metadata/registry modules
 * directly — never the RN-facing `visualAssetManifest.ts`, which contains
 * `require('*.webp')` calls plain Node cannot resolve).
 *
 * Exits non-zero on any error-level finding so CI/local runs fail loudly
 * — missing required assets are never silently ignored.
 */
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { VISUAL_ASSET_METADATA } from '../src/assets/manifest/visualAssetManifestData.ts';
import {
  findDuplicateAssetIds,
  findMissingFallbackReferences,
} from '../src/assets/manifest/validateManifest.ts';
import { getAllThemeDefinitions } from '../src/themes/themeRegistry.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_TS_PATH = path.join(
  REPO_ROOT,
  'src/assets/manifest/visualAssetManifest.ts',
);

const SUPPORTED_EXTENSIONS = new Set(['.webp', '.png', '.jpg', '.jpeg']);
const MAX_ASSET_BYTES = 500 * 1024; // 500KB — see docs/V1_2_VISUAL_PERFORMANCE_BUDGET.md
const FILENAME_PATTERN = /^[a-z0-9][a-z0-9-]*\.[a-z0-9]+$/;

const errors = [];
const warnings = [];

function error(message) {
  errors.push(message);
}
function warn(message) {
  warnings.push(message);
}

// ---------------------------------------------------------------------------
// 1) Duplicate IDs / missing fallback IDs (shared pure logic — also unit
//    tested directly in src/themes/v1_2aVisualThemeSelfTest.ts).
// ---------------------------------------------------------------------------
for (const id of findDuplicateAssetIds(VISUAL_ASSET_METADATA)) {
  error(`Duplicate asset manifest id "${id}".`);
}
for (const { id, missingFallbackId } of findMissingFallbackReferences(VISUAL_ASSET_METADATA)) {
  error(`Asset "${id}" references fallbackAssetId "${missingFallbackId}", which does not exist in the manifest.`);
}

const idSet = new Set(VISUAL_ASSET_METADATA.map((entry) => entry.id));

// ---------------------------------------------------------------------------
// 2) Per-entry checks
// ---------------------------------------------------------------------------
for (const entry of VISUAL_ASSET_METADATA) {
  // Required dimensions exist for non-code-driven assets.
  if (!entry.isCodeDriven) {
    if (entry.width == null || entry.height == null) {
      error(`Asset "${entry.id}" is not code-driven but is missing width/height.`);
    }
  }

  if (entry.reducedMotionAlternativeAssetId != null && !idSet.has(entry.reducedMotionAlternativeAssetId)) {
    error(
      `Asset "${entry.id}" references reducedMotionAlternativeAssetId "${entry.reducedMotionAlternativeAssetId}", which does not exist in the manifest.`,
    );
  }

  if (entry.platformSupport.length === 0) {
    error(`Asset "${entry.id}" declares no supported platforms.`);
  }
}

// ---------------------------------------------------------------------------
// 3) Static require paths resolve (text-scan of the RN-facing manifest —
//    plain Node cannot `require()` a .webp/.png the way Metro can).
// ---------------------------------------------------------------------------
if (!existsSync(MANIFEST_TS_PATH)) {
  error(`Expected RN-facing manifest at ${MANIFEST_TS_PATH} — file not found.`);
} else {
  const manifestSource = await (await import('node:fs/promises')).readFile(MANIFEST_TS_PATH, 'utf8');
  const requireRegex = /(\w+):\s*require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const resolvedIds = new Set();
  let match;
  while ((match = requireRegex.exec(manifestSource)) !== null) {
    const [, assetKey, relativePath] = match;
    resolvedIds.add(assetKey);
    const absolutePath = path.resolve(path.dirname(MANIFEST_TS_PATH), relativePath);
    if (!existsSync(absolutePath)) {
      error(
        `Static require for "${assetKey}" points at "${relativePath}", which does not resolve to an existing file.`,
      );
      continue;
    }

    const ext = path.extname(absolutePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      error(`Asset "${assetKey}" (${relativePath}) uses an unsupported format "${ext}".`);
    }

    const filename = path.basename(absolutePath);
    if (!FILENAME_PATTERN.test(filename)) {
      warn(
        `Asset "${assetKey}" filename "${filename}" does not match the recommended lowercase-kebab-case convention (spaces/uppercase break iOS-safe, cross-platform filenames).`,
      );
    }

    const sizeBytes = statSync(absolutePath).size;
    if (sizeBytes > MAX_ASSET_BYTES) {
      warn(
        `Asset "${assetKey}" (${relativePath}) is ${(sizeBytes / 1024).toFixed(0)}KB, over the ${(MAX_ASSET_BYTES / 1024).toFixed(0)}KB guideline in docs/V1_2_VISUAL_PERFORMANCE_BUDGET.md.`,
      );
    }
  }

  // Every non-code-driven metadata entry must have a matching require in the RN manifest.
  for (const entry of VISUAL_ASSET_METADATA) {
    if (!entry.isCodeDriven && !resolvedIds.has(entry.id)) {
      error(
        `Asset "${entry.id}" is marked non-code-driven but has no matching require(...) entry in visualAssetManifest.ts.`,
      );
    }
  }
  // Every code-driven metadata entry must NOT have a require (would be dead weight / contradictory).
  for (const entry of VISUAL_ASSET_METADATA) {
    if (entry.isCodeDriven && resolvedIds.has(entry.id)) {
      warn(
        `Asset "${entry.id}" is marked isCodeDriven but also has a require(...) entry in visualAssetManifest.ts — remove one or the other.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 4) Every enabled theme definition has a valid, resolvable fallback chain.
// ---------------------------------------------------------------------------
const themeDefinitions = getAllThemeDefinitions();
const themeKey = (def) => `${def.category}:${def.themeId}`;
const themeIndex = new Map(themeDefinitions.map((def) => [themeKey(def), def]));

const themeIdCounts = new Map();
for (const def of themeDefinitions) {
  const key = themeKey(def);
  themeIdCounts.set(key, (themeIdCounts.get(key) ?? 0) + 1);
}
for (const [key, count] of themeIdCounts) {
  if (count > 1) {
    error(`Duplicate theme definition "${key}" (${count} occurrences).`);
  }
}

for (const def of themeDefinitions) {
  if (!def.isEnabled) {
    continue;
  }
  let hops = 0;
  let currentKey = themeKey(def);
  const visited = new Set();
  let resolvedOk = false;
  while (hops < 10) {
    if (visited.has(currentKey)) {
      break;
    }
    visited.add(currentKey);
    const current = themeIndex.get(currentKey);
    if (!current) {
      break;
    }
    if (current.fallbackThemeId === current.themeId) {
      resolvedOk = true; // reached a self-fallback (classic) root
      break;
    }
    currentKey = `${current.category}:${current.fallbackThemeId}`;
    hops += 1;
  }
  if (!resolvedOk) {
    error(
      `Theme "${def.themeId}" (${def.category}) does not terminate at a classic (self-fallback) definition within 10 hops.`,
    );
  }

  // Required assets referenced by an enabled theme must exist in the manifest.
  for (const assetId of def.requiredAssets) {
    if (!idSet.has(assetId)) {
      error(
        `Theme "${def.themeId}" (${def.category}) requires asset "${assetId}", which does not exist in the manifest.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log(
  `validate-visual-assets: ${VISUAL_ASSET_METADATA.length} manifest entries, ${themeDefinitions.length} theme definitions checked.`,
);

if (warnings.length > 0) {
  console.warn(`\n${warnings.length} warning(s):`);
  for (const warning of warnings) {
    console.warn(`  ⚠ ${warning}`);
  }
}

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s):`);
  for (const err of errors) {
    console.error(`  ✖ ${err}`);
  }
  console.error('\nvalidate-visual-assets FAILED.');
  process.exit(1);
}

console.log('\nvalidate-visual-assets PASSED.');
