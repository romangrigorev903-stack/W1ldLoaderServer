// clientManager.js — универсальный менеджер запуска Minecraft
// Умеет запускать любую версию MC с любым загрузчиком (Fabric/Forge/Vanilla)
// и любым набором модов, используя minecraft-launcher-core (mlc)

const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');
const AdmZip = require('adm-zip');
const { Client, Authenticator } = require('minecraft-launcher-core');

// ===== ПУТИ =====
function getRoot(clientId) {
    return path.join(os.homedir(), 'AppData', 'Roaming', '.w1ld', 'clients', String(clientId));
}
function getJavaDir() {
    return path.join(os.homedir(), 'AppData', 'Roaming', '.w1ld', 'runtime');
}
function getModsDir(clientId) {
    return path.join(getRoot(clientId), 'mods');
}

// ===== ПОИСК JAVA =====
function findJavaExe() {
    const dir = getJavaDir();
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir);
    for (const e of entries) {
        const candidate = path.join(dir, e, 'bin', 'java.exe');
        if (fs.existsSync(candidate)) return candidate;
    }
    const flat = path.join(dir, 'bin', 'java.exe');
    return fs.existsSync(flat) ? flat : null;
}

// ===== СКАЧИВАНИЕ ФАЙЛА =====
function downloadFile(url, destPath, onProgress, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 6) return reject(new Error('Слишком много редиректов'));
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { timeout: 120000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                return resolve(downloadFile(res.headers.location, destPath, onProgress, redirects + 1));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error('HTTP ' + res.statusCode + ' для ' + url));
            }
            const total = parseInt(res.headers['content-length'], 10) || 0;
            let done = 0;
            const file = fs.createWriteStream(destPath);
            res.on('data', (chunk) => {
                done += chunk.length;
                if (onProgress && total) onProgress(Math.round((done / total) * 100), done, total);
            });
            res.pipe(file);
            file.on('finish', () => file.close(() => resolve(destPath)));
            file.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Таймаут загрузки ' + url)); });
    });
}

// ===== HTTP GET =====
function fetchText(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 6) return reject(new Error('Слишком много редиректов'));
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { timeout: 60000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                return resolve(fetchText(res.headers.location, redirects + 1));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error('HTTP ' + res.statusCode + ' для ' + url));
            }
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Таймаут ' + url)); });
    });
}

// ===== УСТАНОВКА JAVA 21 (если нет) =====
const JRE_URL = 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse';

async function ensureJava(onStatus) {
    let java = findJavaExe();
    if (java) return java;

    const javaDir = getJavaDir();
    fs.mkdirSync(javaDir, { recursive: true });
    const zipPath = path.join(javaDir, 'jre.zip');

    if (onStatus) onStatus('Загрузка Java 21...');
    await downloadFile(JRE_URL, zipPath, (pct) => {
        if (onStatus) onStatus('Загрузка Java 21... ' + pct + '%');
    });

    if (onStatus) onStatus('Распаковка Java...');
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(javaDir, true);
    try { fs.unlinkSync(zipPath); } catch (e) {}

    java = findJavaExe();
    if (!java) throw new Error('Java распакована, но java.exe не найден');
    return java;
}

// ===== СКАЧИВАНИЕ МОДОВ =====
async function ensureMods(clientId, mods, serverUrl, onStatus) {
    const modsDir = getModsDir(clientId);
    fs.mkdirSync(modsDir, { recursive: true });
    const base = (serverUrl || '').replace(/\/+$/, '');

    // Проверяем fabric-api отдельно: если в списке модов есть 'fabric-api' — скачиваем с Maven Fallback
    for (const modName of mods) {
        const modPath = path.join(modsDir, modName);
        if (fs.existsSync(modPath)) continue;

        if (modName === 'fabric-api.jar') {
            if (onStatus) onStatus('Загрузка Fabric API...');
            try {
                await downloadFile(base + '/api/download-fabric-api', modPath,
                    (pct) => { if (onStatus) onStatus('Загрузка Fabric API... ' + pct + '%'); });
            } catch (e) {
                // Fallback: по умолчанию не скачается — нужно передавать версию
                console.warn('[Mod] fabric-api.jar fallback failed:', e.message);
            }
        } else {
            // Для произвольных модов: serverUrl/api/download-mod?name=имя.jar
            if (onStatus) onStatus('Загрузка ' + modName + '...');
            try {
                await downloadFile(base + '/api/download-mod?name=' + encodeURIComponent(modName), modPath,
                    (pct) => { if (onStatus) onStatus('Загрузка ' + modName + '... ' + pct + '%'); });
            } catch (e) {
                console.warn('[Mod] Не удалось скачать ' + modName + ':', e.message);
            }
        }
    }
    return modsDir;
}

// ===== НИК =====
const NICK_PREFIXES = ['Vel','Kae','Drav','Nyx','Fros','Zeph','Aer','Vor','Thal','Cyr'];
const NICK_SUFFIXES = ['oric','aris','bane','eth','en','ix','on','ar','is','ax'];
function randomNick() {
    const p = NICK_PREFIXES[Math.floor(Math.random() * NICK_PREFIXES.length)];
    const s = NICK_SUFFIXES[Math.floor(Math.random() * NICK_SUFFIXES.length)];
    return p + s;
}

