const db = require('./server/database/db');

const username = 'admin';

const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

if (!user) {
    console.log('Ошибка: пользователь "' + username + '" не найден в базе данных.');
    process.exit(1);
}

if (user.is_admin === 1) {
    console.log('Пользователь "' + username + '" уже является администратором.');
    process.exit(0);
}

db.prepare('UPDATE users SET is_admin = 1 WHERE username = ?').run(username);

const updated = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

if (updated && updated.is_admin === 1) {
    console.log('Успех: пользователь ' + username + ' теперь администратор!');
} else {
    console.log('Ошибка: не удалось обновить is_admin для пользователя "' + username + '".');
    process.exit(1);
}