const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/config');
const userService = require('../services/userService');

function generateToken(user) {
    const payload = {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        sub: 'access',
    };
    return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function generateRefreshToken(user) {
    const payload = {
        id: user.id,
        username: user.username,
        sub: 'refresh',
    };
    return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn });
}

router.post('/register', async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.json({ success: false, error: 'Заполните все поля' });
        }
        if (username.length < 3) {
            return res.json({ success: false, error: 'Логин минимум 3 символа' });
        }
        if (password.length < 4) {
            return res.json({ success: false, error: 'Пароль минимум 4 символа' });
        }

        const existing = userService.getUserByUsername(username);
        if (existing) {
            return res.json({ success: false, error: 'Логин уже занят' });
        }

        const hashedPassword = await userService.hashPassword(password);
        const user = userService.createUser(username, hashedPassword, 0);

        res.json({ success: true, message: 'Аккаунт создан' });
    } catch (err) {
        next(err);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const { username, password, hwid } = req.body;

        if (!username || !password) {
            return res.json({ success: false, error: 'Заполните все поля' });
        }

        const user = userService.getUserByUsername(username);
        if (!user) {
            return res.json({ success: false, error: 'Неверный логин или пароль' });
        }

        if (user.banned) {
            return res.json({ success: false, error: 'Аккаунт заблокирован' });
        }

        const validPassword = await userService.verifyPassword(password, user.password);
        if (!validPassword) {
            return res.json({ success: false, error: 'Неверный логин или пароль' });
        }

        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        res.json({
            success: true,
            token: token,
            refreshToken: refreshToken,
            user: {
                id: user.id,
                username: user.username,
                group: user.is_admin === 1 ? 'Администратор' : 'Пользователь',
                subscription: user.subscription_until,
            }
        });
    } catch (err) {
        next(err);
    }
});

router.get('/profile/:username', async (req, res, next) => {
    try {
        const user = userService.getUserByUsername(req.params.username);
        if (!user) {
            return res.json({ success: false, error: 'Пользователь не найден' });
        }
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                group: user.is_admin === 1 ? 'Администратор' : 'Пользователь',
                subscription: user.subscription_until,
                banned: user.banned,
                created: user.created_at,
            }
        });
    } catch (err) {
        next(err);
    }
});

router.post('/change-password', async (req, res, next) => {
    try {
        const { username, oldPassword, newPassword } = req.body;
        if (!username || !oldPassword || !newPassword) {
            return res.json({ success: false, error: 'Заполните все поля' });
        }
        if (newPassword.length < 4) {
            return res.json({ success: false, error: 'Новый пароль минимум 4 символа' });
        }

        const user = userService.getUserByUsername(username);
        if (!user) {
            return res.json({ success: false, error: 'Пользователь не найден' });
        }

        const validPassword = await userService.verifyPassword(oldPassword, user.password);
        if (!validPassword) {
            return res.json({ success: false, error: 'Старый пароль неверный' });
        }

        const hashedPassword = await userService.hashPassword(newPassword);
        userService.updateUser(user.id, { password: hashedPassword });

        res.json({ success: true, message: 'Пароль изменён' });
    } catch (err) {
        next(err);
    }
});

router.post('/delete-account', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.json({ success: false, error: 'Заполните все поля' });
        }

        const user = userService.getUserByUsername(username);
        if (!user) {
            return res.json({ success: false, error: 'Пользователь не найден' });
        }

        const validPassword = await userService.verifyPassword(password, user.password);
        if (!validPassword) {
            return res.json({ success: false, error: 'Пароль неверный' });
        }

        userService.deleteUser(user.id);
        res.json({ success: true, message: 'Аккаунт удалён' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;