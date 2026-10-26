import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(rootDir, 'dist');

rmSync(distDir, { recursive: true, force: true });

// 1. Compile server TypeScript (CommonJS + .d.ts) via tsc
const tscBin = resolve(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc'
);
execFileSync(tscBin, ['-p', 'tsconfig.server.json'], {
  cwd: rootDir,
  stdio: 'inherit',
});

// 2. Bundle admin entrypoint (ESM + CJS) with external peerDependencies
const externalPeers = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react-router-dom',
  'styled-components',
  '@strapi/*',
];

await build({
  entryPoints: [resolve(rootDir, 'admin/src/index.ts')],
  outfile: resolve(distDir, 'admin/index.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  external: externalPeers,
});

await build({
  entryPoints: [resolve(rootDir, 'admin/src/index.ts')],
  outfile: resolve(distDir, 'admin/index.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  external: externalPeers,
});

mkdirSync(resolve(distDir, 'admin/translations'), { recursive: true });
cpSync(
  resolve(rootDir, 'admin/src/translations'),
  resolve(distDir, 'admin/translations'),
  { recursive: true }
);

writeFileSync(
  resolve(distDir, 'admin/index.d.ts'),
  "declare const plugin: Record<string, unknown>;\nexport default plugin;\n"
);

console.log('[global-search] Built dist/server and dist/admin successfully.');
