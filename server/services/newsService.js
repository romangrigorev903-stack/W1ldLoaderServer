const fs = require('fs');
const path = require('path');
const db = require('../database/db');

function resolveNewsDir() {
    const newsDir = path.join(__dirname, '..', '..', 'storage', 'news');
    if (!fs.existsSync(newsDir)) {
        fs.mkdirSync(newsDir, { recursive: true });
    }
    return newsDir;
}

function migrateLegacyNews() {
    const newsDir = resolveNewsDir();
    const insert = db.prepare(`
        INSERT OR IGNORE INTO news (id, title, content, timestamp, image)
        VALUES (?, ?, ?, ?, ?)
    `);
    for (const file of fs.readdirSync(newsDir).filter((name) => name.endsWith('.json'))) {
        try {
            const item = JSON.parse(fs.readFileSync(path.join(newsDir, file), 'utf8'));
            const id = String(item.id || path.basename(file, '.json'));
            insert.run(id, item.title || '', item.content || '', item.timestamp || new Date().toISOString(), item.image || '');
        } catch (error) {
            // Keep malformed legacy files untouched so they can be inspected manually.
        }
    }
}

migrateLegacyNews();

function createNews(data) {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const news = {
        id: id,
        title: data.title || '',
        content: data.content || '',
        timestamp: new Date().toISOString(),
        image: data.image || ''
    };
    db.prepare('INSERT INTO news (id, title, content, timestamp, image) VALUES (?, ?, ?, ?, ?)').run(
        news.id, news.title, news.content, news.timestamp, news.image
    );
    return news;
}

function getNews(id) {
    if (id) {
        return db.prepare('SELECT id, title, content, timestamp, image FROM news WHERE id = ?').get(id) || null;
    }
    return db.prepare('SELECT id, title, content, timestamp, image FROM news ORDER BY timestamp DESC').all();
}

function updateNews(id, data) {
    const existing = getNews(id);
    if (!existing) return null;
    const updated = {
        id: id,
        title: data.title !== undefined ? data.title : existing.title,
        content: data.content !== undefined ? data.content : existing.content,
        timestamp: existing.timestamp,
        image: data.image !== undefined ? data.image : existing.image
    };
    db.prepare('UPDATE news SET title = ?, content = ?, image = ? WHERE id = ?').run(
        updated.title, updated.content, updated.image, id
    );
    return updated;
}

function removeNews(id) {
    return db.prepare('DELETE FROM news WHERE id = ?').run(id).changes > 0;
}

module.exports = { createNews, getNews, updateNews, removeNews };
