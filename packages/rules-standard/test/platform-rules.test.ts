import type { EngineRule } from '@pcpartcheck/core';
import { describe, expect, test } from 'vitest';

import * as rules from '../src/index.js';
import { context, cpu, memory, motherboard, pcCase } from './fixtures.js';

function exportedRule(name: string): EngineRule {
  const candidate = (rules as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as EngineRule;
}

describe('cpuSocketRule', () => {
  test('rejects AM5 CPU with LGA1851 motherboard', async () => {
    const result = await exportedRule('cpuSocketRule').evaluate(
      context([cpu('AM5'), motherboard({ socket: 'LGA1851' })], 'socket'),
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });

  test('returns unknown when a required part is missing', async () => {
    const result = await exportedRule('cpuSocketRule').evaluate(
      context([motherboard()], 'socket'),
    );

    expect(result.status).toBe('UNKNOWN');
  });

  test('passes matching sockets', async () => {
    const result = await exportedRule('cpuSocketRule').evaluate(
      context([cpu(), motherboard()], 'socket'),
    );

    expect(result.status).toBe('PASS');
  });
});

describe('memoryGenerationRule', () => {
  test('rejects DDR4 memory with a DDR5-only motherboard', async () => {
    const result = await exportedRule('memoryGenerationRule').evaluate(
      context([memory('DDR4'), motherboard()], 'memory-generation'),
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });

  test('passes a supported memory generation', async () => {
    const result = await exportedRule('memoryGenerationRule').evaluate(
      context([memory('DDR5'), motherboard()], 'memory-generation'),
    );

    expect(result.status).toBe('PASS');
  });
});

describe('memoryCapacityRule', () => {
  test('rejects module count above available slots', async () => {
    const result = await exportedRule('memoryCapacityRule').evaluate(
      context(
        [memory('DDR5', 4, 16), motherboard({ memorySlots: 2, maxMemoryGb: 64 })],
        'memory-capacity',
      ),
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });

  test('returns unknown when motherboard limits are absent', async () => {
    const result = await exportedRule('memoryCapacityRule').evaluate(
      context([memory(), motherboard()], 'memory-capacity'),
    );

    expect(result.status).toBe('UNKNOWN');
  });
});

describe('motherboardFormFactorRule', () => {
  test('rejects ATX motherboard in a Mini-ITX-only case', async () => {
    const result = await exportedRule('motherboardFormFactorRule').evaluate(
      context([motherboard({ formFactor: 'ATX' }), pcCase(['MINI_ITX'])], 'form-factor'),
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });

  test('passes a supported motherboard form factor', async () => {
    const result = await exportedRule('motherboardFormFactorRule').evaluate(
      context([motherboard({ formFactor: 'ATX' }), pcCase(['ATX'])], 'form-factor'),
    );

    expect(result.status).toBe('PASS');
  });
});
