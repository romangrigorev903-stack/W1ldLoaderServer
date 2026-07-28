const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createClientStorage } = require('../server/services/clientStorageService');

async function readAll(stream) {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

test('local client storage supports upload, list, metadata, read and delete', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w1ld-storage-test-'));
    const sourcePath = path.join(tempDir, 'source.jar');
    const storageDir = path.join(tempDir, 'clients');
    const contents = Buffer.from('client storage fixture');
    fs.writeFileSync(sourcePath, contents);

    try {
        const storage = createClientStorage({ env: {}, localDir: storageDir });
        assert.equal(storage.backend, 'local');

        const uploaded = await storage.putFile('fixture.jar', sourcePath);
        assert.equal(uploaded.size, contents.length);
        assert.equal(uploaded.sha256, crypto.createHash('sha256').update(contents).digest('hex'));

        const files = await storage.listFiles();
        assert.deepEqual(files.map((file) => file.name), ['fixture.jar']);

        const metadata = await storage.getFileMetadata('fixture.jar');
        assert.equal(metadata.size, contents.length);
        assert.equal(metadata.sha256, uploaded.sha256);

        const opened = await storage.openRead('fixture.jar');
        assert.equal(opened.contentType, 'application/java-archive');
        assert.deepEqual(await readAll(opened.stream), contents);

        assert.equal(await storage.deleteFile('fixture.jar'), true);
        assert.equal(await storage.deleteFile('fixture.jar'), false);
        assert.equal(await storage.openRead('fixture.jar'), null);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('client storage rejects traversal file names', async () => {
    const storage = createClientStorage({ env: {}, localDir: os.tmpdir() });
    await assert.rejects(storage.openRead('../secret.jar'), /Недопустимое имя файла/);
});

test('S3 client storage uses the configured bucket and prefix', async () => {
    const calls = [];
    const s3Client = {
        async send(command) {
            calls.push(command.input);
            return {
                Contents: [{ Key: 'clients/remote.jar', Size: 42, LastModified: new Date('2026-01-01') }],
                IsTruncated: false,
            };
        },
    };
    const env = {
        S3_ENDPOINT: 'https://s3.cloud.ru',
        S3_REGION: 'ru-central-1',
        S3_BUCKET: 'w1ld-test',
        S3_ACCESS_KEY_ID: 'test-key',
        S3_SECRET_ACCESS_KEY: 'test-secret',
        S3_CLIENTS_PREFIX: 'clients/',
        S3_FORCE_PATH_STYLE: 'true',
    };

    const storage = createClientStorage({ env, s3Client });
    assert.equal(storage.backend, 's3');
    assert.deepEqual((await storage.listFiles()).map((file) => file.name), ['remote.jar']);
    assert.equal(calls[0].Bucket, 'w1ld-test');
    assert.equal(calls[0].Prefix, 'clients/');
});
