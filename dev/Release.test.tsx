/** @jest-environment node */
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const helper = resolve('scripts/release-assets.mjs');
const template = resolve('deploy/argocd-server-patch.yaml');
let fixture: string;
beforeEach(() => {
  fixture = mkdtempSync(join(tmpdir(), 'swagger-release-'));
  mkdirSync(join(fixture, 'deploy'));
  mkdirSync(join(fixture, 'dist'));
  writeFileSync(join(fixture, 'package.json'), JSON.stringify({version: '0.1.0'}));
  copyFileSync(template, join(fixture, 'deploy/argocd-server-patch.yaml'));
});
afterEach(() => rmSync(fixture, {recursive: true, force: true}));
function run(tag = 'v0.1.0', repository = 'rodrigogeromin/argocd-swagger-ui-extension', args: string[] = []) {
  return spawnSync(process.execPath, [helper, ...args], {
    cwd: fixture, encoding: 'utf8',
    env: {...process.env, RELEASE_TAG: tag, RELEASE_REPOSITORY: repository}
  });
}
function output(name: string) { return join(fixture, 'dist', name); }

test('prepares checksum from actual package bytes and immutable release URLs', () => {
  const archive = Buffer.from('release fixture package bytes\0');
  writeFileSync(output('swagger-gateway.tar.gz'), archive);
  const result = run('v0.1.0', 'example/custom-extension');
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(readFileSync(output('checksums.txt'), 'utf8')).toBe(`${createHash('sha256').update(archive).digest('hex')}  swagger-gateway.tar.gz\n`);
  const patch = readFileSync(output('argocd-server-patch.yaml'), 'utf8');
  expect(patch).toContain('https://github.com/example/custom-extension/releases/download/v0.1.0/swagger-gateway.tar.gz');
  expect(patch).toContain('https://github.com/example/custom-extension/releases/download/v0.1.0/checksums.txt');
  expect(patch).toContain('name: EXTENSION_CHECKSUM_URL');
  expect(patch).toContain('name: argocd-extension-installer-swagger-gateway');
  expect(patch).not.toMatch(/__TAG__|__REPOSITORY__/);
});

test.each(['v0.2.0', '0.1.0', 'v0.1.0\n', 'v0.1.0;echo unsafe'])('rejects incompatible tag %p before preparing assets', tag => {
  expect(run(tag).status).not.toBe(0);
  expect(existsSync(output('checksums.txt'))).toBe(false);
});

test.each(['../repo', 'owner/repo/path', 'owner/repo\n', 'owner/repo;echo unsafe', '', 'owner/..'])('rejects repository %p', repository => {
  expect(run('v0.1.0', repository, ['--validate-only']).status).not.toBe(0);
});

test.each(['01.1.0', '1.0', '1.0.0-01', '1.0.0\n', '1.0.0/unsafe'])('rejects invalid version %p', version => {
  writeFileSync(join(fixture, 'package.json'), JSON.stringify({version}));
  expect(run(`v${version}`, undefined, ['--validate-only']).status).not.toBe(0);
});

test('validates identity without dependencies or an archive, including prereleases', () => {
  writeFileSync(join(fixture, 'package.json'), JSON.stringify({version: '1.2.3-rc.1+build.2'}));
  expect(run('v1.2.3-rc.1+build.2', undefined, ['--validate-only']).status).toBe(0);
  expect(existsSync(output('checksums.txt'))).toBe(false);
});

test('missing archive fails without writing release assets', () => {
  expect(run().status).not.toBe(0);
  expect(existsSync(output('checksums.txt'))).toBe(false);
  expect(existsSync(output('argocd-server-patch.yaml'))).toBe(false);
});