// ===== ЗАПУСК КЛИЕНТА ПО КОНФИГУ =====
// opts: { clientConfig, ram, serverUrl, onStatus, onLog, onClose }
// clientConfig = { id, name, mc_version, loader_type, loader_version, loader_profile_url, fabric_api_version, mods, jvm_args, default_ram }
async function launchClient(opts) {
    const config = opts.clientConfig;
    if (!config) throw new Error('Нет конфигурации клиента');

    const ram = opts.ram || config.default_ram || 1536;
    const serverUrl = opts.serverUrl || '';
    const onStatus = opts.onStatus || (() => {});
    const onLog = opts.onLog || (() => {});
    const onClose = opts.onClose || (() => {});

    const clientId = config.id || 'default';
    const root = getRoot(clientId);
    fs.mkdirSync(root, { recursive: true });

    // 1) Java
    const javaPath = await ensureJava(onStatus);

    // 2) Моды
    const mods = config.mods || [];
    if (mods.length > 0) {
        await ensureMods(clientId, mods, serverUrl, onStatus);
    }

    // 3) Профиль загрузчика
    let versionId = config.mc_version;
    const loaderType = (config.loader_type || 'fabric').toLowerCase();

    if (loaderType === 'fabric' || loaderType === 'forge' || loaderType === 'quilt') {
        let profileUrl = config.loader_profile_url;

        // Если URL не задан, формируем дефолтный для Fabric
        if (!profileUrl && loaderType === 'fabric') {
            const lv = config.loader_version || '0.19.3';
            profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${config.mc_version}/${lv}/profile/json`;
        }
        if (!profileUrl && loaderType === 'quilt') {
            const lv = config.loader_version || '0.26.0';
            profileUrl = `https://meta.quiltmc.org/v3/versions/loader/${config.mc_version}/${lv}/profile/json`;
        }

        if (profileUrl) {
            onStatus('Настройка ' + loaderType.charAt(0).toUpperCase() + loaderType.slice(1) + '...');
            try {
                const profile = await fetchText(profileUrl);
                const versionsDir = path.join(root, 'versions');
                // Парсим ID из JSON
                let parsedId = config.mc_version;
                try {
                    const parsed = JSON.parse(profile);
                    if (parsed.id) parsedId = parsed.id;
                } catch (e) {
                    // Если не JSON, используем mc_version как ID
                }
                const versionDir = path.join(versionsDir, parsedId);
                const jsonPath = path.join(versionDir, parsedId + '.json');
                if (!fs.existsSync(jsonPath)) {
                    fs.mkdirSync(versionDir, { recursive: true });
                    fs.writeFileSync(jsonPath, profile, 'utf8');
                }
                versionId = parsedId;
            } catch (e) {
                console.warn('[Launch] Failed to fetch loader profile:', e.message);
                // Продолжаем с vanilla
            }
        }
    }

    // 4) JVM аргументы
    const customJvmArgs = config.jvm_args || [];

    // 5) Запуск
    onStatus('Загрузка Minecraft...');
    const launcher = new Client();

    const auth = Authenticator.getAuth(randomNick());

    const maxSockets = 32;

    const launchOpts = {
        authorization: auth,
        root: root,
        version: {
            number: config.mc_version,
            type: 'release',
            custom: versionId,
        },
        memory: {
            max: String(ram) + 'M',
            min: String(Math.floor(ram / 2)) + 'M',
        },
        javaPath: javaPath,
        overrides: {
            gameDirectory: root,
            maxSockets: maxSockets,
        },
    };

    // Добавляем кастомные JVM аргументы
    if (customJvmArgs.length > 0) {
        launchOpts.javaArgs = customJvmArgs;
    }

    const TYPE_NAMES = {
        assets: 'ресурсов',
        'asset-json': 'списка ресурсов',
        'version-jar': 'ядра Minecraft',
        natives: 'нативных библиотек',
        classes: 'библиотек',
        'classes-maven-custom': 'библиотек модов',
    };

    let gameStarted = false;

    launcher.on('debug', (e) => {
        const s = (e && e.toString) ? e.toString() : String(e);
        if (!gameStarted && s.indexOf('Launching with arguments') !== -1) {
            onStatus('Запуск Minecraft... окно откроется через 10-15 секунд');
        }
        onLog(e);
    });

    launcher.on('data', (e) => {
        if (!gameStarted) {
            gameStarted = true;
            onStatus('Minecraft запущен ✓');
        }
        onLog(e);
    });

    launcher.on('progress', (e) => {
        if (e.type && e.task !== undefined && e.total !== undefined) {
            const pct = Math.round((e.task / e.total) * 100);
            const label = TYPE_NAMES[e.type] || e.type;
            onStatus(pct >= 100 ? 'Подготовка к запуску...' : 'Загрузка ' + label + '... ' + pct + '%');
        }
    });

    launcher.on('close', (code) => onClose(code));

    onStatus('Подготовка Minecraft...');
    await launcher.launch(launchOpts);
}

module.exports = { launchClient, ensureJava, randomNick, getRoot, getModsDir };