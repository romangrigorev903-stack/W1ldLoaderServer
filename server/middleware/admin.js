const config = require('../config/config');

function requireAdmin(req, res, next) {
    if (!req.user || req.user.is_admin !== 1) {
        return res.status(403).json({ success: false, error: 'Недостаточно прав' });
    }
    next();
}

module.exports = { requireAdmin };