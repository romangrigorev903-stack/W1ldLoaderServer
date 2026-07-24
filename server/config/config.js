require('dotenv').config();

const config = {
    port: parseInt(process.env.PORT, 10) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    dbPath: process.env.DB_PATH || './w1ld_auth.db',
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-in-production',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    corsOrigin: process.env.CORS_ORIGIN || '*',
    publicUrl: process.env.PUBLIC_URL || '',
    clientProjectPath: process.env.CLIENT_PROJECT_PATH || '../W1ld InteliJReady',
    launcherDistDir: process.env.LAUNCHER_DIST_DIR || '../loader/dist',
    tunnelUrlFile: process.env.TUNNEL_URL_FILE || './tunnel-url.txt',
    launcherVersionFile: process.env.LAUNCHER_VERSION_FILE || './launcher-version.json',
};

module.exports = config;