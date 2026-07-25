const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const userService = require('../services/userService');
const statsService = require('../services/statsService');
const upload = require('../middleware/upload');

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

        // Для .jar кладём в стабильный слот (wild/fabric-api/baritone), чтобы лаунчер тянул по фикс-имени.
        if (ext === '.jar') {
            const type = (req.body.type || 'wild').toLowerCase();
            const slotName = JAR_SLOTS[type];
            if (!slotName) {
                try { fs.unlinkSync(req.file.path); } catch (e) {}
                return res.json({ success: false, error: 'Неизвестный тип jar: ' + type });
            }
            const dir = path.join(__dirname, '..', '..', 'storage', 'clients');
            const slotPath = path.join(dir, slotName);
            try {
                fs.copyFileSync(req.file.path, slotPath);
                fs.unlinkSync(req.file.path);
            } catch (e) {
                return res.json({ success: false, error: 'Ошибка сохранения: ' + e.message });
            }
            return res.json({
                success: true,
                message: 'Jar загружен в слот «' + type + '»',
                file: { originalName: req.file.originalname, slot: type, filename: slotName, size: req.file.size, version: version }
            });
        }

        res.json({
            success: true,
            message: 'Файл загружен',
            file: {
                originalName: req.file.originalname,
                filename: req.file.filename,
                size: req.file.size,
                version: version,
                path: req.file.path
            }
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;