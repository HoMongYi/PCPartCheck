import { expect, test } from 'vitest';

import * as core from '../src/index.js';

type Upgrade = (value: unknown) => unknown;

function exportedUpgrade(name: string): Upgrade {
  const candidate = (core as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeTypeOf('function');
  return candidate as Upgrade;
}

const legacyPsu = {
  schemaVersion: '3.0.0',
  partId: '55555555-5555-4555-8555-555555555555',
  category: 'PSU',
  manufacturer: 'Example',
  model: 'Legacy PSU',
  status: 'ACTIVE',
  spec: { formFactor: 'ATX', ratedPowerW: 850 },
} as const;

const legacyContext = {
  schemaVersion: '2.0.0',
  installedBiosVersion: 'F12',
} as const;

test('v3 PSU and v2 context upgrade only their version literals', () => {
  const upgradePart = exportedUpgrade('upgradeCanonicalPart3To3_1');
  const upgradeContext = exportedUpgrade('upgradeInstallationContext2To2_1');

  expect(upgradePart(legacyPsu)).toEqual({
    ...legacyPsu,
    schemaVersion: '3.1.0',
  });
  expect(upgradeContext(legacyContext)).toEqual({
    ...legacyContext,
    schemaVersion: '2.1.0',
  });
  expect(legacyPsu.schemaVersion).toBe('3.0.0');
  expect(legacyContext.schemaVersion).toBe('2.0.0');
});

test('v3 build upgrade changes only canonical version literals', () => {
  const upgradeBuild = exportedUpgrade('upgradeCanonicalBuild3To3_1');
  const legacyBuild = { schemaVersion: '3.0.0', parts: [legacyPsu] } as const;

  expect(upgradeBuild(legacyBuild)).toEqual({
    schemaVersion: '3.1.0',
    parts: [{ ...legacyPsu, schemaVersion: '3.1.0' }],
  });
  expect(legacyBuild.parts[0]?.schemaVersion).toBe('3.0.0');
});

test('contract upgrades reject non-legacy versions and invalid values', () => {
  const upgradePart = exportedUpgrade('upgradeCanonicalPart3To3_1');
  const upgradeContext = exportedUpgrade('upgradeInstallationContext2To2_1');

  expect(() =>
    upgradePart({ ...legacyPsu, schemaVersion: '3.1.0' }),
  ).toThrow('Expected canonical schema version 3.0.0');
  expect(() =>
    upgradeContext({ ...legacyContext, unexpected: true }),
  ).toThrow('Invalid installation context 2.0.0');
});

test('canonical upgrade rejects facts that were not valid in version 3', () => {
  const upgradePart = exportedUpgrade('upgradeCanonicalPart3To3_1');

  expect(() =>
    upgradePart({
      ...legacyPsu,
      spec: { ratedPowerW: legacyPsu.spec.ratedPowerW },
    }),
  ).toThrow('Invalid canonical part 3.0.0');
});

test('context upgrade rejects facts that were not valid in version 2', () => {
  const upgradeContext = exportedUpgrade('upgradeInstallationContext2To2_1');

  expect(() =>
    upgradeContext({
      ...legacyContext,
      componentRevisions: [
        {
          partId: '22222222-2222-4222-8222-222222222222',
          hardwareRevision: '1.0',
        },
      ],
    }),
  ).toThrow('Invalid installation context 2.0.0');
});
