function errorHandler(err, req, res, next) {
    console.error('[Error]', err.message);
    console.error(err.stack);

    const parseErrors = ['entity.parse.failed', 'entity.too.large', 'encoding.unsupported'];
    if (parseErrors.includes(err.type) || err.status === 400) {
        return res.status(400).json({ success: false, error: 'Неверный формат запроса' });
    }

    const statusCode = err.statusCode || err.status || 500;
    const message = statusCode === 500 ? 'Внутренняя ошибка сервера' : err.message;

    res.status(statusCode).json({ success: false, error: message });
}

module.exports = errorHandler;