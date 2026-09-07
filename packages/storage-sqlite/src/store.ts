import { fileURLToPath } from 'node:url';

import type { CanonicalPart, ResultSnapshot } from '@pcpartcheck/core';
import type { FieldEvidenceRecord, RawFieldEvidence } from '@pcpartcheck/evidence';
import type { ExternalMapping } from '@pcpartcheck/identity';
import Database from 'better-sqlite3';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import {
  canonicalParts,
  externalMappings,
  fieldEvidence,
  rawEvidence,
  resultSnapshots,
} from './schema.js';

export interface OpenSqliteStoreOptions {
  readonly filename: string;
  readonly migrationsFolder?: string;
}

export interface SqliteStore {
  close(): void;
  putCanonicalPart(part: CanonicalPart): void;
  getCanonicalPart(partId: string): CanonicalPart | undefined;
  putExternalMapping(mapping: ExternalMapping): void;
  findExternalMapping(source: string, externalId: string): ExternalMapping | undefined;
  putRawEvidence(evidence: RawFieldEvidence): void;
  getRawEvidence(evidenceId: string): RawFieldEvidence | undefined;
  putFieldEvidence(evidence: FieldEvidenceRecord): void;
  getFieldEvidence(evidenceId: string): FieldEvidenceRecord | undefined;
  putResultSnapshot(snapshotId: string, snapshot: ResultSnapshot): void;
  getResultSnapshot(snapshotId: string): ResultSnapshot | undefined;
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function openSqliteStore(options: OpenSqliteStoreOptions): SqliteStore {
  const sqlite = new Database(options.filename);
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite);
  migrate(database, {
    migrationsFolder:
      options.migrationsFolder ??
      fileURLToPath(new URL('../drizzle', import.meta.url)),
  });

  return {
    close: () => sqlite.close(),
    putCanonicalPart: (part) => {
      database
        .insert(canonicalParts)
        .values({
          partId: part.partId,
          schemaVersion: part.schemaVersion,
          category: part.category,
          manufacturer: part.manufacturer,
          model: part.model,
          payloadJson: JSON.stringify(part),
        })
        .onConflictDoUpdate({
          target: canonicalParts.partId,
          set: {
            schemaVersion: part.schemaVersion,
            category: part.category,
            manufacturer: part.manufacturer,
            model: part.model,
            payloadJson: JSON.stringify(part),
          },
        })
        .run();
    },
    getCanonicalPart: (partId) => {
      const row = database
        .select({ payloadJson: canonicalParts.payloadJson })
        .from(canonicalParts)
        .where(eq(canonicalParts.partId, partId))
        .get();
      return row ? parseJson<CanonicalPart>(row.payloadJson) : undefined;
    },
    putExternalMapping: (mapping) => {
      const existing = database
        .select({ partId: externalMappings.partId })
        .from(externalMappings)
        .where(
          and(
            eq(externalMappings.source, mapping.source),
            eq(externalMappings.externalId, mapping.externalId),
          ),
        )
        .get();
      if (existing && existing.partId !== mapping.partId) {
        throw new Error('External mapping cannot change canonical part');
      }
      database
        .insert(externalMappings)
        .values(mapping)
        .onConflictDoUpdate({
          target: [externalMappings.source, externalMappings.externalId],
          set: {
            rawName: mapping.rawName,
            matchMethod: mapping.matchMethod,
            confidence: mapping.confidence,
            status: mapping.status,
            matchedAt: mapping.matchedAt,
            mapperVersion: mapping.mapperVersion,
          },
        })
        .run();
    },
    findExternalMapping: (source, externalId) =>
      database
        .select()
        .from(externalMappings)
        .where(
          and(
            eq(externalMappings.source, source),
            eq(externalMappings.externalId, externalId),
          ),
        )
        .get() as ExternalMapping | undefined,
    putRawEvidence: (evidence) => {
      database
        .insert(rawEvidence)
        .values({
          evidenceId: evidence.evidenceId,
          fieldPath: evidence.fieldPath,
          payloadJson: JSON.stringify(evidence),
        })
        .onConflictDoUpdate({
          target: rawEvidence.evidenceId,
          set: {
            fieldPath: evidence.fieldPath,
            payloadJson: JSON.stringify(evidence),
          },
        })
        .run();
    },
    getRawEvidence: (evidenceId) => {
      const row = database
        .select({ payloadJson: rawEvidence.payloadJson })
        .from(rawEvidence)
        .where(eq(rawEvidence.evidenceId, evidenceId))
        .get();
      return row ? parseJson<RawFieldEvidence>(row.payloadJson) : undefined;
    },
    putFieldEvidence: (evidence) => {
      database
        .insert(fieldEvidence)
        .values({
          evidenceId: evidence.evidenceId,
          issueType: evidence.issueType,
          status: evidence.status,
          payloadJson: JSON.stringify(evidence),
        })
        .onConflictDoUpdate({
          target: fieldEvidence.evidenceId,
          set: {
            issueType: evidence.issueType,
            status: evidence.status,
            payloadJson: JSON.stringify(evidence),
          },
        })
        .run();
    },
    getFieldEvidence: (evidenceId) => {
      const row = database
        .select({ payloadJson: fieldEvidence.payloadJson })
        .from(fieldEvidence)
        .where(eq(fieldEvidence.evidenceId, evidenceId))
        .get();
      return row ? parseJson<FieldEvidenceRecord>(row.payloadJson) : undefined;
    },
    putResultSnapshot: (snapshotId, snapshot) => {
      database
        .insert(resultSnapshots)
        .values({
          snapshotId,
          checkedAt: snapshot.checkedAt,
          canonicalSchemaVersion: snapshot.canonicalSchemaVersion,
          payloadJson: JSON.stringify(snapshot),
        })
        .onConflictDoUpdate({
          target: resultSnapshots.snapshotId,
          set: {
            checkedAt: snapshot.checkedAt,
            canonicalSchemaVersion: snapshot.canonicalSchemaVersion,
            payloadJson: JSON.stringify(snapshot),
          },
        })
        .run();
    },
    getResultSnapshot: (snapshotId) => {
      const row = database
        .select({ payloadJson: resultSnapshots.payloadJson })
        .from(resultSnapshots)
        .where(eq(resultSnapshots.snapshotId, snapshotId))
        .get();
      return row ? parseJson<ResultSnapshot>(row.payloadJson) : undefined;
    },
  };
}
