#!/usr/bin/env node
// 打 lambda 运行时部署包：源码 + 生产依赖 node_modules → zip。
// 流程与 vlparser 的 scripts/package-runtime.mjs 同构（精简版）。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const defaultZipPath = path.join(repoRoot, 'archive.runtime-tov5.zip');
const defaultStageDir = path.join(os.tmpdir(), 'tov5parser-runtime-package');

// 运行时需要的文件与目录（测试文件在 stage 后剔除）
const runtimeFiles = [
  'index.js',
  'lambdaIndex.js',
  'ivxMap.txt',
  'package.json',
  'package-lock.json',
  's3Transfer.js',
];
const runtimeDirs = ['legacyMaps', 'utils', 'v4ToV5'];

const requiredZipEntries = [
  'node_modules/',
  'index.js',
  'lambdaIndex.js',
  'ivxMap.txt',
  'package.json',
  'legacyMaps/legacyIvxMap.txt',
  'utils/MapCreator.js',
  'v4ToV5/index.js',
  's3Transfer.js',
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
    cwd: options.cwd || repoRoot,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})`);
  }
  return options.capture ? result.stdout : undefined;
}

function removeTestFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeTestFiles(fullPath);
    } else if (entry.name.endsWith('.test.js')) {
      fs.rmSync(fullPath);
    }
  }
}

export async function buildRuntimePackage({
  zipPath = defaultZipPath,
  stageDir = defaultStageDir,
} = {}) {
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });

  for (const file of runtimeFiles) {
    const src = path.join(repoRoot, file);
    if (!fs.existsSync(src)) {
      throw new Error(`missing runtime file: ${file}`);
    }
    fs.cpSync(src, path.join(stageDir, file));
  }
  for (const dir of runtimeDirs) {
    fs.cpSync(path.join(repoRoot, dir), path.join(stageDir, dir), {
      recursive: true,
    });
  }
  removeTestFiles(stageDir);

  console.log('Installing production dependencies in stage dir...');
  run('npm', ['ci', '--omit=dev', '--no-fund', '--no-audit'], {
    cwd: stageDir,
  });

  fs.rmSync(zipPath, { force: true });
  console.log(`Zipping to ${zipPath} ...`);
  run('zip', ['-qr', zipPath, '.'], { cwd: stageDir });

  const listing = run('unzip', ['-l', zipPath], { capture: true });
  for (const entry of requiredZipEntries) {
    if (!listing.includes(entry)) {
      throw new Error(`zip is missing required entry: ${entry}`);
    }
  }
  const sizeMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
  console.log(`Runtime package ready: ${zipPath} (${sizeMB} MB)`);
  return { zipPath };
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
  buildRuntimePackage().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
