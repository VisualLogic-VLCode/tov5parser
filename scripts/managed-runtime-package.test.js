import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

test('npm artifact remains importable after the managed runtime copies only its package root', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tov5parser-managed-runtime-'));
  const packedDir = path.join(temporary, 'packed');
  const installDir = path.join(temporary, 'install');
  const detachedDir = path.join(temporary, 'detached-runtime');
  fs.mkdirSync(packedDir);

  try {
    const packed = JSON.parse(run('npm', [
      'pack',
      '--json',
      '--pack-destination',
      packedDir,
    ]));
    assert.equal(packed.length, 1);
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    const productionDependencies = Object.keys(packageJson.dependencies || {}).sort();
    assert.deepEqual(
      [...(packed[0].bundled || [])].sort(),
      productionDependencies,
      'artifact must bundle every production dependency',
    );

    const tarball = path.join(packedDir, packed[0].filename);
    run('npm', [
      'install',
      '--ignore-scripts',
      '--omit=dev',
      '--no-audit',
      '--no-fund',
      '--prefix',
      installDir,
      tarball,
    ]);

    const installedPackage = path.join(
      installDir,
      'node_modules',
      '@visuallogic-vlcode',
      'tov5parser',
    );
    fs.cpSync(installedPackage, detachedDir, { recursive: true, errorOnExist: true });
    fs.rmSync(installDir, { recursive: true, force: true });

    for (const dependency of productionDependencies) {
      assert.equal(
        fs.existsSync(path.join(detachedDir, 'node_modules', ...dependency.split('/'), 'package.json')),
        true,
        `detached runtime is missing ${dependency}`,
      );
    }
    const runtime = await import(`${pathToFileURL(path.join(detachedDir, 'index.js')).href}?isolated=1`);
    assert.equal(typeof runtime.convertV4CaseJsonToV5CaseJson, 'function');
    assert.equal(typeof runtime.convertV4CaseJsonToV5CaseJsonDetailed, 'function');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
