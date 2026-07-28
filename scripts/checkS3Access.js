require('dotenv').config();
const clientStorage = require('../server/services/clientStorageService');

async function main() {
    if (clientStorage.backend !== 's3') {
        throw new Error('S3 is not fully configured');
    }

    await clientStorage.listFiles();
    console.log('S3 credentials and bucket access verified.');
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
