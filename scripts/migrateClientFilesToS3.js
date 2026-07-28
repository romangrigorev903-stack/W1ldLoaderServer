const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();
const clientStorage = require('../server/services/clientStorageService');

async function main() {
    if (clientStorage.backend !== 's3') {
        throw new Error('S3 настроен не полностью. Проверьте переменные S3_*');
    }

    await clientStorage.listFiles();
    console.log('S3 credentials and bucket access verified.');

    const sourceDir = path.resolve(process.env.CLIENT_STORAGE_DIR || path.join(__dirname, '..', 'storage', 'clients'));
    const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile());

    for (const file of files) {
        const result = await clientStorage.putFile(file.name, path.join(sourceDir, file.name));
        console.log(`Uploaded ${result.name} (${result.size} bytes)`);
    }

    console.log(`Uploaded ${files.length} client file(s) to S3.`);
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
