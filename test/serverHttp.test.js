const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const test = require('node:test');

async function waitForHealth(url, child) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        if (child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}`);
        try {
            const response = await fetch(url + '/health');
            if (response.ok) return;
        } catch (error) {
            // The child process is still starting.
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Server did not become ready');
}

test('HTTP server serves health and client files while protecting admin routes', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w1ld-http-test-'));
    const port = 32000 + (process.pid % 10000);
    const rootDir = path.join(__dirname, '..');
    let output = '';
    const child = spawn(process.execPath, ['server/server.js'], {
        cwd: rootDir,
        env: {
            ...process.env,
            PORT: String(port),
            NODE_ENV: 'development',
            DB_PATH: path.join(tempDir, 'server.db'),
            CLIENT_STORAGE_DIR: path.join(rootDir, 'storage', 'clients'),
            JWT_SECRET: 'integration-test-secret-integration-test-secret',
            JWT_REFRESH_SECRET: 'integration-refresh-secret-integration-refresh',
            ADMIN_PASSWORD: 'IntegrationTestOnly-2026',
            REQUIRE_S3: '',
            S3_ENDPOINT: '',
            S3_REGION: '',
            S3_BUCKET: '',
            S3_ACCESS_KEY_ID: '',
            S3_SECRET_ACCESS_KEY: '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });

    try {
        const baseUrl = `http://127.0.0.1:${port}`;
        await waitForHealth(baseUrl, child);

        const health = await fetch(baseUrl + '/health');
        assert.equal(health.status, 200);

        const adminFiles = await fetch(baseUrl + '/api/admin/files');
        assert.equal(adminFiles.status, 401);

        const download = await fetch(baseUrl + '/api/download-mod?name=baritone.jar');
        assert.equal(download.status, 200);
        assert.equal((await download.arrayBuffer()).byteLength, 1612270);
    } catch (error) {
        throw new Error(`${error.message}\nServer output:\n${output}`);
    } finally {
        if (child.exitCode === null) {
            const exited = once(child, 'exit');
            child.kill('SIGTERM');
            await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
            if (child.exitCode === null) child.kill('SIGKILL');
        }
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
