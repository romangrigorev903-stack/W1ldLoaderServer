const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
    normalizeClientConfig,
    parseMinecraftVersion,
    resolveJavaMajor,
} = require('../server/utils/clientProfile');
const { hashFile } = require('../server/services/clientManifestService');

test('parses supported Minecraft version format', () => {
    assert.deepEqual(parseMinecraftVersion('1.16.5'), { major: 1, minor: 16, patch: 5 });
    assert.deepEqual(parseMinecraftVersion('1.21'), { major: 1, minor: 21, patch: 0 });
    assert.equal(parseMinecraftVersion('release-1.21.8'), null);
});

test('selects the expected Java runtime', () => {
    assert.equal(resolveJavaMajor('1.16.5', null), 8);
    assert.equal(resolveJavaMajor('1.17.1', null), 17);
    assert.equal(resolveJavaMajor('1.20.4', null), 17);
    assert.equal(resolveJavaMajor('1.20.5', null), 21);
    assert.equal(resolveJavaMajor('1.21.8', null), 21);
    assert.equal(resolveJavaMajor('1.16.5', 17), 17);
});

test('normalizes a valid Fabric client profile', () => {
    const result = normalizeClientConfig({
        name: ' W1ld Client ',
        mc_version: '1.21.8',
        loader_type: 'fabric',
        loader_version: '0.19.3',
        java_major: 'auto',
        mods: ['wild.jar', 'wild.jar', 'fabric-api.jar'],
        jvm_args: [' -XX:+UseG1GC ', ''],
        default_ram: 2048,
        is_active: true,
    }, new Set(['wild.jar', 'fabric-api.jar']));

    assert.deepEqual(result.errors, []);
    assert.equal(result.value.name, 'W1ld Client');
    assert.equal(result.value.java_major, null);
    assert.deepEqual(result.value.mods, ['wild.jar', 'fabric-api.jar']);
    assert.deepEqual(result.value.jvm_args, ['-XX:+UseG1GC']);
});

test('rejects unsupported or incomplete profiles', () => {
    const result = normalizeClientConfig({
        name: 'Old client',
        mc_version: '1.12.2',
        loader_type: 'forge',
        loader_version: '',
        java_major: 11,
        mods: ['missing.jar'],
    }, new Set());

    assert.ok(result.errors.some((error) => error.includes('1.16.5')));
    assert.ok(result.errors.some((error) => error.includes('Fabric')));
    assert.ok(result.errors.some((error) => error.includes('Fabric Loader')));
    assert.ok(result.errors.some((error) => error.includes('Java')));
    assert.ok(result.errors.some((error) => error.includes('missing.jar')));
});

test('calculates SHA-256 for manifest files', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w1ld-server-test-'));
    const filePath = path.join(tempDir, 'fixture.jar');
    fs.writeFileSync(filePath, 'manifest fixture');
    try {
        const expected = crypto.createHash('sha256').update('manifest fixture').digest('hex');
        assert.equal(await hashFile(filePath), expected);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
