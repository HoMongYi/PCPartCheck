import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

import type { JsonValue } from '@pcpartcheck/core';

import {
  BUILDCORES_PROVIDER_ID,
  type BuildCoresSnapshot,
  type BuildCoresSnapshotRecord,
  type LoadBuildCoresSnapshotOptions,
} from './types.js';

export async function loadBuildCoresSnapshot(
  options: LoadBuildCoresSnapshotOptions,
): Promise<BuildCoresSnapshot> {
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
        records.push({
          category: categoryEntry.name,
          relativePath,
          data: JSON.parse(await readFile(absolutePath, 'utf8')) as JsonValue,
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
    schemaFingerprint: options.schemaFingerprint,
    records,
  };
}
