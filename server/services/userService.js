const bcrypt = require('bcryptjs');
const db = require('../database/db');

const SALT_ROUNDS = 10;

async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

function getUserById(id) {
    return db.prepare('SELECT id, username, hwid, banned, subscription_until, is_admin, created_at FROM users WHERE id = ?').get(id);
}

function getUserByUsername(username) {
    return db.prepare('SELECT id, username, password, hwid, banned, subscription_until, is_admin, created_at FROM users WHERE username = ?').get(username);
}

function getAllUsers() {
    return db.prepare('SELECT id, username, hwid, banned, subscription_until, is_admin, created_at FROM users ORDER BY id DESC').all();
}

function createUser(username, hashedPassword, isAdmin = 0) {
    const result = db.prepare('INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)').run(username, hashedPassword, isAdmin);
    return { id: result.lastInsertRowid, username, isAdmin };
}

function updateUser(id, updates) {
    const user = getUserById(id);
    if (!user) return null;

    const setClauses = [];
    const params = [];

    if (updates.username !== undefined && updates.username !== user.username) {
        setClauses.push('username = ?');
        params.push(updates.username);
    }
    if (updates.password !== undefined) {
        setClauses.push('password = ?');
        params.push(updates.password);
    }
    if (updates.banned !== undefined && updates.banned !== user.banned) {
        setClauses.push('banned = ?');
        params.push(updates.banned ? 1 : 0);
    }
    if (updates.is_admin !== undefined && updates.is_admin !== user.is_admin) {
        setClauses.push('is_admin = ?');
        params.push(updates.is_admin ? 1 : 0);
    }
    if (updates.subscription_until !== undefined && updates.subscription_until !== user.subscription_until) {
        setClauses.push('subscription_until = ?');
        params.push(updates.subscription_until || 'infinity');
    }

    if (setClauses.length === 0) return user;

    params.push(id);
    db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
    return getUserById(id);
}

function deleteUser(id) {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

module.exports = { hashPassword, verifyPassword, getUserById, getUserByUsername, getAllUsers, createUser, updateUser, deleteUser };