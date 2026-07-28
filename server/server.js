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
const { authenticateToken } = require('./middleware/auth');
const { requireAdmin } = require('./middleware/admin');
const { hashPassword, verifyPassword, getUserByUsername, createUser, updateUser } = require('./services/userService');
const clientStorage = require('./services/clientStorageService');

const app = express();

// --- Middleware ---
// CSP по умолчанию у Helmet блокирует инлайновые <script> (script-src 'self'),
// а все страницы в public/ используют инлайновый JS — из-за этого кнопки не работали.
// Разрешаем инлайн-скрипты, остальные защиты Helmet оставляем.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", "'unsafe-inline'"],
      'script-src-attr': ["'unsafe-inline'"],
    },
  },
}));
app.use(cors({ origin: config.corsOrigin || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// --- Rate Limit (общий) ---
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs || 15 * 60 * 1000,
  max: config.rateLimitMax || 100,
  message: { error: 'Слишком много запросов, попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// --- Rate Limit для логина (отдельно, чтобы брутфорс не блокировал весь сайт) ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 20, // максимум 20 попыток за 15 минут
  message: { success: false, error: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/login', loginLimiter);
app.use('/api/register', loginLimiter);

// --- Static files ---
if (config.launcherDistDir && fs.existsSync(config.launcherDistDir)) {
  app.use(express.static(config.launcherDistDir));
}

// --- Static: публичный сайт (регистрация, вход, админка) ---
// index:false — чтобы запрос на "/" не отдавал автоматически index.html,
// а попадал в явный маршрут ниже (лендинг).
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir, { index: false }));

// --- Главная страница (Лендинг) ---
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'landing.html'));
});

// --- Удобные адреса страниц ---
app.get(['/register', '/login', '/auth'], (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

// --- Routes ---
app.use('/api', authRoutes);
app.use('/api', apiRoutes);
// Админ-роуты монтируются на /api/admin (совпадает с путями фронта admin.js:
// он зовёт /api/admin/users, /api/admin/stats и т.д.) и закрыты авторизацией:
// сперва проверяется валидный JWT (authenticateToken), затем флаг is_admin (requireAdmin).
// Раньше роутер висел на /api БЕЗ защиты — любой мог заливать jar и управлять юзерами.
app.use('/api/admin', authenticateToken, requireAdmin, adminRoutes);

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

// Проверка секретов перед стартом. JWT-секрет по умолчанию ('change-me-in-production')
// означает, что кто угодно может подписать токен с is_admin:1 и обойти всю авторизацию
// админки — тогда Fix с authenticateToken/requireAdmin бесполезен. Аналогично дефолтный
// пароль админа известен из исходников. В production это фатально — сервер не стартует,
// пока в окружении (Render → Environment) не заданы JWT_SECRET, JWT_REFRESH_SECRET и ADMIN_PASSWORD.
function checkSecrets() {
  const isProd = (process.env.NODE_ENV === 'production');
  const problems = [];
  if (config.jwtSecret === 'change-me-in-production') problems.push('JWT_SECRET не задан (используется дефолт)');
  if (config.jwtRefreshSecret === 'change-me-in-production') problems.push('JWT_REFRESH_SECRET не задан (используется дефолт)');
  if (!process.env.ADMIN_PASSWORD) problems.push('ADMIN_PASSWORD не задан (используется дефолтный пароль админа)');
  if (/^(1|true|yes)$/i.test(process.env.REQUIRE_S3 || '') && clientStorage.backend !== 's3') {
    problems.push('REQUIRE_S3 включён, но S3 настроен не полностью');
  }
  if (problems.length === 0) return;

  if (isProd) {
    logger.error('НЕБЕЗОПАСНАЯ КОНФИГУРАЦИЯ, старт запрещён:\n  - ' + problems.join('\n  - '));
    logger.error('Задайте обязательные переменные окружения и передеплойте сервер.');
    process.exit(1);
  } else {
    logger.warn('Небезопасные секреты по умолчанию (ОК для локальной разработки):\n  - ' + problems.join('\n  - '));
  }
}

async function seedAdminUser() {
  // Гарантирует наличие и актуальные production-данные админ-аккаунта.
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'w1ld_admin_2026';
  try {
    const existing = getUserByUsername(username);
    if (existing) {
      const updates = {};
      if (existing.is_admin !== 1) updates.is_admin = 1;
      if (process.env.ADMIN_PASSWORD && !(await verifyPassword(password, existing.password))) {
        updates.password = await hashPassword(password);
      }
      if (Object.keys(updates).length > 0) updateUser(existing.id, updates);
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

function startKeepAlive() {
  // Self-ping: не даём Render заснуть (подстраховка к внешнему монитору UptimeRobot).
  // Включается только если задана переменная окружения SELF_PING_URL.
  const url = process.env.SELF_PING_URL;
  if (!url) return;

  const https = require('https');
  const http = require('http');
  const client = url.startsWith('https') ? https : http;
  const target = url.replace(/\/$/, '') + '/health';
  const intervalMs = 13 * 60 * 1000; // каждые 13 минут (< 15 мин таймаута Render)

  setInterval(() => {
    const req = client.get(target, (res) => {
      res.resume(); // сбрасываем тело ответа
      logger.info(`Keep-alive ping: ${res.statusCode}`);
    });
    req.on('error', (err) => logger.warn(`Keep-alive ping failed: ${err.message}`));
    req.setTimeout(15000, () => req.destroy());
  }, intervalMs);

  logger.info(`Keep-alive включён: ${target} каждые 13 мин`);
}

async function startServer() {
  try {
    checkSecrets();
    await seedAdminUser();
    logger.info('База данных готова к работе');
    logger.info(`Хранилище клиентских файлов: ${clientStorage.backend}`);

    server = app.listen(config.port || 3000, () => {
      logger.info(`W1ld Auth Server v2.0.0 started on port ${config.port || 3000}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      startKeepAlive();
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
