const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config/config');

function resolveConfiguredPath(value, fallback) {
    if (typeof value === 'string' && value.trim()) {
        const trimmed = value.trim();
        if (trimmed === ':memory:') return trimmed;
        return path.isAbsolute(trimmed) ? trimmed : path.resolve(__dirname, '..', '..', trimmed);
    }
    return fallback;
}

const dbPath = resolveConfiguredPath(config.dbPath, path.join(__dirname, '..', '..', 'w1ld_auth.db'));

function ensureParentDir(filePath) {
    if (filePath && filePath !== ':memory:') {
        const fs = require('fs');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
}

ensureParentDir(dbPath);
const db = new Database(dbPath);

if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
}

db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, hwid TEXT, banned INTEGER DEFAULT 0, subscription_until TEXT DEFAULT 'infinity', is_admin INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);
db.exec(`CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, version TEXT NOT NULL, description TEXT, image_url TEXT, download_url TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`);
db.exec(`CREATE TABLE IF NOT EXISTS buttons (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT, action_url TEXT, order_index INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`);

module.exports = db;