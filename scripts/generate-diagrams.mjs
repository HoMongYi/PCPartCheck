import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

const diagrams = [
  ['docs/diagrams/package-dependencies.mmd', 'docs/assets/package-dependencies.svg'],
  ['docs/diagrams/runtime-data-flow.mmd', 'docs/assets/runtime-data-flow.svg'],
];
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.setContent('<main id="diagram"></main>');
  await page.addScriptTag({ path: resolve('node_modules/mermaid/dist/mermaid.min.js') });
  for (const [sourcePath, outputPath] of diagrams) {
    const source = await readFile(resolve(sourcePath), 'utf8');
    const svg = await page.evaluate(async ({ id, definition }) => {
      globalThis.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'neutral',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      });
      return (await globalThis.mermaid.render(id, definition)).svg;
    }, { id: `pcpartcheck-${outputPath.replace(/[^a-z0-9]/giu, '-')}`, definition: source });
    await mkdir(dirname(resolve(outputPath)), { recursive: true });
    await writeFile(resolve(outputPath), `${svg}\n`);
    process.stdout.write(`Generated ${outputPath}.\n`);
  }
} finally {
  await browser.close();
}
