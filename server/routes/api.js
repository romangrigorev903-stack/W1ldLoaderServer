const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const helpers = require('../utils/helpers');
const cache = require('../utils/cache');

function getPublicUrl() {
    const candidates = [
        config.publicUrl,
        process.env.RENDER_EXTERNAL_URL,
        process.env.AUTH_SERVER_URL,
        process.env.TUNNEL_URL,
    ];

    for (const candidate of candidates) {
        if (helpers.isHttpUrl(candidate)) {
            return helpers.normalizeUrl(candidate);
        }
    }

    const fileUrl = helpers.readTextFile(
        path.isAbsolute(config.tunnelUrlFile)
            ? config.tunnelUrlFile
            : path.join(__dirname, '..', '..', config.tunnelUrlFile)
    );
    if (helpers.isHttpUrl(fileUrl)) {
        return helpers.normalizeUrl(fileUrl);
    }

    return '';
}

router.get('/tunnel-url', (req, res) => {
    try {
        const url = getPublicUrl();
        res.json({ url: url });
    } catch (err) {
        res.json({ url: '' });
    }
});

router.get('/status', (req, res) => {
    res.json({ success: true, status: 'online', version: '2.0.0' });
});

router.get('/stats', (req, res) => {
    const db = require('../database/db');
    const total = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const banned = db.prepare('SELECT COUNT(*) as count FROM users WHERE banned = 1').get().count;
    const today = db.prepare("SELECT COUNT(*) as count FROM users WHERE created_at >= date('now')").get().count;
    res.json({ success: true, total, banned, today });
});

router.get('/launcher-version', (req, res) => {
    const versionFile = path.isAbsolute(config.launcherVersionFile)
        ? config.launcherVersionFile
        : path.join(__dirname, '..', '..', config.launcherVersionFile);

    try {
        const data = helpers.readJsonFile(versionFile, null);
        res.json({ success: true, version: data ? data.version : '1.0.0', changelog: data ? (data.changelog || '') : '' });
    } catch (err) {
        res.json({ success: true, version: '1.0.0', changelog: '' });
    }
});

router.get('/client-version', (req, res) => {
    res.json({ success: true, version: '1.0.1', changelog: 'Исправлено скачивание, улучшена стабильность' });
});

// Отдаёт jar-файл из стабильного слота storage/clients/<slotName>.
function serveJarSlot(res, slotName, downloadName) {
    const jarPath = path.join(__dirname, '..', '..', 'storage', 'clients', slotName);
    if (!fs.existsSync(jarPath)) {
        return res.status(404).json({ success: false, error: slotName + ' не загружен на сервер' });
    }
    const stat = fs.statSync(jarPath);
    res.writeHead(200, {
        'Content-Type': 'application/java-archive',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename="' + (downloadName || slotName) + '"',
    });
    fs.createReadStream(jarPath).pipe(res);
    console.log('[Jar] Sent:', slotName);
}

// wild.jar — сам мод-клиент.
router.get('/download-client', (req, res) => {
    serveJarSlot(res, 'wild.jar', 'wild.jar');
});

// fabric-api.jar
router.get('/download-fabric-api', (req, res) => {
    serveJarSlot(res, 'fabric-api.jar', 'fabric-api.jar');
});

// baritone.jar (опционально)
router.get('/download-baritone', (req, res) => {
    serveJarSlot(res, 'baritone.jar', 'baritone.jar');
});

router.get('/download-launcher', (req, res) => {
    const versionFile = path.isAbsolute(config.launcherVersionFile)
        ? config.launcherVersionFile
        : path.join(__dirname, '..', '..', config.launcherVersionFile);

    let version = '1.0.0';
    try {
        version = helpers.readJsonFile(versionFile, { version: '1.0.0' }).version;
    } catch (e) {}

    const launcherPath = path.isAbsolute(config.launcherDistDir)
        ? path.join(config.launcherDistDir, 'W1ld Launcher ' + version + '.exe')
        : path.join(__dirname, '..', '..', config.launcherDistDir, 'W1ld Launcher ' + version + '.exe');

    if (!fs.existsSync(launcherPath)) {
        return res.status(404).json({ success: false, error: 'Лаунчер не найден' });
    }

    const stat = fs.statSync(launcherPath);
    res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename="W1ld Launcher ' + version + '.exe"',
    });
    const readStream = fs.createReadStream(launcherPath);
    readStream.pipe(res);
    console.log('[Launcher] Sent to client');
});

router.get('/buttons', (req, res) => {
    const db = require('../database/db');
    const buttons = db.prepare('SELECT * FROM buttons WHERE is_active = 1 ORDER BY order_index ASC').all();
    res.json({ success: true, buttons: buttons });
});

router.get('/clients', (req, res) => {
    const db = require('../database/db');
    const clients = db.prepare('SELECT * FROM clients WHERE is_active = 1 ORDER BY id DESC').all();
    res.json({ success: true, clients: clients });
});

router.get('/news', (req, res) => {
    const newsService = require('../services/newsService');
    const news = newsService.getNews();
    res.json({ success: true, news: news });
});

// Скачивание произвольного мода по имени (из storage/clients/)
router.get('/download-mod', (req, res) => {
    const name = req.query.name;
    if (!name) return res.status(400).json({ success: false, error: 'Не указано имя файла' });
    const modPath = path.join(__dirname, '..', '..', 'storage', 'clients', path.basename(name));
    if (!fs.existsSync(modPath)) {
        return res.status(404).json({ success: false, error: 'Файл ' + name + ' не загружен' });
    }
    const stat = fs.statSync(modPath);
    res.writeHead(200, {
        'Content-Type': 'application/java-archive',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename="' + name + '"',
    });
    fs.createReadStream(modPath).pipe(res);
});

// Публичный: список доступных клиентов для лаунчера (только активные)
router.get('/clients-config', (req, res) => {
    const clientsConfigService = require('../services/clientsConfigService');
    const clients = clientsConfigService.getAllConfigs(true);
    res.json({ success: true, clients: clients });
});

module.exports = router;
