const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const userService = require('../services/userService');
const statsService = require('../services/statsService');
const upload = require('../middleware/upload');
const { normalizeClientConfig } = require('../utils/clientProfile');
const clientStorage = require('../services/clientStorageService');

// ===== USERS =====

router.get('/users', async (req, res, next) => {
    try {
        const users = userService.getAllUsers();
        res.json({ success: true, users: users });
    } catch (err) {
        next(err);
    }
});

router.post('/users', async (req, res, next) => {
    try {
        const { username, password, is_admin } = req.body;

        if (!username || !password) {
            return res.json({ success: false, error: 'Заполните все поля' });
        }

        const existing = userService.getUserByUsername(username);
        if (existing) {
            return res.json({ success: false, error: 'Логин уже занят' });
        }

        const hashedPassword = await userService.hashPassword(password);
        const user = userService.createUser(username, hashedPassword, is_admin ? 1 : 0);

        res.json({ success: true, user: { id: user.id, username, is_admin: is_admin ? 1 : 0 } });
    } catch (err) {
        next(err);
    }
});

router.put('/users/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { username, password, banned, is_admin, subscription_until } = req.body;

        const user = userService.getUserById(id);
        if (!user) {
            return res.json({ success: false, error: 'Пользователь не найден' });
        }

        const updates = {};
        if (username !== undefined && username !== user.username) updates.username = username;
        if (password !== undefined) updates.password = await userService.hashPassword(password);
        if (banned !== undefined) updates.banned = banned;
        if (is_admin !== undefined) updates.is_admin = is_admin ? 1 : 0;
        if (subscription_until !== undefined) updates.subscription_until = subscription_until || 'infinity';

        const updated = userService.updateUser(id, updates);
        if (!updated) {
            return res.json({ success: false, error: 'Пользователь не найден' });
        }

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

router.delete('/users/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = userService.getUserById(id);
        if (!user) {
            return res.json({ success: false, error: 'Пользователь не найден' });
        }

        userService.deleteUser(id);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// ===== CLIENTS =====

router.get('/clients', async (req, res, next) => {
    try {
        const clients = db.prepare('SELECT * FROM clients ORDER BY id DESC').all();
        res.json({ success: true, clients: clients });
    } catch (err) {
        next(err);
    }
});

router.post('/clients', async (req, res, next) => {
    try {
        const { name, version, description, image_url, download_url, is_active } = req.body;

        if (!name || !version) {
            return res.json({ success: false, error: 'Заполните имя и версию' });
        }

        const result = db.prepare('INSERT INTO clients (name, version, description, image_url, download_url, is_active) VALUES (?, ?, ?, ?, ?, ?)').run(
            name, version, description || '', image_url || '', download_url || '', is_active ? 1 : 0
        );

        res.json({ success: true, client: { id: result.lastInsertRowid, name, version } });
    } catch (err) {
        next(err);
    }
});

router.put('/clients/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, version, description, image_url, download_url, is_active } = req.body;

        const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
        if (!client) {
            return res.json({ success: false, error: 'Клиент не найден' });
        }

        const updates = [];
        const params = [];

        if (name && name !== client.name) {
            updates.push('name = ?');
            params.push(name);
        }
        if (version && version !== client.version) {
            updates.push('version = ?');
            params.push(version);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (image_url !== undefined) {
            updates.push('image_url = ?');
            params.push(image_url);
        }
        if (download_url !== undefined) {
            updates.push('download_url = ?');
            params.push(download_url);
        }
        if (is_active !== undefined && is_active !== client.is_active) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.json({ success: false, error: 'Ничего не изменилось' });
        }

        params.push(id);
        db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

router.delete('/clients/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
        if (!client) {
            return res.json({ success: false, error: 'Клиент не найден' });
        }

        db.prepare('DELETE FROM clients WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// ===== BUTTONS =====

router.get('/buttons', async (req, res, next) => {
    try {
        const buttons = db.prepare('SELECT * FROM buttons ORDER BY order_index ASC, id DESC').all();
        res.json({ success: true, buttons: buttons });
    } catch (err) {
        next(err);
    }
});

router.post('/buttons', async (req, res, next) => {
    try {
        const { name, icon, action_url, order_index, is_active } = req.body;

        if (!name) {
            return res.json({ success: false, error: 'Заполните имя кнопки' });
        }

        const result = db.prepare('INSERT INTO buttons (name, icon, action_url, order_index, is_active) VALUES (?, ?, ?, ?, ?)').run(
            name, icon || '', action_url || '', order_index || 0, is_active ? 1 : 0
        );

        res.json({ success: true, button: { id: result.lastInsertRowid, name } });
    } catch (err) {
        next(err);
    }
});

router.put('/buttons/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, icon, action_url, order_index, is_active } = req.body;

        const button = db.prepare('SELECT * FROM buttons WHERE id = ?').get(id);
        if (!button) {
            return res.json({ success: false, error: 'Кнопка не найдена' });
        }

        const updates = [];
        const params = [];

        if (name && name !== button.name) {
            updates.push('name = ?');
            params.push(name);
        }
        if (icon !== undefined) {
            updates.push('icon = ?');
            params.push(icon);
        }
        if (action_url !== undefined) {
            updates.push('action_url = ?');
            params.push(action_url);
        }
        if (order_index !== undefined && order_index !== button.order_index) {
            updates.push('order_index = ?');
            params.push(order_index);
        }
        if (is_active !== undefined && is_active !== button.is_active) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.json({ success: false, error: 'Ничего не изменилось' });
        }

        params.push(id);
        db.prepare(`UPDATE buttons SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

router.delete('/buttons/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const button = db.prepare('SELECT * FROM buttons WHERE id = ?').get(id);
        if (!button) {
            return res.json({ success: false, error: 'Кнопка не найдена' });
        }

        db.prepare('DELETE FROM buttons WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// ===== NEWS =====

router.get('/news', async (req, res, next) => {
    try {
        const newsService = require('../services/newsService');
        const news = newsService.getNews();
        res.json({ success: true, news: news });
    } catch (err) {
        next(err);
    }
});

router.post('/news', async (req, res, next) => {
    try {
        const { title, content, image } = req.body;

        if (!title || !title.trim()) {
            return res.json({ success: false, error: 'Заполните заголовок новости' });
        }

        if (!content || !content.trim()) {
            return res.json({ success: false, error: 'Заполните содержание новости' });
        }

        const newsService = require('../services/newsService');
        const news = newsService.createNews({ title: title.trim(), content: content.trim(), image: image || '' });

        res.json({ success: true, news: news });
    } catch (err) {
        next(err);
    }
});

router.put('/news/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, content, image } = req.body;

        const newsService = require('../services/newsService');
        const existing = newsService.getNews(id);
        if (!existing) {
            return res.json({ success: false, error: 'Новость не найдена' });
        }

        const updates = {};
        if (title !== undefined) updates.title = title.trim();
        if (content !== undefined) updates.content = content.trim();
        if (image !== undefined) updates.image = image;

        const updated = newsService.updateNews(id, updates);
        res.json({ success: true, news: updated });
    } catch (err) {
        next(err);
    }
});

router.delete('/news/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const newsService = require('../services/newsService');
        const removed = newsService.removeNews(id);
        if (!removed) {
            return res.json({ success: false, error: 'Новость не найдена' });
        }
        res.json({ success: true, message: 'Новость удалена' });
    } catch (err) {
        next(err);
    }
});

// ===== STATS =====

router.get('/stats', async (req, res, next) => {
    try {
        const stats = {
            totalUsers: statsService.getTotalUsers(),
            activeUsersLast24h: statsService.getActiveUsersLast24h(),
            totalDownloads: statsService.getTotalDownloads(),
            bannedUsers: statsService.getBannedUsers(),
            adminUsers: statsService.getAdminUsers()
        };
        res.json({ success: true, stats: stats });
    } catch (err) {
        next(err);
    }
});

// ===== BAN / UNBAN =====

router.post('/users/:id/ban', async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = userService.getUserById(id);
        if (!user) {
            return res.json({ success: false, error: 'Пользователь не найден' });
        }
        if (user.banned === 1) {
            return res.json({ success: false, error: 'Пользователь уже заблокирован' });
        }
        db.prepare('UPDATE users SET banned = 1 WHERE id = ?').run(id);
        res.json({ success: true, message: 'Пользователь заблокирован' });
    } catch (err) {
        next(err);
    }
});

router.post('/users/:id/unban', async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = userService.getUserById(id);
        if (!user) {
            return res.json({ success: false, error: 'Пользователь не найден' });
        }
        if (user.banned === 0) {
            return res.json({ success: false, error: 'Пользователь уже разблокирован' });
        }
        db.prepare('UPDATE users SET banned = 0 WHERE id = ?').run(id);
        res.json({ success: true, message: 'Пользователь разблокирован' });
    } catch (err) {
        next(err);
    }
});

// ===== FILES =====

router.get('/files', async (req, res, next) => {
    try {
        const files = await clientStorage.listFiles();
        res.json({ success: true, files: files });
    } catch (err) {
        next(err);
    }
});

router.delete('/files/:name', async (req, res, next) => {
    try {
        const name = path.basename(req.params.name);
        const usedBy = db.prepare('SELECT name, mods FROM clients_config').all().filter((client) => {
            try {
                const mods = JSON.parse(client.mods || '[]');
                return Array.isArray(mods) && mods.includes(name);
            } catch (error) {
                return false;
            }
        }).map((client) => client.name);
        if (usedBy.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Файл используется профилями: ' + usedBy.join(', '),
            });
        }
        const removed = await clientStorage.deleteFile(name);
        if (removed) {
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'Файл не найден' });
        }
    } catch (err) {
        next(err);
    }
});

// ===== UPLOAD CLIENT =====

// Стабильные имена «слотов» — по ним отдаются файлы лаунчеру.
const JAR_SLOTS = {
    'wild': 'wild.jar',
    'fabric-api': 'fabric-api.jar',
    'baritone': 'baritone.jar',
};

router.post('/upload-client', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.json({ success: false, error: 'Файл не выбран' });
        }

        const version = req.body.version || '1.0.0';
        const ext = path.extname(req.file.originalname).toLowerCase();
        const type = (req.body.type || 'wild').toLowerCase();

        // Для .jar кладём в стабильный слот или используем оригинальное имя
        if (ext === '.jar') {
            let slotName = JAR_SLOTS[type];
            if (!slotName) {
                // Если тип "custom" или просто не в списке — сохраняем с оригинальным именем
                slotName = path.basename(req.file.originalname);
            }

            const stored = await clientStorage.putFile(slotName, req.file.path);
            return res.json({
                success: true,
                message: 'Jar загружен как «' + slotName + '»',
                file: { originalName: req.file.originalname, slot: type, filename: slotName, size: stored.size, version: version }
            });
        }

        const cleanOriginalName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        const storedName = Date.now() + '-' + cleanOriginalName;
        const stored = await clientStorage.putFile(storedName, req.file.path);
        res.json({
            success: true,
            message: 'Файл загружен',
            file: {
                originalName: req.file.originalname,
                filename: stored.name,
                size: stored.size,
                version: version,
                backend: clientStorage.backend
            }
        });
    } catch (err) {
        next(err);
    } finally {
        if (req.file && req.file.path) {
            fs.promises.unlink(req.file.path).catch(() => {});
        }
    }
});

// ===== CLIENTS CONFIG (мульти-клиент) =====

const clientsConfigService = require('../services/clientsConfigService');

async function getAvailableModNames() {
    const files = await clientStorage.listFiles();
    return new Set(files.filter((file) => file.ext === '.jar').map((file) => file.name));
}

async function prepareClientConfig(data) {
    return normalizeClientConfig(data, await getAvailableModNames());
}

router.get('/clients-config', async (req, res, next) => {
    try {
        const configs = clientsConfigService.getAllConfigs();
        res.json({ success: true, clients: configs });
    } catch (err) {
        next(err);
    }
});

router.post('/clients-config', async (req, res, next) => {
    try {
        const prepared = await prepareClientConfig(req.body);
        if (prepared.errors.length > 0) {
            return res.status(400).json({ success: false, error: prepared.errors.join('; ') });
        }
        const data = prepared.value;
        if (!data.name || !data.mc_version) {
            return res.json({ success: false, error: 'Заполните название и версию Minecraft' });
        }
        const config = clientsConfigService.createConfig(data);
        res.json({ success: true, client: config });
    } catch (err) {
        next(err);
    }
});

router.put('/clients-config/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const existing = clientsConfigService.getConfigById(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Конфигурация не найдена' });
        }
        const prepared = await prepareClientConfig({ ...existing, ...req.body });
        if (prepared.errors.length > 0) {
            return res.status(400).json({ success: false, error: prepared.errors.join('; ') });
        }
        const updated = clientsConfigService.updateConfig(id, prepared.value);
        if (!updated) {
            return res.json({ success: false, error: 'Конфигурация не найдена' });
        }
        res.json({ success: true, client: updated });
    } catch (err) {
        next(err);
    }
});

router.delete('/clients-config/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const removed = clientsConfigService.deleteConfig(id);
        if (!removed) {
            return res.json({ success: false, error: 'Конфигурация не найдена' });
        }
        res.json({ success: true, message: 'Конфигурация удалена' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
