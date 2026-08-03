/**
 * Pure ad-unit-id resolution, extracted from `adUnitIds.ts` so the
 * "TestFlight uses test ads" / "production never uses test IDs when test
 * mode is false" guarantees are unit-testable without importing
 * `react-native` (Platform), which cannot run under a plain Node/tsx
 * process. `adUnitIds.ts` is a thin wrapper around this that supplies the
 * real `Platform.OS` and `process.env` values.
 */

export type AdSupportedPlatform = 'ios' | 'android';

export function resolveAdUnitId(input: {
  platform: AdSupportedPlatform;
  isTestModeForced: boolean;
  configuredValue: string;
  testValue: string;
}): string {
  if (input.isTestModeForced) {
    return input.testValue;
  }
  return input.configuredValue || input.testValue;
}

export function isTestAdUnit(
  unitId: string | null,
  testIds: readonly string[],
): boolean {
  return unitId != null && testIds.includes(unitId);
}
