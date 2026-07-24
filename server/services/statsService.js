const db = require('../database/db');

function getTotalUsers() {
    return db.prepare('SELECT COUNT(*) as count FROM users').get().count;
}

function getActiveUsersLast24h() {
    return db.prepare("SELECT COUNT(*) as count FROM users WHERE created_at >= datetime('now', '-24 hours')").get().count;
}

function getTotalDownloads() {
    const downloads = db.prepare("SELECT COUNT(*) as count FROM users WHERE created_at IS NOT NULL").get();
    return downloads ? downloads.count : 0;
}

function getBannedUsers() {
    return db.prepare('SELECT COUNT(*) as count FROM users WHERE banned = 1').get().count;
}

function getAdminUsers() {
    return db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get().count;
}

module.exports = { getTotalUsers, getActiveUsersLast24h, getTotalDownloads, getBannedUsers, getAdminUsers };