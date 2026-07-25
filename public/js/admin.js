(function() {
    var token = localStorage.getItem('w1ld_admin_token') || '';
    var adminUrl = (localStorage.getItem('auth_server') || '').replace(/\/+$/, '');
    var editingNews = null, editingClient = null, editingButton = null;

    function api(path, opts) {
        return fetch(adminUrl + path, Object.assign({ headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } }, opts));
    }

    function toast(text, type) {
        var el = document.getElementById('toast');
        el.textContent = text;
        el.className = 'toast ' + (type || 'success') + ' show';
        setTimeout(function() { el.className = 'toast'; }, 3000);
    }

    function showMsg(id, text, type) {
        var el = document.getElementById(id);
        if (!el) return;
        el.textContent = text;
        el.className = 'msg ' + type;
        setTimeout(function() { if (el) el.className = 'msg'; }, 5000);
    }

    function esc(t) { return (t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    // ===== LOGIN =====
    var loginBtn = document.getElementById('adminLoginBtn');
    if (loginBtn) {
        loginBtn.setAttribute('data-original-text', 'Войти');
        loginBtn.addEventListener('click', function() {
            var u = document.getElementById('adminUsername').value.trim();
            var p = document.getElementById('adminPassword').value.trim();
            if (!u || !p) { showMsg('loginMsg', 'Введите логин и пароль', 'error'); return; }
            loginBtn.disabled = true; loginBtn.textContent = '...';
            fetch(adminUrl + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) })
                .then(function(r) { return r.json(); })
                .then(function(d) {
                    loginBtn.disabled = false; loginBtn.textContent = 'Войти';
                    if (d.success) {
                        token = d.token;
                        localStorage.setItem('w1ld_admin_token', token);
                        showDashboard(u);
                    } else { showMsg('loginMsg', d.error || 'Ошибка входа', 'error'); }
                }).catch(function() { loginBtn.disabled = false; loginBtn.textContent = 'Войти'; showMsg('loginMsg', 'Сервер недоступен', 'error'); });
        });
        document.getElementById('adminPassword').addEventListener('keydown', function(e) { if (e.key === 'Enter') loginBtn.click(); });
    }

    // ===== LOGOUT =====
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        token = ''; localStorage.removeItem('w1ld_admin_token');
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('dashboardScreen').style.display = 'none';
    });

    function showDashboard(username) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('dashboardScreen').style.display = 'block';
        var el = document.getElementById('adminUser');
        if (el) el.textContent = username || localStorage.getItem('launcher_username') || 'Admin';
        loadStats(); loadUsers(); loadNews(); loadClients(); loadButtons();
    }

    // Auto-login if token exists
    if (token) showDashboard();

    // ===== TABS =====
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
            document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
            btn.classList.add('active');
            var tab = document.getElementById('tab-' + btn.getAttribute('data-tab'));
            if (tab) tab.classList.add('active');
        });
    });

    // ===== STATS =====
    window.loadStats = function() {
        api('/api/admin/stats').then(function(r) { return r.json(); }).then(function(d) {
            if (!d.success || !d.stats) return;
            var s = d.stats;
            var el;
            el = document.getElementById('statTotalUsers'); if (el) el.textContent = s.totalUsers;
            el = document.getElementById('statActive24h'); if (el) el.textContent = s.activeUsersLast24h;
            el = document.getElementById('statBanned'); if (el) el.textContent = s.bannedUsers;
            el = document.getElementById('statAdmins'); if (el) el.textContent = s.adminUsers;
            el = document.getElementById('statDownloads'); if (el) el.textContent = s.totalDownloads || 0;
        }).catch(function() {});
    };

    var refreshBtn = document.getElementById('refreshStatsBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', function() { loadStats(); toast('Статистика обновлена'); });

    var healthBtn = document.getElementById('healthBtn');
    if (healthBtn) healthBtn.addEventListener('click', function() {
        showMsg('healthMsg', 'Проверяю...', 'success');
        fetch('/health').then(function(r) { return r.json(); }).then(function(d) {
            showMsg('healthMsg', '✅ Сервер работает · ' + (d.timestamp || ''), 'success');
        }).catch(function() { showMsg('healthMsg', '❌ Сервер недоступен', 'error'); });
    });

    // ===== USERS =====
    window.loadUsers = function() {
        api('/api/admin/users').then(function(r) { return r.json(); }).then(function(d) {
            if (!d.success) return;
            var tbody = document.getElementById('usersTableBody');
            if (!tbody) return;
            var search = (document.getElementById('userSearch') || {}).value || '';
            var users = (d.users || []).filter(function(u) { return !search || u.username.toLowerCase().indexOf(search.toLowerCase()) !== -1; });
            tbody.innerHTML = users.length ? users.map(function(u) {
                return '<tr>' +
                    '<td>' + u.id + '</td>' +
                    '<td><b>' + esc(u.username) + '</b></td>' +
                    '<td><span class="badge ' + (u.banned ? 'banned' : 'active') + '">' + (u.banned ? 'Забанен' : 'Активен') + '</span></td>' +
                    '<td><span class="badge ' + (u.is_admin ? 'admin' : 'user') + '">' + (u.is_admin ? 'Админ' : 'Юзер') + '</span></td>' +
                    '<td style="font-size:12px;color:#8889a0;">' + (u.subscription_until || '—') + '</td>' +
                    '<td style="display:flex;gap:6px;">' +
                    (u.banned ? '<button class="btn btn-success btn-sm" onclick="unbanUser(' + u.id + ')">Разбан</button>' : '<button class="btn btn-danger btn-sm" onclick="banUser(' + u.id + ')">Бан</button>') +
                    '<button class="btn btn-secondary btn-sm" onclick="deleteUser(' + u.id + ',\'' + esc(u.username) + '\')">Удалить</button>' +
                    '</td></tr>';
            }).join('') : '<tr><td colspan="6" style="text-align:center;color:#555770;padding:24px;">Пользователи не найдены</td></tr>';
        }).catch(function() {});
    };

    var createUserBtn = document.getElementById('createUserBtn');
    if (createUserBtn) createUserBtn.addEventListener('click', function() {
        var u = document.getElementById('newUserName').value.trim();
        var p = document.getElementById('newUserPass').value.trim();
        var isAdmin = document.getElementById('newUserAdmin').checked;
        if (!u || !p) { showMsg('createUserMsg', 'Заполните все поля', 'error'); return; }
        api('/api/admin/users', { method: 'POST', body: JSON.stringify({ username: u, password: p, is_admin: isAdmin }) })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (d.success) {
                    showMsg('createUserMsg', 'Пользователь создан', 'success');
                    document.getElementById('newUserName').value = '';
                    document.getElementById('newUserPass').value = '';
                    document.getElementById('newUserAdmin').checked = false;
                    loadUsers(); loadStats();
                } else { showMsg('createUserMsg', d.error || 'Ошибка', 'error'); }
            }).catch(function() { showMsg('createUserMsg', 'Ошибка', 'error'); });
    });

    window.banUser = function(id) {
        api('/api/admin/users/' + id + '/ban', { method: 'POST' }).then(function(r) { return r.json(); }).then(function(d) {
            toast(d.message || d.error, d.success ? 'success' : 'error'); if (d.success) { loadUsers(); loadStats(); }
        }).catch(function() {});
    };
    window.unbanUser = function(id) {
        api('/api/admin/users/' + id + '/unban', { method: 'POST' }).then(function(r) { return r.json(); }).then(function(d) {
            toast(d.message || d.error, d.success ? 'success' : 'error'); if (d.success) { loadUsers(); loadStats(); }
        }).catch(function() {});
    };
    window.deleteUser = function(id, name) {
        if (!confirm('Удалить пользователя ' + name + '?')) return;
        api('/api/admin/users/' + id, { method: 'DELETE' }).then(function(r) { return r.json(); }).then(function(d) {
            toast(d.success ? 'Пользователь удалён' : (d.error || 'Ошибка'), d.success ? 'success' : 'error');
            if (d.success) { loadUsers(); loadStats(); }
        }).catch(function() {});
    };

    var userSearch = document.getElementById('userSearch');
    if (userSearch) userSearch.addEventListener('input', loadUsers);

    // ===== NEWS =====
    window.loadNews = function() {
        api('/api/admin/news').then(function(r) { return r.json(); }).then(function(d) {
            var list = document.getElementById('newsList');
            if (!list) return;
            if (!d.success || !d.news || !d.news.length) { list.innerHTML = '<div class="empty">Новостей нет. Добавьте первую!</div>'; return; }
            list.innerHTML = d.news.map(function(n) {
                return '<div class="item-row"><div class="item-info"><h4>' + esc(n.title) + '</h4><p>' + esc((n.content||'').substring(0,80)) + (n.content && n.content.length > 80 ? '...' : '') + '</p></div>' +
                    '<div class="item-actions"><button class="btn btn-secondary btn-sm" onclick="editNews(' + JSON.stringify(n).replace(/"/g,'&quot;') + ')">✏️</button>' +
                    '<button class="btn btn-danger btn-sm" onclick="deleteNews(' + n.id + ')">🗑️</button></div></div>';
            }).join('');
        }).catch(function() {});
    };

    window.editNews = function(n) {
        editingNews = n.id;
        document.getElementById('newsTitle').value = n.title || '';
        document.getElementById('newsContent').value = n.content || '';
        document.getElementById('newsImage').value = n.image || '';
        document.getElementById('newsFormTitle').textContent = 'Редактировать новость';
        document.getElementById('saveNewsBtn').textContent = 'Сохранить';
        document.getElementById('cancelNewsBtn').style.display = 'inline-block';
    };
    window.deleteNews = function(id) {
        if (!confirm('Удалить новость?')) return;
        api('/api/admin/news/' + id, { method: 'DELETE' }).then(function(r) { return r.json(); }).then(function(d) {
            toast(d.success ? 'Новость удалена' : (d.error || 'Ошибка'), d.success ? 'success' : 'error');
            if (d.success) loadNews();
        }).catch(function() {});
    };

    var saveNewsBtn = document.getElementById('saveNewsBtn');
    if (saveNewsBtn) saveNewsBtn.addEventListener('click', function() {
        var title = document.getElementById('newsTitle').value.trim();
        var content = document.getElementById('newsContent').value.trim();
        var image = document.getElementById('newsImage').value.trim();
        if (!title || !content) { showMsg('newsMsg', 'Заполните заголовок и содержание', 'error'); return; }
        var method = editingNews ? 'PUT' : 'POST';
        var path = editingNews ? '/api/admin/news/' + editingNews : '/api/admin/news';
        api(path, { method: method, body: JSON.stringify({ title: title, content: content, image: image }) })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (d.success) {
                    showMsg('newsMsg', editingNews ? 'Новость обновлена' : 'Новость опубликована', 'success');
                    document.getElementById('newsTitle').value = '';
                    document.getElementById('newsContent').value = '';
                    document.getElementById('newsImage').value = '';
                    editingNews = null;
                    document.getElementById('newsFormTitle').textContent = 'Добавить новость';
                    document.getElementById('saveNewsBtn').textContent = 'Опубликовать';
                    document.getElementById('cancelNewsBtn').style.display = 'none';
                    loadNews();
                } else { showMsg('newsMsg', d.error || 'Ошибка', 'error'); }
            }).catch(function() { showMsg('newsMsg', 'Ошибка', 'error'); });
    });

    var cancelNewsBtn = document.getElementById('cancelNewsBtn');
    if (cancelNewsBtn) cancelNewsBtn.addEventListener('click', function() {
        editingNews = null;
        document.getElementById('newsTitle').value = '';
        document.getElementById('newsContent').value = '';
        document.getElementById('newsImage').value = '';
        document.getElementById('newsFormTitle').textContent = 'Добавить новость';
        document.getElementById('saveNewsBtn').textContent = 'Опубликовать';
        cancelNewsBtn.style.display = 'none';
    });

    // ===== CLIENTS =====
    window.loadClients = function() {
        api('/api/admin/clients').then(function(r) { return r.json(); }).then(function(d) {
            var list = document.getElementById('clientsList');
            if (!list) return;
            if (!d.success || !d.clients || !d.clients.length) { list.innerHTML = '<div class="empty">Клиентов нет.</div>'; return; }
            list.innerHTML = d.clients.map(function(c) {
                return '<div class="item-row"><div class="item-info"><h4>' + esc(c.name) + ' <span style="color:#8889a0;font-weight:400;">v' + esc(c.version) + '</span>' +
                    (c.is_active ? ' <span class="badge active" style="font-size:11px;">Активен</span>' : ' <span class="badge banned" style="font-size:11px;">Неактивен</span>') + '</h4>' +
                    '<p>' + esc((c.description||'').substring(0,80)) + '</p></div>' +
                    '<div class="item-actions"><button class="btn btn-secondary btn-sm" onclick="editClient(' + JSON.stringify(c).replace(/"/g,'&quot;') + ')">✏️</button>' +
                    '<button class="btn btn-danger btn-sm" onclick="deleteClient(' + c.id + ')">🗑️</button></div></div>';
            }).join('');
        }).catch(function() {});
    };

    window.editClient = function(c) {
        editingClient = c.id;
        document.getElementById('clientName').value = c.name || '';
        document.getElementById('clientVer').value = c.version || '';
        document.getElementById('clientDesc').value = c.description || '';
        document.getElementById('clientImg').value = c.image_url || '';
        document.getElementById('clientDl').value = c.download_url || '';
        document.getElementById('clientActive').checked = !!c.is_active;
        document.getElementById('clientFormTitle').textContent = 'Редактировать клиент';
        document.getElementById('cancelClientBtn').style.display = 'inline-block';
    };
    window.deleteClient = function(id) {
        if (!confirm('Удалить клиент?')) return;
        api('/api/admin/clients/' + id, { method: 'DELETE' }).then(function(r) { return r.json(); }).then(function(d) {
            toast(d.success ? 'Клиент удалён' : (d.error || 'Ошибка'), d.success ? 'success' : 'error');
            if (d.success) loadClients();
        }).catch(function() {});
    };

    var saveClientBtn = document.getElementById('saveClientBtn');
    if (saveClientBtn) saveClientBtn.addEventListener('click', function() {
        var name = document.getElementById('clientName').value.trim();
        var ver = document.getElementById('clientVer').value.trim();
        if (!name || !ver) { showMsg('clientMsg', 'Заполните название и версию', 'error'); return; }
        var body = { name: name, version: ver, description: document.getElementById('clientDesc').value.trim(), image_url: document.getElementById('clientImg').value.trim(), download_url: document.getElementById('clientDl').value.trim(), is_active: document.getElementById('clientActive').checked };
        var method = editingClient ? 'PUT' : 'POST';
        var path = editingClient ? '/api/admin/clients/' + editingClient : '/api/admin/clients';
        api(path, { method: method, body: JSON.stringify(body) }).then(function(r) { return r.json(); }).then(function(d) {
            if (d.success) {
                showMsg('clientMsg', 'Сохранено', 'success');
                ['clientName','clientVer','clientDesc','clientImg','clientDl'].forEach(function(id) { document.getElementById(id).value = ''; });
                document.getElementById('clientActive').checked = true;
                editingClient = null;
                document.getElementById('clientFormTitle').textContent = 'Добавить клиент';
                document.getElementById('cancelClientBtn').style.display = 'none';
                loadClients();
            } else { showMsg('clientMsg', d.error || 'Ошибка', 'error'); }
        }).catch(function() { showMsg('clientMsg', 'Ошибка', 'error'); });
    });

    var cancelClientBtn = document.getElementById('cancelClientBtn');
    if (cancelClientBtn) cancelClientBtn.addEventListener('click', function() {
        editingClient = null;
        ['clientName','clientVer','clientDesc','clientImg','clientDl'].forEach(function(id) { document.getElementById(id).value = ''; });
        document.getElementById('clientActive').checked = true;
        document.getElementById('clientFormTitle').textContent = 'Добавить клиент';
        cancelClientBtn.style.display = 'none';
    });

    // ===== BUTTONS =====
    window.loadButtons = function() {
        api('/api/admin/buttons').then(function(r) { return r.json(); }).then(function(d) {
            var list = document.getElementById('buttonsList');
            if (!list) return;
            if (!d.success || !d.buttons || !d.buttons.length) { list.innerHTML = '<div class="empty">Кнопок нет.</div>'; return; }
            list.innerHTML = d.buttons.map(function(b) {
                return '<div class="item-row"><div class="item-info"><h4>' + esc(b.icon || '') + ' ' + esc(b.name) +
                    (b.is_active ? ' <span class="badge active" style="font-size:11px;">Активна</span>' : ' <span class="badge banned" style="font-size:11px;">Неактивна</span>') + '</h4>' +
                    '<p>' + esc(b.action_url || '') + '</p></div>' +
                    '<div class="item-actions"><button class="btn btn-secondary btn-sm" onclick="editButton(' + JSON.stringify(b).replace(/"/g,'&quot;') + ')">✏️</button>' +
                    '<button class="btn btn-danger btn-sm" onclick="deleteButton(' + b.id + ')">🗑️</button></div></div>';
            }).join('');
        }).catch(function() {});
    };

    window.editButton = function(b) {
        editingButton = b.id;
        document.getElementById('btnName').value = b.name || '';
        document.getElementById('btnIcon').value = b.icon || '';
        document.getElementById('btnUrl').value = b.action_url || '';
        document.getElementById('btnOrder').value = b.order_index || 0;
        document.getElementById('btnActive').checked = !!b.is_active;
        document.getElementById('buttonFormTitle').textContent = 'Редактировать кнопку';
        document.getElementById('cancelButtonBtn').style.display = 'inline-block';
    };
    window.deleteButton = function(id) {
        if (!confirm('Удалить кнопку?')) return;
        api('/api/admin/buttons/' + id, { method: 'DELETE' }).then(function(r) { return r.json(); }).then(function(d) {
            toast(d.success ? 'Кнопка удалена' : (d.error || 'Ошибка'), d.success ? 'success' : 'error');
            if (d.success) loadButtons();
        }).catch(function() {});
    };

    var saveButtonBtn = document.getElementById('saveButtonBtn');
    if (saveButtonBtn) saveButtonBtn.addEventListener('click', function() {
        var name = document.getElementById('btnName').value.trim();
        if (!name) { showMsg('buttonMsg', 'Введите название', 'error'); return; }
        var body = { name: name, icon: document.getElementById('btnIcon').value.trim(), action_url: document.getElementById('btnUrl').value.trim(), order_index: parseInt(document.getElementById('btnOrder').value) || 0, is_active: document.getElementById('btnActive').checked };
        var method = editingButton ? 'PUT' : 'POST';
        var path = editingButton ? '/api/admin/buttons/' + editingButton : '/api/admin/buttons';
        api(path, { method: method, body: JSON.stringify(body) }).then(function(r) { return r.json(); }).then(function(d) {
            if (d.success) {
                showMsg('buttonMsg', 'Сохранено', 'success');
                ['btnName','btnIcon','btnUrl'].forEach(function(id) { document.getElementById(id).value = ''; });
                document.getElementById('btnOrder').value = 0;
                document.getElementById('btnActive').checked = true;
                editingButton = null;
                document.getElementById('buttonFormTitle').textContent = 'Добавить кнопку';
                document.getElementById('cancelButtonBtn').style.display = 'none';
                loadButtons();
            } else { showMsg('buttonMsg', d.error || 'Ошибка', 'error'); }
        }).catch(function() { showMsg('buttonMsg', 'Ошибка', 'error'); });
    });

    var cancelButtonBtn = document.getElementById('cancelButtonBtn');
    if (cancelButtonBtn) cancelButtonBtn.addEventListener('click', function() {
        editingButton = null;
        ['btnName','btnIcon','btnUrl'].forEach(function(id) { document.getElementById(id).value = ''; });
        document.getElementById('btnOrder').value = 0;
        document.getElementById('btnActive').checked = true;
        document.getElementById('buttonFormTitle').textContent = 'Добавить кнопку';
        cancelButtonBtn.style.display = 'none';
    });

    // ===== FILE UPLOAD =====
    var uploadForm = document.getElementById('uploadForm');
    if (uploadForm) uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var file = document.getElementById('clientFile').files[0];
        var version = document.getElementById('clientVersion').value.trim();
        var jarTypeEl = document.getElementById('jarType');
        var jarType = jarTypeEl ? jarTypeEl.value : 'wild';
        if (!file) { showMsg('uploadMsg', 'Выберите файл', 'error'); return; }
        if (!version) { showMsg('uploadMsg', 'Введите версию', 'error'); return; }
        var fd = new FormData();
        fd.append('file', file);
        fd.append('version', version);
        fd.append('type', jarType);
        fetch(adminUrl + '/api/admin/upload-client', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: fd })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (d.success) { showMsg('uploadMsg', 'Загружено: ' + d.file.filename + ' v' + d.file.version, 'success'); uploadForm.reset(); }
                else { showMsg('uploadMsg', d.error || 'Ошибка', 'error'); }
            }).catch(function() { showMsg('uploadMsg', 'Ошибка загрузки', 'error'); });
    });
})();
