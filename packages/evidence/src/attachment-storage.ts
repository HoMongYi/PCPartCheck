import { createHash } from 'node:crypto';

import { AttachmentReferenceSchema, type AttachmentReference } from './field-evidence.js';
import { Value } from '@sinclair/typebox/value';

export interface StoredAttachment {
  readonly reference: AttachmentReference;
  readonly data: Uint8Array;
}

export interface AttachmentStorageProvider {
  put(attachment: StoredAttachment): Promise<void>;
  get(attachmentId: string): Promise<StoredAttachment | undefined>;
  delete(attachmentId: string): Promise<boolean>;
}

function cloneAttachment(attachment: StoredAttachment): StoredAttachment {
  return {
    reference: { ...attachment.reference },
    data: attachment.data.slice(),
  };
}

function assertAttachmentIntegrity(attachment: StoredAttachment): void {
  if (
    attachment.reference.sizeBytes !== undefined &&
    attachment.reference.sizeBytes !== attachment.data.byteLength
  ) {
    throw new RangeError('Attachment byte length does not match sizeBytes');
  }
  const actualChecksum = `sha256:${createHash('sha256')
    .update(attachment.data)
    .digest('hex')}`;
  if (actualChecksum !== attachment.reference.checksum) {
    throw new TypeError('Attachment bytes do not match the declared SHA-256 checksum');
  }
}

export function createMemoryAttachmentStorageProvider(): AttachmentStorageProvider {
  const attachments = new Map<string, StoredAttachment>();
  return {
    put: async (attachment) => {
      if (!Value.Check(AttachmentReferenceSchema, attachment.reference)) {
        throw new TypeError('Attachment reference does not match its public schema');
      }
      assertAttachmentIntegrity(attachment);
      attachments.set(
        attachment.reference.attachmentId,
        cloneAttachment(attachment),
      );
    },
    get: async (attachmentId) => {
      const attachment = attachments.get(attachmentId);
      if (!attachment) return undefined;
      assertAttachmentIntegrity(attachment);
      return cloneAttachment(attachment);
    },
    delete: async (attachmentId) => attachments.delete(attachmentId),
  };
}
