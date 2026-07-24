const fs = require('fs');
const path = require('path');
const config = require('../config/config');

function resolveNewsDir() {
    const newsDir = path.join(__dirname, '..', '..', 'storage', 'news');
    if (!fs.existsSync(newsDir)) {
        fs.mkdirSync(newsDir, { recursive: true });
    }
    return newsDir;
}

function getNewsFilePath(id) {
    return path.join(resolveNewsDir(), id + '.json');
}

function getAllNewsFiles() {
    const newsDir = resolveNewsDir();
    if (!fs.existsSync(newsDir)) return [];
    return fs.readdirSync(newsDir).filter(f => f.endsWith('.json'));
}

function readNewsFile(id) {
    const filePath = getNewsFilePath(id);
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        return null;
    }
}

function writeNewsFile(id, data) {
    const filePath = getNewsFilePath(id);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function deleteNewsFile(id) {
    const filePath = getNewsFilePath(id);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

function createNews(data) {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const news = {
        id: id,
        title: data.title || '',
        content: data.content || '',
        timestamp: new Date().toISOString(),
        image: data.image || ''
    };
    writeNewsFile(id, news);
    return news;
}

function getNews(id) {
    if (id) {
        return readNewsFile(id);
    }
    const files = getAllNewsFiles();
    const news = [];
    for (const file of files) {
        const item = readNewsFile(path.basename(file, '.json'));
        if (item) news.push(item);
    }
    news.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return news;
}

function updateNews(id, data) {
    const existing = readNewsFile(id);
    if (!existing) return null;
    const updated = {
        id: id,
        title: data.title !== undefined ? data.title : existing.title,
        content: data.content !== undefined ? data.content : existing.content,
        timestamp: existing.timestamp,
        image: data.image !== undefined ? data.image : existing.image
    };
    writeNewsFile(id, updated);
    return updated;
}

function removeNews(id) {
    const existing = readNewsFile(id);
    if (!existing) return false;
    deleteNewsFile(id);
    return true;
}

module.exports = { createNews, getNews, updateNews, removeNews };