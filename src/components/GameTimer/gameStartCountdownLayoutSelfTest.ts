import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '../../..');

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Self-test failed: ${message}`);
  }
}

export function runGameStartCountdownLayoutSelfTests(): void {
  const countdownSource = readFileSync(
    path.join(REPO_ROOT, 'src/components/GameTimer/GameStartCountdown.tsx'),
    'utf8',
  );
  const gameScreenSource = readFileSync(
    path.join(REPO_ROOT, 'src/screens/GameScreen.tsx'),
    'utf8',
  );

  assert(
    !countdownSource.includes('useWindowDimensions'),
    'GameStartCountdown must not use useWindowDimensions for layout',
  );
  assert(
    !countdownSource.includes('Dimensions.get'),
    'GameStartCountdown must not use Dimensions.get for layout',
  );
  assert(
    countdownSource.includes('countdownOverlay'),
    'GameStartCountdown uses board-relative countdownOverlay',
  );
  assert(
    countdownSource.includes('countdownCenter'),
    'GameStartCountdown uses fixed countdownCenter container',
  );
  assert(
    countdownSource.includes('countdownNumberLayer'),
    'GameStartCountdown centers number in countdownNumberLayer',
  );
  assert(
    countdownSource.includes('pointerEvents: \'none\''),
    'GameStartCountdown overlay must not block lane touches',
  );

  assert(
    gameScreenSource.includes('boardWrapper'),
    'GameScreen wraps lanes in boardWrapper',
  );
  assert(
    /boardWrapper[\s\S]*GameStartCountdown/.test(gameScreenSource),
    'GameStartCountdown is a child of boardWrapper',
  );
  assert(
    gameScreenSource.includes("position: 'relative'"),
    'boardWrapper uses position relative for overlay anchoring',
  );
}

if (import.meta.main) {
  runGameStartCountdownLayoutSelfTests();
  console.log('GameStartCountdown layout self-tests passed.');
}
