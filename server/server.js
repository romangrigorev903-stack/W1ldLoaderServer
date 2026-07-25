const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const config = require('./config/config');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const db = require('./database/db');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const { hashPassword, getUserByUsername, createUser } = require('./services/userService');

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

// --- Главная страница (Лендинг) ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/landing.html'));
});

// --- Routes ---
app.use('/api', authRoutes);
app.use('/api', apiRoutes);
app.use('/api', adminRoutes);

// --- Health check ---
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

async function seedAdminUser() {
  // Гарантирует наличие админ-аккаунта после каждого запуска (важно для Render:
  // на бесплатном плане файловая система эфемерна и БД сбрасывается при редеплое).
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'w1ld_admin_2026';
  try {
    const existing = getUserByUsername(username);
    if (existing) {
      logger.info(`Админ-аккаунт "${username}" уже существует`);
      return;
    }
    const hashed = await hashPassword(password);
    createUser(username, hashed, 1);
    logger.info(`Создан админ-аккаунт по умолчанию: "${username}"`);
  } catch (error) {
    logger.error(`Не удалось создать админ-аккаунт: ${error.message}`);
  }
}

async function startServer() {
  try {
    await seedAdminUser();
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