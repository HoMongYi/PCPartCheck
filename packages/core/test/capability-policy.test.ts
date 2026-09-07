import { Value } from '@sinclair/typebox/value';
import type { TSchema } from '@sinclair/typebox';
import { expect, test } from 'vitest';

import * as core from '../src/index.js';

function exportedSchema(name: string): TSchema {
  const candidate = (core as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as TSchema;
}

test('capability policy accepts one mode and rejects the legacy flags', () => {
  const schema = exportedSchema('CapabilityPolicySchema');

  expect(
    Value.Check(schema, {
      capabilityId: 'socket',
      mode: 'REQUIRED',
    }),
  ).toBe(true);
  expect(
    Value.Check(schema, {
      capabilityId: 'socket',
      enabled: true,
      requirement: 'REQUIRED',
    }),
  ).toBe(false);
});

test('unlisted capabilities resolve to disabled without scattered flags', () => {
  const resolver = (core as Readonly<Record<string, unknown>>)
    .resolveCapabilityPolicy;
  expect(resolver).toBeTypeOf('function');

  const policy = (
    resolver as (
      profile: Readonly<Record<string, unknown>>,
      capabilityId: string,
    ) => Readonly<Record<string, unknown>>
  )(
    {
      profileId: 'quick-check',
      policyVersion: '1.0.0',
      capabilities: [
        { capabilityId: 'socket', mode: 'REQUIRED' },
        { capabilityId: 'qvl', mode: 'DISABLED' },
      ],
    },
    'bios',
  );

  expect(policy).toEqual({ capabilityId: 'bios', mode: 'DISABLED' });
});

test('capability registry rejects duplicate identifiers', () => {
  const factory = (core as Readonly<Record<string, unknown>>)
    .createCapabilityRegistry;
  expect(factory).toBeTypeOf('function');

  expect(() =>
    (
      factory as (definitions: readonly unknown[]) => unknown
    )([
      { capabilityId: 'socket', title: 'Socket' },
      { capabilityId: 'socket', title: 'Duplicate socket' },
    ]),
  ).toThrow('Duplicate capabilityId: socket');
});
