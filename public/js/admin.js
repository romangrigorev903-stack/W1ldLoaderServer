(function() {
    var currentToken = localStorage.getItem('w1ld_admin_token') || '';
    var adminUrl = (localStorage.getItem('auth_server') || 'http://localhost:3000').replace(/\/+$/, '');

    function showMsg(elId, text, type) {
        var el = document.getElementById(elId);
        if (!el) return;
        el.textContent = text;
        el.className = 'msg ' + type;
        setTimeout(function() { el.className = 'msg'; }, 5000);
    }

    function setLoading(btn, loading) {
        if (!btn) return;
        btn.disabled = loading;
        btn.textContent = loading ? '...' : btn.getAttribute('data-original-text');
    }

    // ===== LOGIN =====
    var loginBtn = document.getElementById('adminLoginBtn');
    if (loginBtn) {
        loginBtn.setAttribute('data-original-text', 'Login');
        loginBtn.addEventListener('click', function() {
            var username = document.getElementById('adminUsername').value.trim();
            var password = document.getElementById('adminPassword').value.trim();
            if (!username || !password) {
                showMsg('loginMsg', 'Enter username and password', 'error');
                return;
            }
            setLoading(loginBtn, true);
            fetch(adminUrl + '/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            }).then(function(r) { return r.json(); }).then(function(data) {
                setLoading(loginBtn, false);
                if (data.success) {
                    currentToken = data.token;
                    localStorage.setItem('w1ld_admin_token', currentToken);
                    showDashboard();
                } else {
                    showMsg('loginMsg', data.error || 'Login failed', 'error');
                }
            }).catch(function() {
                setLoading(loginBtn, false);
                showMsg('loginMsg', 'Server unavailable', 'error');
            });
        });
    }

    // ===== LOGOUT =====
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            currentToken = '';
            localStorage.removeItem('w1ld_admin_token');
            document.getElementById('loginScreen').style.display = 'block';
            document.getElementById('dashboardScreen').style.display = 'none';
        });
    }

    function showDashboard() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('dashboardScreen').style.display = 'block';
        var adminUserEl = document.getElementById('adminUser');
        if (adminUserEl) adminUserEl.textContent = localStorage.getItem('launcher_username') || 'Admin';
        loadStats();
        loadUsers();
    }

    // ===== TABS =====
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
            document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
            btn.classList.add('active');
            var tabId = 'tab-' + btn.getAttribute('data-tab');
            var tabEl = document.getElementById(tabId);
            if (tabEl) tabEl.classList.add('active');
        });
    });

    // ===== STATS =====
    window.loadStats = function() {
        fetch(adminUrl + '/api/admin/stats', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        }).then(function(r) { return r.json(); }).then(function(data) {
            if (data.success && data.stats) {
                var el;
                el = document.getElementById('statTotalUsers'); if (el) el.textContent = data.stats.totalUsers;
                el = document.getElementById('statActive24h'); if (el) el.textContent = data.stats.activeUsersLast24h;
                el = document.getElementById('statBanned'); if (el) el.textContent = data.stats.bannedUsers;
                el = document.getElementById('statAdmins'); if (el) el.textContent = data.stats.adminUsers;
            }
        }).catch(function() {});
    };

    // ===== USERS =====
    window.loadUsers = function() {
        fetch(adminUrl + '/api/admin/users', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        }).then(function(r) { return r.json(); }).then(function(data) {
            if (!data.success) return;
            var tbody = document.getElementById('usersTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';
            var users = data.users || [];
            var searchEl = document.getElementById('userSearch');
            var search = searchEl ? (searchEl.value || '') : '';
            users = users.filter(function(u) {
                return !search || u.username.toLowerCase().indexOf(search.toLowerCase()) !== -1;
            });
            users.forEach(function(user) {
                var tr = document.createElement('tr');
                tr.innerHTML = '<td>' + user.id + '</td>' +
                    '<td>' + escapeHtml(user.username) + '</td>' +
                    '<td><span class="badge ' + (user.banned ? 'banned' : 'active') + '">' + (user.banned ? 'Banned' : 'Active') + '</span></td>' +
                    '<td>' + (user.is_admin ? 'Yes' : 'No') + '</td>' +
                    '<td>' + (user.banned ? 'Yes' : 'No') + '</td>' +
                    '<td style="display:flex;gap:8px;">' +
                    (user.banned ?
                        '<button class="btn btn-success" onclick="unbanUser(' + user.id + ')">Unban</button>' :
                        '<button class="btn btn-danger" onclick="banUser(' + user.id + ')">Ban</button>') +
                    '</td>';
                tbody.appendChild(tr);
            });
        }).catch(function() {});
    };

    window.banUser = function(id) {
        fetch(adminUrl + '/api/admin/users/' + id + '/ban', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + currentToken, 'Content-Type': 'application/json' }
        }).then(function(r) { return r.json(); }).then(function(data) {
            showMsg('usersMsg', data.message || data.error, data.success ? 'success' : 'error');
            loadUsers();
        }).catch(function() {});
    };

    window.unbanUser = function(id) {
        fetch(adminUrl + '/api/admin/users/' + id + '/unban', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + currentToken, 'Content-Type': 'application/json' }
        }).then(function(r) { return r.json(); }).then(function(data) {
            showMsg('usersMsg', data.message || data.error, data.success ? 'success' : 'error');
            loadUsers();
        }).catch(function() {});
    };

    // ===== FILE UPLOAD =====
    var uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            var fileInput = document.getElementById('clientFile');
            var versionInput = document.getElementById('clientVersion');
            var file = fileInput.files[0];
            var version = versionInput.value.trim();
            if (!file) { showMsg('uploadMsg', 'Select a file', 'error'); return; }
            if (!version) { showMsg('uploadMsg', 'Enter version', 'error'); return; }

            var formData = new FormData();
            formData.append('file', file);
            formData.append('version', version);

            fetch(adminUrl + '/api/admin/upload-client', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + currentToken },
                body: formData
            }).then(function(r) { return r.json(); }).then(function(data) {
                if (data.success) {
                    showMsg('uploadMsg', 'File uploaded: ' + data.file.filename + ' (v' + data.file.version + ')', 'success');
                    uploadForm.reset();
                } else {
                    showMsg('uploadMsg', data.error || 'Upload failed', 'error');
                }
            }).catch(function() {
                showMsg('uploadMsg', 'Upload failed', 'error');
            });
        });
    }

    // ===== SEARCH =====
    var userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', loadUsers);
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
})();