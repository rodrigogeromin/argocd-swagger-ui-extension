import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';

// Keep identity validation dependency-free so CI can reject a tag before npm ci.
const {version} = JSON.parse(await readFile('package.json', 'utf8'));
const identifier = '(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)';
const semver = new RegExp(`^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-${identifier}(?:\\.${identifier})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`);
assert(typeof version === 'string' && semver.test(version), 'Invalid package version');
const tag = process.env.RELEASE_TAG;
const repository = process.env.RELEASE_REPOSITORY;
assert.equal(tag, `v${version}`, 'Release tag must equal v + package.json.version');
assert(typeof repository === 'string' && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(repository), 'Invalid release repository');
assert(process.argv.slice(2).every(arg => arg === '--validate-only'), 'Unknown release-assets argument');

if (!process.argv.includes('--validate-only')) {
  // Read all inputs before writing assets; a missing tar must fail preparation.
  const archive = await readFile('dist/swagger-gateway.tar.gz');
  const template = await readFile('deploy/argocd-server-patch.yaml', 'utf8');
  const config = await readFile('deploy/swagger-gateway-config.yaml');
  const patch = template.replaceAll('__REPOSITORY__', repository).replaceAll('__TAG__', tag);
  assert(!/__REPOSITORY__|__TAG__/.test(patch), 'Unresolved release identity');
  const checksum = createHash('sha256').update(archive).digest('hex');
  await writeFile('dist/checksums.txt', `${checksum}  swagger-gateway.tar.gz\n`);
  await writeFile('dist/argocd-server-patch.yaml', patch);
  await writeFile('dist/swagger-gateway-config.yaml', config);
  console.log(`Release assets prepared for ${repository}@${tag}`);
} else {
  console.log(`Release identity valid: ${repository}@${tag}`);
}
