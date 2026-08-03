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
  findThemesRequiringMissingAssets,
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
// 3b) Version 1.2B — duplicate require() targets, aspect-ratio risk,
//     "excessive transparent padding" heuristic, and unused-asset audit.
// ---------------------------------------------------------------------------
if (existsSync(MANIFEST_TS_PATH)) {
  const manifestSource = await (await import('node:fs/promises')).readFile(MANIFEST_TS_PATH, 'utf8');
  const requireRegex = /(\w+):\s*require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const pathToKeys = new Map();
  let match;
  while ((match = requireRegex.exec(manifestSource)) !== null) {
    const [, assetKey, relativePath] = match;
    const list = pathToKeys.get(relativePath) ?? [];
    list.push(assetKey);
    pathToKeys.set(relativePath, list);
  }
  for (const [relativePath, keys] of pathToKeys) {
    if (keys.length > 1) {
      warn(
        `Multiple asset ids (${keys.join(', ')}) require() the same file "${relativePath}" — confirm this aliasing is intentional.`,
      );
    }
  }
}

// Canonical portrait aspect-ratio bands — a real production asset well
// outside these bands is very likely mis-exported (wrong crop/orientation)
// even though it will still technically render.
const ASPECT_RATIO_BANDS = {
  card_back_texture: [0.55, 0.8], // matches the existing playing-card ratio (~0.6875)
  arena_background: [0.35, 0.65], // tall mobile portrait backgrounds
};

for (const entry of VISUAL_ASSET_METADATA) {
  const band = ASPECT_RATIO_BANDS[entry.type];
  if (!band || entry.aspectRatio == null) {
    continue;
  }
  const [min, max] = band;
  if (entry.aspectRatio < min || entry.aspectRatio > max) {
    warn(
      `Asset "${entry.id}" (${entry.type}) has aspect ratio ${entry.aspectRatio.toFixed(3)}, outside the expected ${min}-${max} band — confirm crop/orientation before shipping.`,
    );
  }
}

// Heuristic only (no image-decoding library in this Node script): a very
// low bytes-per-pixel ratio on a real production asset is a signal worth
// a human second look for excessive transparent padding, but is NOT proof
// on its own (aggressive lossless compression can also produce this).
if (existsSync(MANIFEST_TS_PATH)) {
  for (const entry of VISUAL_ASSET_METADATA) {
    if (entry.isCodeDriven || entry.width == null || entry.height == null) {
      continue;
    }
    const manifestSource = await (await import('node:fs/promises')).readFile(MANIFEST_TS_PATH, 'utf8');
    const keyMatch = manifestSource.match(
      new RegExp(`${entry.id}:\\s*require\\(\\s*['"]([^'"]+)['"]\\s*\\)`),
    );
    if (!keyMatch) {
      continue;
    }
    const absolutePath = path.resolve(path.dirname(MANIFEST_TS_PATH), keyMatch[1]);
    if (!existsSync(absolutePath)) {
      continue;
    }
    const sizeBytes = statSync(absolutePath).size;
    const bytesPerPixel = sizeBytes / (entry.width * entry.height);
    if (bytesPerPixel < 0.05) {
      warn(
        `Asset "${entry.id}" is ${bytesPerPixel.toFixed(3)} bytes/pixel — unusually low, which can indicate excessive transparent padding (or simply very effective compression); verify visually.`,
      );
    }
  }
}

// Unused-asset audit — an id that is neither required by any enabled
// theme definition, nor referenced as another asset's fallback /
// Reduced-Motion alternative, is dead weight in the bundle.
{
  const themeDefs = getAllThemeDefinitions();
  const referenced = new Set();
  for (const def of themeDefs) {
    for (const assetId of def.requiredAssets) {
      referenced.add(assetId);
    }
  }
  for (const entry of VISUAL_ASSET_METADATA) {
    if (entry.fallbackAssetId) referenced.add(entry.fallbackAssetId);
    if (entry.reducedMotionAlternativeAssetId) referenced.add(entry.reducedMotionAlternativeAssetId);
  }
  for (const entry of VISUAL_ASSET_METADATA) {
    if (!referenced.has(entry.id)) {
      warn(`Asset "${entry.id}" is not required by any enabled theme definition and is not a fallback target — appears unused.`);
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
}

// Required assets referenced by an enabled theme must exist in the manifest
// (shared helper — also exercised directly in the unit tests).
for (const missingRef of findThemesRequiringMissingAssets(themeDefinitions, VISUAL_ASSET_METADATA)) {
  error(
    `Theme "${missingRef.themeId}" (${missingRef.category}) requires asset "${missingRef.missingAssetId}", which does not exist in the manifest.`,
  );
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
