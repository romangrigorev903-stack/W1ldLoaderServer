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
db.exec(`CREATE TABLE IF NOT EXISTS news (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    image TEXT DEFAULT ''
)`);

// Новая таблица для мульти-клиента — расширенная конфигурация запуска
db.exec(`CREATE TABLE IF NOT EXISTS clients_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    mc_version TEXT NOT NULL,
    loader_type TEXT DEFAULT 'fabric',
    loader_version TEXT DEFAULT '',
    loader_profile_url TEXT DEFAULT '',
    fabric_api_version TEXT DEFAULT '',
    java_major INTEGER DEFAULT NULL,
    mods TEXT DEFAULT '[]',
    jvm_args TEXT DEFAULT '[]',
    default_ram INTEGER DEFAULT 1536,
    banner_url TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    is_beta INTEGER DEFAULT 0,
    is_premium INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
)`);

const clientConfigColumns = db.prepare('PRAGMA table_info(clients_config)').all();
if (!clientConfigColumns.some((column) => column.name === 'java_major')) {
    db.exec('ALTER TABLE clients_config ADD COLUMN java_major INTEGER DEFAULT NULL');
}

module.exports = db;
