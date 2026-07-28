const path = require('path');
const clientStorage = require('./clientStorageService');

async function getFileMetadata(name) {
    const safeName = path.basename(name);
    if (safeName !== name || path.extname(safeName).toLowerCase() !== '.jar') {
        throw new Error(`Недопустимое имя мода: ${name}`);
    }

    const metadata = await clientStorage.getFileMetadata(safeName);

    return {
        name: safeName,
        size: metadata.size,
        sha256: metadata.sha256,
        download_url: `/api/download-mod?name=${encodeURIComponent(safeName)}`,
    };
}

async function buildManifest(clientConfig) {
    const files = await Promise.all((clientConfig.mods || []).map(getFileMetadata));
    return {
        client: clientConfig,
        files,
    };
}

module.exports = { buildManifest, getFileMetadata, hashFile: clientStorage.hashFile };
