import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const EXPECTED_CANONICAL_SCHEMA_VERSION = '3.0.0';
const API_DATA_MARKER = 'socket-mismatch';

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readResponse(url, label) {
  const response = await globalThis.fetch(url, {
    signal: globalThis.AbortSignal.timeout(10_000),
  });
  const body = await response.text();
  if (response.status !== 200) {
    throw new Error(`${label} returned HTTP ${response.status}`);
  }
  return { body, status: response.status };
}

function parseJson(body, label) {
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(`${label} did not return valid JSON`, { cause: error });
  }
}

export async function verifyRuntimeEndpoints({ healthUrl, openapiUrl, webUrl }) {
  const healthResponse = await readResponse(healthUrl, 'Health endpoint');
  const health = parseJson(healthResponse.body, 'Health endpoint');
  if (!isRecord(health) || health.canonicalSchemaVersion !== EXPECTED_CANONICAL_SCHEMA_VERSION) {
    throw new Error(
      `Health endpoint canonicalSchemaVersion must be ${EXPECTED_CANONICAL_SCHEMA_VERSION}`,
    );
  }

  const openapiResponse = await readResponse(openapiUrl, 'OpenAPI endpoint');
  const openapi = parseJson(openapiResponse.body, 'OpenAPI endpoint');
  if (
    !isRecord(openapi) ||
    typeof openapi.openapi !== 'string' ||
    !/^3\.\d+\.\d+$/u.test(openapi.openapi) ||
    !isRecord(openapi.info) ||
    typeof openapi.info.title !== 'string' ||
    typeof openapi.info.version !== 'string' ||
    !isRecord(openapi.paths)
  ) {
    throw new Error('OpenAPI endpoint did not return a valid OpenAPI 3 document');
  }

  const webResponse = await readResponse(webUrl, 'Demo Web');
  for (const marker of ['PCPartCheck', 'CANONICAL 3.0.0', API_DATA_MARKER]) {
    if (!webResponse.body.includes(marker)) {
      throw new Error(`Demo Web did not render required marker: ${marker}`);
    }
  }

  return {
    health: {
      canonicalSchemaVersion: health.canonicalSchemaVersion,
      status: healthResponse.status,
    },
    openapi: { status: openapiResponse.status, version: openapi.openapi },
    web: { apiDataMarker: API_DATA_MARKER, status: webResponse.status },
  };
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  verifyRuntimeEndpoints({
    healthUrl: 'http://127.0.0.1:3001/health',
    openapiUrl: 'http://127.0.0.1:3001/openapi.json',
    webUrl: 'http://127.0.0.1:3000/',
  }).then(
    (result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`),
    (error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    },
  );
}
