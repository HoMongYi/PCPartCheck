import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

import type { JsonValue } from '@pcpartcheck/core';
import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv';
import addFormatsModule, { type FormatsPlugin } from 'ajv-formats';

import {
  BUILDCORES_PROVIDER_ID,
  BUILDCORES_SUPPORTED_CATEGORIES,
  BuildCoresSchemaFingerprintMismatchError,
  type BuildCoresSnapshot,
  type BuildCoresSnapshotRecord,
  type LoadBuildCoresSnapshotOptions,
} from './types.js';

interface SchemaFile {
  readonly relativePath: string;
  readonly bytes: Uint8Array;
}

function sortText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function readSchemaFiles(
  snapshotRoot: string,
  directory: string,
): Promise<readonly SchemaFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry): Promise<readonly SchemaFile[]> => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return readSchemaFiles(snapshotRoot, absolutePath);
    if (!entry.isFile()) return [];
    return [{
      relativePath: relative(snapshotRoot, absolutePath).replaceAll('\\', '/'),
      bytes: await readFile(absolutePath),
    }];
  }));
  return files.flat().sort((left, right) => sortText(left.relativePath, right.relativePath));
}

function portableSchemaBytes(bytes: Uint8Array): Uint8Array {
  return Buffer.from(
    Buffer.from(bytes).toString('utf8').replaceAll('\r\n', '\n').replaceAll('\r', '\n'),
    'utf8',
  );
}

function fingerprintSchemaFiles(files: readonly SchemaFile[]): string {
  const hash = createHash('sha256');
  for (const file of files) {
    const bytes = portableSchemaBytes(file.bytes);
    hash.update(
      `${Buffer.byteLength(file.relativePath)}\n${file.relativePath}\n${bytes.byteLength}\n`,
    );
    hash.update(bytes);
    hash.update('\n');
  }
  return `sha256:${hash.digest('hex')}`;
}

function sourceSchemaErrors(errors: readonly ErrorObject[] | null | undefined): readonly string[] {
  return (errors ?? []).map(
    ({ instancePath, keyword, message }) =>
      `${instancePath || '/'} ${keyword}: ${message ?? 'schema validation failed'}`,
  );
}

function compileSourceSchemas(
  files: readonly SchemaFile[],
): ReadonlyMap<string, ValidateFunction> {
  const byPath = new Map(files.map((file) => [file.relativePath, file]));
  const ajv = new Ajv({ allErrors: true, strict: false });
  (addFormatsModule as unknown as FormatsPlugin)(ajv);
  return new Map(BUILDCORES_SUPPORTED_CATEGORIES.map((category) => {
    const schemaPath = `schemas/${category}.schema.json`;
    const file = byPath.get(schemaPath);
    if (!file) {
      throw new Error(`Pinned BuildCores snapshot is missing ${schemaPath}`);
    }
    const schema = JSON.parse(Buffer.from(file.bytes).toString('utf8')) as object;
    return [category, ajv.compile(schema)] as const;
  }));
}

export async function loadBuildCoresSnapshot(
  options: LoadBuildCoresSnapshotOptions,
): Promise<BuildCoresSnapshot> {
  const schemaFiles = await readSchemaFiles(options.rootDir, join(options.rootDir, 'schemas'));
  if (schemaFiles.length === 0) {
    throw new Error('Pinned BuildCores snapshot has no schema files');
  }
  const schemaFingerprint = fingerprintSchemaFiles(schemaFiles);
  if (schemaFingerprint !== options.schemaFingerprint) {
    throw new BuildCoresSchemaFingerprintMismatchError(
      options.schemaFingerprint,
      schemaFingerprint,
    );
  }
  const sourceSchemas = compileSourceSchemas(schemaFiles);
  const databaseRoot = join(options.rootDir, 'open-db');
  const requestedCategories = options.categories
    ? new Set(options.categories)
    : undefined;
  const categoryEntries = (await readdir(databaseRoot, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isDirectory() &&
        (!requestedCategories || requestedCategories.has(entry.name)),
    )
    .sort((left, right) => left.name.localeCompare(right.name));
  const records: BuildCoresSnapshotRecord[] = [];

  for (const categoryEntry of categoryEntries) {
    const categoryRoot = join(databaseRoot, categoryEntry.name);
    const files = (await readdir(categoryRoot, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const file of files) {
      const absolutePath = join(categoryRoot, file.name);
      const relativePath = relative(options.rootDir, absolutePath).replaceAll('\\', '/');
      try {
        const data = JSON.parse(await readFile(absolutePath, 'utf8')) as JsonValue;
        const validator = sourceSchemas.get(categoryEntry.name);
        const valid = validator ? validator(data) : undefined;
        records.push({
          category: categoryEntry.name,
          relativePath,
          data,
          ...(valid === undefined
            ? {}
            : {
                sourceSchemaValidation: {
                  valid,
                  errors: valid ? [] : sourceSchemaErrors(validator?.errors),
                },
              }),
        });
      } catch (error) {
        records.push({
          category: categoryEntry.name,
          relativePath,
          parseError: error instanceof Error ? error.message : 'Invalid JSON',
        });
      }
    }
  }

  return {
    providerId: BUILDCORES_PROVIDER_ID,
    providerVersion: `commit:${options.commitSha}`,
    commitSha: options.commitSha,
    schemaFingerprint,
    records,
  };
}
