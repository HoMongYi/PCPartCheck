import { describe, expect, test } from 'vitest';

import * as evidence from '../src/index.js';

interface StoredAttachment {
  readonly reference: Readonly<Record<string, unknown>>;
  readonly data: Uint8Array;
}

interface AttachmentStorage {
  put(attachment: StoredAttachment): Promise<void>;
  get(attachmentId: string): Promise<StoredAttachment | undefined>;
  delete(attachmentId: string): Promise<boolean>;
}

test('memory attachment storage round-trips bytes without exposing a filesystem', async () => {
  const create = (evidence as Readonly<Record<string, unknown>>)
    .createMemoryAttachmentStorageProvider;
  expect(create).toBeTypeOf('function');
  const storage = (create as () => AttachmentStorage)();
  const attachment = {
    reference: {
      attachmentId: 'demo-photo-1',
      mediaType: 'image/png',
      checksum: `sha256:${'a'.repeat(64)}`,
      sizeBytes: 4,
      storageKey: 'memory:demo-photo-1',
      description: '합성 데모 사진',
      capturedAt: '2026-09-09T00:00:00.000Z',
    },
    data: new Uint8Array([1, 2, 3, 4]),
  };

  await storage.put(attachment);
  const loaded = await storage.get('demo-photo-1');
  expect(loaded).toEqual(attachment);
  loaded?.data.fill(0);
  expect(await storage.get('demo-photo-1')).toEqual(attachment);
  await expect(storage.delete('demo-photo-1')).resolves.toBe(true);
  await expect(storage.get('demo-photo-1')).resolves.toBeUndefined();
});

describe('AttachmentReference schema', () => {
  test('accepts an opaque reference and rejects a malformed checksum', async () => {
    const { Value } = await import('@sinclair/typebox/value');
    const schema = (evidence as Readonly<Record<string, unknown>>)
      .AttachmentReferenceSchema as Parameters<typeof Value.Check>[0];
    const reference = {
      attachmentId: 'demo-photo-1',
      mediaType: 'image/png',
      checksum: `sha256:${'a'.repeat(64)}`,
      storageKey: 'memory:demo-photo-1',
    };

    expect(Value.Check(schema, reference)).toBe(true);
    expect(Value.Check(schema, { ...reference, checksum: 'abc' })).toBe(false);
  });
});
