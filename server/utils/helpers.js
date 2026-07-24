const fs = require('fs');
const path = require('path');

function isHttpUrl(value) {
    if (typeof value !== 'string') return false;
    try {
        const parsed = new URL(value.trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (err) {
        return false;
    }
}

function normalizeUrl(value) {
    return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

function readTextFile(filePath) {
    try {
        if (filePath && filePath !== ':memory:' && fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8').trim();
        }
    } catch (err) {}
    return '';
}

function readJsonFile(filePath, fallback) {
    try {
        if (filePath && filePath !== ':memory:' && fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (err) {}
    return fallback;
}

function ensureParentDir(filePath) {
    if (filePath && filePath !== ':memory:') {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
}

module.exports = { isHttpUrl, normalizeUrl, readTextFile, readJsonFile, ensureParentDir };