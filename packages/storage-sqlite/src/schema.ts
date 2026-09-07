import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const canonicalParts = sqliteTable('canonical_parts', {
  partId: text('part_id').primaryKey(),
  schemaVersion: text('schema_version').notNull(),
  category: text('category').notNull(),
  manufacturer: text('manufacturer').notNull(),
  model: text('model').notNull(),
  payloadJson: text('payload_json').notNull(),
});

export const externalMappings = sqliteTable(
  'external_mappings',
  {
    source: text('source').notNull(),
    externalId: text('external_id').notNull(),
    partId: text('part_id')
      .notNull()
      .references(() => canonicalParts.partId, { onDelete: 'restrict' }),
    rawName: text('raw_name').notNull(),
    matchMethod: text('match_method').notNull(),
    confidence: text('confidence').notNull(),
    status: text('status').notNull(),
    matchedAt: text('matched_at').notNull(),
    mapperVersion: text('mapper_version').notNull(),
  },
  (table) => [primaryKey({ columns: [table.source, table.externalId] })],
);

export const rawEvidence = sqliteTable('raw_evidence', {
  evidenceId: text('evidence_id').primaryKey(),
  fieldPath: text('field_path').notNull(),
  payloadJson: text('payload_json').notNull(),
});

export const fieldEvidence = sqliteTable('field_evidence', {
  evidenceId: text('evidence_id').primaryKey(),
  issueType: text('issue_type').notNull(),
  status: text('status').notNull(),
  payloadJson: text('payload_json').notNull(),
});

export const resultSnapshots = sqliteTable('result_snapshots', {
  snapshotId: text('snapshot_id').primaryKey(),
  checkedAt: text('checked_at').notNull(),
  canonicalSchemaVersion: text('canonical_schema_version').notNull(),
  payloadJson: text('payload_json').notNull(),
});
