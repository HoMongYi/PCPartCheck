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

const bytes = new Uint8Array([1, 2, 3, 4]);
const bytesChecksum =
  'sha256:9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a';

function createStorage(): AttachmentStorage {
  const create = (evidence as Readonly<Record<string, unknown>>)
    .createMemoryAttachmentStorageProvider;
  expect(create).toBeTypeOf('function');
  return (create as () => AttachmentStorage)();
}

test('memory attachment storage round-trips bytes without exposing a filesystem', async () => {
  const storage = createStorage();
  const attachment = {
    reference: {
      attachmentId: 'demo-photo-1',
      mediaType: 'image/png',
      checksum: bytesChecksum,
      sizeBytes: 4,
      storageKey: 'memory:demo-photo-1',
      description: '합성 데모 사진',
      capturedAt: '2026-09-09T00:00:00.000Z',
    },
    data: bytes,
  };

  await storage.put(attachment);
  const loaded = await storage.get('demo-photo-1');
  expect(loaded).toEqual(attachment);
  loaded?.data.fill(0);
  expect(await storage.get('demo-photo-1')).toEqual(attachment);
  await expect(storage.delete('demo-photo-1')).resolves.toBe(true);
  await expect(storage.get('demo-photo-1')).resolves.toBeUndefined();
});

test('memory attachment storage rejects a checksum that does not match the bytes', async () => {
  const storage = createStorage();

  await expect(storage.put({
    reference: {
      attachmentId: 'bad-checksum',
      mediaType: 'image/png',
      checksum: `sha256:${'a'.repeat(64)}`,
      sizeBytes: 4,
      storageKey: 'memory:bad-checksum',
    },
    data: bytes,
  })).rejects.toBeInstanceOf(TypeError);
  await expect(storage.get('bad-checksum')).resolves.toBeUndefined();
});

test('memory attachment storage rejects a sizeBytes mismatch', async () => {
  const storage = createStorage();

  await expect(storage.put({
    reference: {
      attachmentId: 'bad-size',
      mediaType: 'image/png',
      checksum: bytesChecksum,
      sizeBytes: 5,
      storageKey: 'memory:bad-size',
    },
    data: bytes,
  })).rejects.toBeInstanceOf(RangeError);
  await expect(storage.get('bad-size')).resolves.toBeUndefined();
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
