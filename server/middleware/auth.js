const jwt = require('jsonwebtoken');
const config = require('../config/config');

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Токен отсутствует' });
    }
    const token = authHeader.substring(7);
    jwt.verify(token, config.jwtSecret, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, error: 'Неверный или просроченный токен' });
        }
        req.user = user;
        next();
    });
}

module.exports = { authenticateToken };