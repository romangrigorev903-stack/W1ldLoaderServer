const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
} = require('@aws-sdk/client-s3');
const cache = require('../utils/cache');

const REQUIRED_S3_VARS = [
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
];

function hashFile(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

async function hashStream(stream) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of stream) hash.update(chunk);
    return hash.digest('hex');
}

function normalizePrefix(value) {
    const prefix = String(value || 'clients/').replace(/^\/+|\/+$/g, '');
    return prefix ? `${prefix}/` : '';
}

function parseBoolean(value) {
    return /^(1|true|yes)$/i.test(String(value || ''));
}

function safeFileName(name) {
    if (typeof name !== 'string' || !name || name.includes('\0')) {
        throw Object.assign(new Error('Недопустимое имя файла'), { status: 400 });
    }
    const base = path.basename(name);
    if (base !== name || base === '.' || base === '..') {
        throw Object.assign(new Error('Недопустимое имя файла'), { status: 400 });
    }
    return base;
}

function contentTypeFor(name) {
    switch (path.extname(name).toLowerCase()) {
        case '.jar': return 'application/java-archive';
        case '.zip': return 'application/zip';
        case '.exe': return 'application/vnd.microsoft.portable-executable';
        default: return 'application/octet-stream';
    }
}

function isNotFound(error) {
    return Boolean(error) && (
        error.name === 'NoSuchKey'
        || error.name === 'NotFound'
        || (error.$metadata && error.$metadata.httpStatusCode === 404)
    );
}

