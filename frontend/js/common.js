/* common.js - 悦翔电竞公共脚本 (ES5, 兼容安卓6) */

// API base (same origin, relative path)
var API_BASE = '';

// Bug 4 fix: HTML escape function to prevent XSS
function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ==================== Login State ====================
function getUser() {
    try {
        var raw = localStorage.getItem('yx_user');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function isLogin() {
    var u = getUser();
    return u && u.token ? true : false;
}

function setUser(data) {
    localStorage.setItem('yx_user', JSON.stringify(data));
}

function clearUser() {
    localStorage.removeItem('yx_user');
}

// ==================== AJAX Helpers ====================
function ajaxPost(url, data, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE + url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            try {
                var resp = JSON.parse(xhr.responseText);
                callback(resp, xhr.status);
            } catch (e) {
                callback({ success: false, msg: '网络错误' }, xhr.status);
            }
        }
    };
    xhr.send(JSON.stringify(data));
}

function ajaxGet(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + url, true);
    // Bug 6 fix: Send token via Authorization header instead of URL
var user = getUser();
    // 静态数据（非 /api/ 路径）不携带 token，避免破坏 CDN 缓存
    if (user && user.token && url.indexOf('/api/') === 0) {
        xhr.setRequestHeader('Authorization', 'Bearer ' + user.token);
    }
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            try {
                var resp = JSON.parse(xhr.responseText);
                callback(resp, xhr.status);
            } catch (e) {
                callback({ success: false, msg: '网络错误' }, xhr.status);
            }
        }
    };
    xhr.send();
}

// ==================== Toast ====================
function showToast(msg, type) {
    var existing = document.getElementById('yx-toast');
    if (existing) {
        existing.parentNode.removeChild(existing);
    }
    var toast = document.createElement('div');
    toast.id = 'yx-toast';
    toast.className = 'toast show';
    if (type === 'success') {
        toast.className = 'toast show toast-success';
    } else if (type === 'error') {
        toast.className = 'toast show toast-error';
    }
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () {
        toast.className = 'toast';
        setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 2500);
}

// ==================== Modal ====================
function showModal(title, contentHtml) {
    closeModal();
    var overlay = document.createElement('div');
    overlay.id = 'yx-modal';
    overlay.className = 'modal-overlay show';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.innerHTML = '<span class="modal-close" onclick="closeModal()">&times;</span>' +
        '<div class="modal-title">' + title + '</div>' + contentHtml;
    overlay.appendChild(box);
    overlay.onclick = function (e) {
        if (e.target === overlay) closeModal();
    };
    document.body.appendChild(overlay);
}

function closeModal() {
    var m = document.getElementById('yx-modal');
    if (m) m.parentNode.removeChild(m);
}

// ==================== Navigation Bar ====================
function renderNavbar() {
    var user = getUser();
    var navHtml = '';
    navHtml += '<div class="navbar">';
    navHtml += '<div class="nav-logo">悦翔电竞</div>';
    navHtml += '<div class="nav-links">';
    navHtml += '<a href="index.html">首页</a>';
    navHtml += '<a href="products.html">商品</a>';
    navHtml += '<a href="booster-info.html">打手</a>';
    navHtml += '<a href="report.html">举报</a>';
    if (user && user.token) {
        navHtml += '<span style="color:#a855f7;font-size:15px;">' + escapeHtml(user.username) + '</span>';
        if (user.op_level >= 2) {
            navHtml += '<a href="booster.html" class="nav-booster-link">打手接单</a>';
        }
    } else {
        navHtml += '<a href="login.html" class="nav-login">登录</a>';
    }
    navHtml += '</div>';
    navHtml += '<div class="nav-menu-btn" onclick="toggleMenu()">&#8801;</div>';
    navHtml += '</div>';

    // Dropdown
    navHtml += '<div class="nav-dropdown" id="navDropdown">';
    navHtml += '<div class="nav-dropdown-section" style="display:flex;justify-content:space-between;">';
    navHtml += '<span>首页</span><a href="index.html">前往</a>';
    navHtml += '</div>';
    navHtml += '<div class="nav-dropdown-section" style="display:flex;justify-content:space-between;">';
    navHtml += '<span>商品</span><a href="products.html">前往</a>';
    navHtml += '</div>';
    navHtml += '<div class="nav-dropdown-section" style="display:flex;justify-content:space-between;">';
    navHtml += '<span>打手</span><a href="booster-info.html">前往</a>';
    navHtml += '</div>';
    navHtml += '<div class="nav-dropdown-section" style="display:flex;justify-content:space-between;">';
    navHtml += '<span>举报</span><a href="report.html">前往</a>';
    navHtml += '</div>';
    navHtml += '<div class="nav-dropdown-divider"></div>';

    if (user && user.token) {
        navHtml += '<div class="nav-dropdown-section nav-dropdown-user">';
        navHtml += '用户名：<span class="username">' + escapeHtml(user.username) + '</span>';
        navHtml += '</div>';
        navHtml += '<a href="profile.html">查看个人主页</a>';
        navHtml += '<div class="nav-dropdown-divider"></div>';
    }

    navHtml += '<a href="contact.html">联系我们</a>';
    navHtml += '<a href="about.html">关于我们</a>';
    navHtml += '<a href="join.html">加入我们</a>';
    navHtml += '<a href="missing.html">助力走失儿童</a>';

    if (user && user.op_level >= 2) {
        navHtml += '<div class="nav-dropdown-divider"></div>';
        navHtml += '<a href="booster.html" class="nav-booster-link">打手接单</a>';
    }
    if (user && user.op_level >= 3) {
        navHtml += '<a href="admin.html" class="nav-admin-link">管理员后台</a>';
    }

    navHtml += '</div>';

    return navHtml;
}

function toggleMenu() {
    var dd = document.getElementById('navDropdown');
    var btn = document.querySelector('.nav-menu-btn');
    if (!dd) return;
    if (dd.className.indexOf('show') >= 0) {
        dd.className = 'nav-dropdown';
        if (btn) btn.innerHTML = '&#8801;';
    } else {
        dd.className = 'nav-dropdown show';
        if (btn) btn.innerHTML = '&#10005;';
    }
}

// Close dropdown when clicking outside
document.onclick = function (e) {
    var dd = document.getElementById('navDropdown');
    var btn = document.querySelector('.nav-menu-btn');
    if (dd && dd.className.indexOf('show') >= 0) {
        if (e.target !== dd && !dd.contains(e.target) && e.target !== btn) {
            dd.className = 'nav-dropdown';
            if (btn) btn.innerHTML = '&#8801;';
        }
    }
};

// ==================== Page Init ====================
function initPage(callback) {
    // 登录态不在加载期校验，只在写操作时由业务接口验一次
    // Write navbar
    var navContainer = document.getElementById('nav-container');
    if (navContainer) {
        navContainer.innerHTML = renderNavbar();
    }
    // Call page-specific init
    if (callback) callback();
}

// ==================== Redirect if not login ====================
function requireLogin() {
    if (!isLogin()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// ==================== Format date ====================
function formatDate(s) {
    if (!s) return '';
    return s.replace('T', ' ').replace('Z', '');
}
