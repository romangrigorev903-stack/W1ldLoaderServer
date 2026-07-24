const winston = require('winston');
const path = require('path');

const logDir = path.join(__dirname, '..', '..', 'logs');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
            return '[' + timestamp + '] ' + level.toUpperCase() + ': ' + message + metaStr;
        })
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'HH:mm:ss' }),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
                    return '[' + timestamp + '] ' + level + ': ' + message + metaStr;
                })
            )
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'app.log'),
            maxsize: 5242880,
            maxFiles: 5,
            tailable: true
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5,
            tailable: true
        })
    ]
});

module.exports = logger;