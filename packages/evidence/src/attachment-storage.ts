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

export function createMemoryAttachmentStorageProvider(): AttachmentStorageProvider {
  const attachments = new Map<string, StoredAttachment>();
  return {
    put: async (attachment) => {
      if (!Value.Check(AttachmentReferenceSchema, attachment.reference)) {
        throw new TypeError('Attachment reference does not match its public schema');
      }
      if (
        attachment.reference.sizeBytes !== undefined &&
        attachment.reference.sizeBytes !== attachment.data.byteLength
      ) {
        throw new RangeError('Attachment byte length does not match sizeBytes');
      }
      attachments.set(
        attachment.reference.attachmentId,
        cloneAttachment(attachment),
      );
    },
    get: async (attachmentId) => {
      const attachment = attachments.get(attachmentId);
      return attachment ? cloneAttachment(attachment) : undefined;
    },
    delete: async (attachmentId) => attachments.delete(attachmentId),
  };
}
