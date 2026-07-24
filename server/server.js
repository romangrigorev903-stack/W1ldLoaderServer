const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const config = require('./config/config');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const db = require('./database/db'); // Убедись, что путь к твоему файлу БД верный (db.js или database.js)
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();

// --- Middleware ---
app.use(helmet());
app.use(cors(config.corsOptions || { origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// --- Rate Limit ---
const limiter = rateLimit({
  windowMs: config.rateLimitWindow || 15 * 60 * 1000,
  max: config.rateLimitMax || 100,
  message: { error: 'Слишком много запросов, попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// --- Static files ---
if (config.launcherDistDir && fs.existsSync(config.launcherDistDir)) {
  app.use(express.static(config.launcherDistDir));
}

// --- Routes ---
app.use('/api', authRoutes);
app.use('/api', apiRoutes);
app.use('/api', adminRoutes);

// --- Health check (НОВАЯ ФУНКЦИЯ) ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ error: 'Эндпоинт не найден' });
});

// --- Error handler ---
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({
    error: err.message || 'Внутренняя ошибка сервера'
  });
});

// --- Start server ---
let server;

async function startServer() {
  try {
    // Если твоя БД инициализируется иначе, оставь свой код инициализации здесь
    logger.info('База данных готова к работе');

    server = app.listen(config.port || 3000, () => {
      logger.info(`W1ld Auth Server v2.0.0 started on port ${config.port || 3000}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Ошибка при запуске сервера:', error);
    process.exit(1);
  }
}

// --- Graceful Shutdown ---
function gracefulShutdown(signal) {
  logger.info(`Получен сигнал ${signal}. Начинаю graceful shutdown...`);
  if (server) {
    server.close(async () => {
      logger.info('HTTP-сервер остановлен');
      logger.info('Graceful shutdown завершён успешно');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Не удалось остановить сервер вовремя. Принудительный выход.');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// --- Start ---
startServer();

module.exports = app;