const assert = require('node:assert/strict');
const test = require('node:test');

process.env.DB_PATH = ':memory:';
const newsService = require('../server/services/newsService');

test('news is persisted through the SQLite news service', () => {
    const created = newsService.createNews({ title: 'Release', content: 'Ready', image: 'image.png' });
    assert.equal(newsService.getNews(created.id).title, 'Release');
    assert.equal(newsService.getNews().length, 1);

    const updated = newsService.updateNews(created.id, { content: 'Published' });
    assert.equal(updated.content, 'Published');
    assert.equal(newsService.getNews(created.id).content, 'Published');

    assert.equal(newsService.removeNews(created.id), true);
    assert.equal(newsService.getNews(created.id), null);
});
