const db = require('../database/db');

function getAllConfigs(onlyActive = false) {
    let query = 'SELECT * FROM clients_config';
    if (onlyActive) query += ' WHERE is_active = 1';
    query += ' ORDER BY id DESC';
    const rows = db.prepare(query).all();
    return rows.map(row => ({
        ...row,
        mods: JSON.parse(row.mods || '[]'),
        jvm_args: JSON.parse(row.jvm_args || '[]'),
    }));
}

function getConfigById(id) {
    const row = db.prepare('SELECT * FROM clients_config WHERE id = ?').get(id);
    if (!row) return null;
    return {
        ...row,
        mods: JSON.parse(row.mods || '[]'),
        jvm_args: JSON.parse(row.jvm_args || '[]'),
    };
}

function createConfig(data) {
    const result = db.prepare(`INSERT INTO clients_config 
        (name, description, mc_version, loader_type, loader_version, loader_profile_url, fabric_api_version, mods, jvm_args, default_ram, banner_url, is_active, is_beta, is_premium) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        data.name,
        data.description || '',
        data.mc_version,
        data.loader_type || 'fabric',
        data.loader_version || '',
        data.loader_profile_url || '',
        data.fabric_api_version || '',
        JSON.stringify(data.mods || []),
        JSON.stringify(data.jvm_args || []),
        data.default_ram || 1536,
        data.banner_url || '',
        data.is_active ? 1 : 0,
        data.is_beta ? 1 : 0,
        data.is_premium ? 1 : 0,
    );
    return getConfigById(result.lastInsertRowid);
}

function updateConfig(id, data) {
    const existing = getConfigById(id);
    if (!existing) return null;

    const updates = [];
    const params = [];

    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }
    if (data.mc_version !== undefined) { updates.push('mc_version = ?'); params.push(data.mc_version); }
    if (data.loader_type !== undefined) { updates.push('loader_type = ?'); params.push(data.loader_type); }
    if (data.loader_version !== undefined) { updates.push('loader_version = ?'); params.push(data.loader_version); }
    if (data.loader_profile_url !== undefined) { updates.push('loader_profile_url = ?'); params.push(data.loader_profile_url); }
    if (data.fabric_api_version !== undefined) { updates.push('fabric_api_version = ?'); params.push(data.fabric_api_version); }
    if (data.mods !== undefined) { updates.push('mods = ?'); params.push(JSON.stringify(data.mods)); }
    if (data.jvm_args !== undefined) { updates.push('jvm_args = ?'); params.push(JSON.stringify(data.jvm_args)); }
    if (data.default_ram !== undefined) { updates.push('default_ram = ?'); params.push(data.default_ram); }
    if (data.banner_url !== undefined) { updates.push('banner_url = ?'); params.push(data.banner_url); }
    if (data.is_active !== undefined) { updates.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }
    if (data.is_beta !== undefined) { updates.push('is_beta = ?'); params.push(data.is_beta ? 1 : 0); }
    if (data.is_premium !== undefined) { updates.push('is_premium = ?'); params.push(data.is_premium ? 1 : 0); }

    if (updates.length === 0) return existing;

    params.push(id);
    db.prepare(`UPDATE clients_config SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return getConfigById(id);
}

function deleteConfig(id) {
    const existing = getConfigById(id);
    if (!existing) return false;
    db.prepare('DELETE FROM clients_config WHERE id = ?').run(id);
    return true;
}

module.exports = { getAllConfigs, getConfigById, createConfig, updateConfig, deleteConfig };