function createClientStorage(options = {}) {
    const env = options.env || process.env;
    const localDir = options.localDir || (
        env.CLIENT_STORAGE_DIR
            ? path.resolve(env.CLIENT_STORAGE_DIR)
            : path.join(__dirname, '..', '..', 'storage', 'clients')
    );
    const useS3 = REQUIRED_S3_VARS.every((name) => String(env[name] || '').trim());
    const prefix = normalizePrefix(env.S3_CLIENTS_PREFIX);
    let s3Client;

    function keyFor(name) {
        return prefix + safeFileName(name);
    }

    function getS3Client() {
        if (!s3Client) {
            s3Client = options.s3Client || new S3Client({
                endpoint: env.S3_ENDPOINT,
                region: env.S3_REGION,
                forcePathStyle: parseBoolean(env.S3_FORCE_PATH_STYLE),
                requestChecksumCalculation: 'WHEN_REQUIRED',
                responseChecksumValidation: 'WHEN_REQUIRED',
                credentials: {
                    accessKeyId: env.S3_ACCESS_KEY_ID,
                    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
                },
            });
        }
        return s3Client;
    }

    async function listFiles() {
        if (!useS3) {
            await fs.promises.mkdir(localDir, { recursive: true });
            const entries = await fs.promises.readdir(localDir, { withFileTypes: true });
            const files = await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => {
                const stat = await fs.promises.stat(path.join(localDir, entry.name));
                return {
                    name: entry.name,
                    size: stat.size,
                    mtime: stat.mtime,
                    ext: path.extname(entry.name).toLowerCase(),
                };
            }));
            return files.sort((left, right) => left.name.localeCompare(right.name));
        }

        const files = [];
        let continuationToken;
        do {
            const result = await getS3Client().send(new ListObjectsV2Command({
                Bucket: env.S3_BUCKET,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            }));
            for (const object of result.Contents || []) {
                const name = object.Key.slice(prefix.length);
                if (!name || name.includes('/')) continue;
                files.push({
                    name,
                    size: Number(object.Size || 0),
                    mtime: object.LastModified || null,
                    ext: path.extname(name).toLowerCase(),
                });
            }
            continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
        } while (continuationToken);
        return files.sort((left, right) => left.name.localeCompare(right.name));
    }

    async function putFile(name, sourcePath) {
        const safeName = safeFileName(name);
        const stat = await fs.promises.stat(sourcePath);
        if (!stat.isFile()) throw new Error('Источник загрузки не является файлом');
        const sha256 = await hashFile(sourcePath);

        if (!useS3) {
            await fs.promises.mkdir(localDir, { recursive: true });
            const destination = path.join(localDir, safeName);
            if (path.resolve(sourcePath) !== path.resolve(destination)) {
                await fs.promises.copyFile(sourcePath, destination);
            }
            return { name: safeName, size: stat.size, sha256 };
        }

        await getS3Client().send(new PutObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: keyFor(safeName),
            Body: fs.createReadStream(sourcePath),
            ContentLength: stat.size,
            ContentType: contentTypeFor(safeName),
            Metadata: { sha256 },
        }));
        return { name: safeName, size: stat.size, sha256 };
    }

    async function deleteFile(name) {
        const safeName = safeFileName(name);
        if (!useS3) {
            try {
                await fs.promises.unlink(path.join(localDir, safeName));
                return true;
            } catch (error) {
                if (error.code === 'ENOENT') return false;
                throw error;
            }
        }

        try {
            await getS3Client().send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: keyFor(safeName) }));
        } catch (error) {
            if (isNotFound(error)) return false;
            throw error;
        }
        await getS3Client().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: keyFor(safeName) }));
        return true;
    }

    async function getFileMetadata(name) {
        const safeName = safeFileName(name);
        if (!useS3) {
            const filePath = path.join(localDir, safeName);
            let stat;
            try {
                stat = await fs.promises.stat(filePath);
            } catch (error) {
                if (error.code === 'ENOENT') throw new Error(`Файл мода отсутствует на сервере: ${safeName}`);
                throw error;
            }
            if (!stat.isFile()) throw new Error(`Мод не является файлом: ${safeName}`);
            const cacheKey = `client-file:${safeName}:${stat.size}:${stat.mtimeMs}`;
            let sha256 = cache.get(cacheKey);
            if (!sha256) {
                sha256 = await hashFile(filePath);
                cache.set(cacheKey, sha256, 3600);
            }
            return { name: safeName, size: stat.size, mtime: stat.mtime, sha256 };
        }

        let head;
        try {
            head = await getS3Client().send(new HeadObjectCommand({
                Bucket: env.S3_BUCKET,
                Key: keyFor(safeName),
            }));
        } catch (error) {
            if (isNotFound(error)) throw new Error(`Файл мода отсутствует на сервере: ${safeName}`);
            throw error;
        }

        const size = Number(head.ContentLength || 0);
        const version = head.ETag || (head.LastModified && head.LastModified.getTime()) || 'unknown';
        const cacheKey = `client-file:s3:${safeName}:${size}:${version}`;
        let sha256 = head.Metadata && head.Metadata.sha256;
        if (!sha256) sha256 = cache.get(cacheKey);
        if (!sha256) {
            const object = await getS3Client().send(new GetObjectCommand({
                Bucket: env.S3_BUCKET,
                Key: keyFor(safeName),
            }));
            sha256 = await hashStream(object.Body);
            cache.set(cacheKey, sha256, 3600);
        }
        return { name: safeName, size, mtime: head.LastModified || null, sha256 };
    }

    async function openRead(name) {
        const safeName = safeFileName(name);
        if (!useS3) {
            const filePath = path.join(localDir, safeName);
            try {
                const stat = await fs.promises.stat(filePath);
                if (!stat.isFile()) return null;
                return {
                    name: safeName,
                    size: stat.size,
                    mtime: stat.mtime,
                    contentType: contentTypeFor(safeName),
                    stream: fs.createReadStream(filePath),
                };
            } catch (error) {
                if (error.code === 'ENOENT') return null;
                throw error;
            }
        }

        try {
            const object = await getS3Client().send(new GetObjectCommand({
                Bucket: env.S3_BUCKET,
                Key: keyFor(safeName),
            }));
            return {
                name: safeName,
                size: Number(object.ContentLength || 0),
                mtime: object.LastModified || null,
                contentType: object.ContentType || contentTypeFor(safeName),
                stream: object.Body,
            };
        } catch (error) {
            if (isNotFound(error)) return null;
            throw error;
        }
    }

    return {
        backend: useS3 ? 's3' : 'local',
        deleteFile,
        getFileMetadata,
        listFiles,
        openRead,
        putFile,
    };
}

const storage = createClientStorage();

module.exports = {
    ...storage,
    createClientStorage,
    hashFile,
    hashStream,
    safeFileName,
};
