const path = require('path');

const SUPPORTED_JAVA_MAJORS = new Set([8, 17, 21]);

function parseMinecraftVersion(value) {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
    if (!match) return null;
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3] || 0),
    };
}

function compareVersions(left, right) {
    for (const key of ['major', 'minor', 'patch']) {
        if (left[key] !== right[key]) return left[key] - right[key];
    }
    return 0;
}

function normalizeJavaMajor(value) {
    if (value === undefined || value === null || value === '' || value === 'auto') return null;
    const parsed = Number(value);
    return SUPPORTED_JAVA_MAJORS.has(parsed) ? parsed : NaN;
}

function resolveJavaMajor(mcVersion, configuredJavaMajor) {
    const explicit = normalizeJavaMajor(configuredJavaMajor);
    if (SUPPORTED_JAVA_MAJORS.has(explicit)) return explicit;

    const parsed = parseMinecraftVersion(mcVersion);
    if (!parsed) return 21;
    if (parsed.major === 1 && parsed.minor <= 16) return 8;
    if (parsed.major === 1 && (parsed.minor < 20 || (parsed.minor === 20 && parsed.patch <= 4))) return 17;
    return 21;
}

function normalizeArray(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeClientConfig(data, availableMods) {
    const source = data || {};
    const errors = [];
    const name = typeof source.name === 'string' ? source.name.trim() : '';
    const mcVersion = typeof source.mc_version === 'string' ? source.mc_version.trim() : '';
    const parsedVersion = parseMinecraftVersion(mcVersion);
    const loaderType = String(source.loader_type || 'fabric').trim().toLowerCase();
    const loaderVersion = typeof source.loader_version === 'string' ? source.loader_version.trim() : '';
    const javaMajor = normalizeJavaMajor(source.java_major);

    if (!name) errors.push('Название клиента обязательно');
    if (!parsedVersion) {
        errors.push('Версия Minecraft должна иметь формат 1.16.5');
    } else if (compareVersions(parsedVersion, { major: 1, minor: 16, patch: 5 }) < 0) {
        errors.push('Поддерживаются версии Minecraft 1.16.5 и новее');
    }
    if (loaderType !== 'fabric') errors.push('На этом этапе поддерживается только Fabric');
    if (!loaderVersion) errors.push('Версия Fabric Loader обязательна');
    if (Number.isNaN(javaMajor)) errors.push('Java должна быть auto, 8, 17 или 21');

    const mods = [];
    const seenMods = new Set();
    for (const modName of normalizeArray(source.mods)) {
        const safeName = path.basename(modName);
        if (safeName !== modName || path.extname(safeName).toLowerCase() !== '.jar') {
            errors.push(`Недопустимое имя мода: ${modName}`);
            continue;
        }
        if (seenMods.has(safeName)) continue;
        if (availableMods && !availableMods.has(safeName)) {
            errors.push(`Файл мода не найден: ${safeName}`);
            continue;
        }
        seenMods.add(safeName);
        mods.push(safeName);
    }

    const jvmArgs = normalizeArray(source.jvm_args);
    const defaultRam = Number.parseInt(source.default_ram, 10) || 1536;
    if (defaultRam < 512 || defaultRam > 16384) {
        errors.push('Оперативная память должна быть от 512 до 16384 МБ');
    }

    return {
        errors,
        value: {
            name,
            description: typeof source.description === 'string' ? source.description.trim() : '',
            mc_version: mcVersion,
            loader_type: 'fabric',
            loader_version: loaderVersion,
            loader_profile_url: typeof source.loader_profile_url === 'string' ? source.loader_profile_url.trim() : '',
            fabric_api_version: typeof source.fabric_api_version === 'string' ? source.fabric_api_version.trim() : '',
            java_major: javaMajor,
            mods,
            jvm_args: jvmArgs,
            default_ram: defaultRam,
            banner_url: typeof source.banner_url === 'string' ? source.banner_url.trim() : '',
            is_active: Boolean(source.is_active),
            is_beta: Boolean(source.is_beta),
            is_premium: Boolean(source.is_premium),
        },
    };
}

module.exports = {
    compareVersions,
    normalizeClientConfig,
    normalizeJavaMajor,
    parseMinecraftVersion,
    resolveJavaMajor,
};
