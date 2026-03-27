// ============================================================
// app.js — Main Application Logic
// ============================================================

// ── Toast Notifications ──
function showToast(message, type = 'success') {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

// ── Navigation ──
let currentPage = 'dashboard';

// Pages that require login
const PROTECTED_PAGES = ['requests', 'admin', 'manage_types', 'manage_menus', 'manage_roles'];
let _pendingLoginPage = null;

function navigateTo(pageId) {
  // Check login for protected management pages
  if (PROTECTED_PAGES.includes(pageId) && !isLoggedIn()) {
    _pendingLoginPage = pageId;
    openLoginModal();
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // ซ่อน form card ทุกอัน (เพิ่ม/แก้ไข) เมื่อ navigate ออกจากหน้า
  ['type-form-card', 'menu-form-card', 'role-form-card'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const page = document.getElementById('page-' + pageId);
  const nav = document.querySelector(`[data-page="${pageId}"]`);
  if (page) page.classList.add('active');
  if (nav) nav.classList.add('active');

  currentPage = pageId;
  updateTopbarTitle(pageId);

  // Refresh content when navigating
  if (pageId === 'dashboard') renderDashboard();
  if (pageId === 'requests') renderRequestList();
  if (pageId === 'admin') renderAdminPanel();
  if (pageId === 'manage_types') renderManageTypes();
  if (pageId === 'manage_menus') renderManageMenus();
  if (pageId === 'manage_roles') renderManageRoles();
  if (pageId === 'new_request') {
    // เคลียร์ฟอร์มใหม่ทุกครั้งที่เข้าหน้านี้
    resetForm();
  }
}

// ============================================================
// LOGIN / LOGOUT SYSTEM
// ============================================================

const AUTH_KEY = 'merchant_rs_auth';
const DEFAULT_USERS = [
  { username: 'admin', password: 'admin', displayName: 'Admin', role: 'Administrator' }
];

function isLoggedIn() {
  return !!sessionStorage.getItem(AUTH_KEY);
}

function getLoggedInUser() {
  try { return JSON.parse(sessionStorage.getItem(AUTH_KEY)); } catch { return null; }
}

function openLoginModal() {
  const modal = document.getElementById('modal-login');
  if (modal) {
    modal.classList.add('show');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').textContent = '';
    setTimeout(() => document.getElementById('login-username').focus(), 200);
  }
}

function closeLoginModal() {
  const modal = document.getElementById('modal-login');
  if (modal) modal.classList.remove('show');
  _pendingLoginPage = null;
}

function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');

  if (!username || !password) {
    errorEl.textContent = 'กรุณากรอก Username และ Password';
    return;
  }

  const user = DEFAULT_USERS.find(u => u.username === username && u.password === password);
  if (!user) {
    errorEl.textContent = '❌ Username หรือ Password ไม่ถูกต้อง';
    return;
  }

  // Save session
  sessionStorage.setItem(AUTH_KEY, JSON.stringify({ username: user.username, displayName: user.displayName, role: user.role }));
  closeLoginModal();
  updateSidebarAuth();
  showToast(`เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับ ${user.displayName} 🎉`, 'success');

  // Navigate to pending page if any
  if (_pendingLoginPage) {
    const pg = _pendingLoginPage;
    _pendingLoginPage = null;
    navigateTo(pg);
  }
}

function doLogout() {
  sessionStorage.removeItem(AUTH_KEY);
  updateSidebarAuth();
  showToast('ออกจากระบบเรียบร้อย', 'success');
  navigateTo('dashboard');
}

function updateSidebarAuth() {
  const user = getLoggedInUser();
  const avatarEl = document.getElementById('sidebar-avatar');
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  const mgmtNav = document.getElementById('management-nav-section');

  if (user) {
    avatarEl.textContent = user.displayName.charAt(0).toUpperCase();
    nameEl.textContent = user.displayName;
    roleEl.innerHTML = `<span style="font-size:11px;color:var(--text-muted)">${user.role}</span>
      <a href="#" onclick="doLogout();return false" style="color:var(--danger);text-decoration:none;font-size:11px;margin-left:8px">🚪 ออกจากระบบ</a>`;
    if (mgmtNav) mgmtNav.style.display = '';
  } else {
    avatarEl.textContent = '👤';
    nameEl.textContent = 'ยังไม่ได้เข้าสู่ระบบ';
    roleEl.innerHTML = '<a href="#" onclick="openLoginModal();return false" style="color:var(--primary-light);text-decoration:none;font-size:12px">🔑 เข้าสู่ระบบ</a>';
    if (mgmtNav) mgmtNav.style.display = 'none';
  }
}

function updateTopbarTitle(pageId) {
  const titles = {
    dashboard: '🏠 ภาพรวมระบบ',
    new_request: '📝 ส่งคำขอใหม่',
    requests: '📋 รายการคำขอ',
    admin: '🛡️ Admin Panel',
    manage_types: '🗂️ จัดการประเภทคำขอ',
    manage_menus: '🔧 จัดการเมนูสิทธิ์',
    manage_roles: '🎭 จัดการ Role Default',
  };
  const el = document.getElementById('topbar-title');
  if (el) el.textContent = titles[pageId] || 'Merchant Control RS';
}

// ── Multi-User Rows ──
let userRowIndex = 0;
let currentReqMode = 'full'; // 'full' | 'revoke'

// ── Request Type Change Handler ──
function onReqTypeChange(val) {
  const isRevoke = val === 'REVOKE_ACCESS';
  currentReqMode = isRevoke ? 'revoke' : 'full';

  // ปรับ label เหตุผล
  const reasonLabel = document.getElementById('reason-label');
  if (reasonLabel) reasonLabel.textContent = isRevoke ? 'สาเหตุที่ต้องการยกเลิกสิทธิ์ *' : 'เหตุผล / รายละเอียดเพิ่มเติม';

  // ปรับ placeholder เหตุผล
  const reasonBox = document.getElementById('req-reason');
  if (reasonBox) reasonBox.placeholder = isRevoke ? 'ระบุสาเหตุ เช่น พนักงานลาออก, สิ้นสุดสัญญา...' : 'อธิบายเหตุผลในการขอสิทธิ์...';

  // ปรับ label user section
  const usersLabel = document.getElementById('users-section-label');
  if (usersLabel) usersLabel.innerHTML = isRevoke
    ? '🔒 Username ที่ต้องการยกเลิกสิทธิ์ <span class="required">*</span>'
    : '👤 รายชื่อ User ที่ต้องการ <span class="required">*</span>';

  // ปรับ label ปุ่ม add
  const addBtn = document.getElementById('btn-add-user');
  if (addBtn) addBtn.innerHTML = isRevoke ? '➕ เพิ่ม Username' : '➕ เพิ่ม User';

  // Clear rows และเริ่มใหม่
  const container = document.getElementById('users-container');
  if (container) { container.innerHTML = ''; userRowIndex = 0; }
  addUserRow();
}

function buildRoleOptions(selectedId = '') {
  const roles = loadRoleDefaults();
  let opts = roles.map(r =>
    `<option value="${r.id}" ${r.id === selectedId ? 'selected' : ''}>
      ${r.level === 'high' ? '🔴' : r.level === 'medium' ? '🟡' : '🟢'} ${r.name}
    </option>`
  ).join('');
  return opts;
}

function buildPermissionPanel(rowId, selectedPerms = []) {
  // แดชบอร์ด is always included
  const lockedIds = MENU_GROUPS.filter(m => m.locked).map(m => m.id);

  const rowsHtml = MENU_GROUPS.map(item => {
    const isLocked = !!item.locked;
    const isParent = !!(item.children && item.children.length);
    const isChecked = isLocked || selectedPerms.includes(item.id);
    const childIds = isParent ? item.children.map(c => c.id) : [];
    const allChildChecked = isParent && childIds.every(cid => selectedPerms.includes(cid));

    // Parent row
    let html = `
      <div class="perm-row perm-row-parent" data-parent-id="${item.id}">
        <label class="perm-row-label">
          <input type="checkbox" class="perm-cb" data-row="${rowId}" value="${item.id}"
            ${isChecked ? 'checked' : ''} ${isLocked ? 'disabled' : ''}
            onchange="onParentPermChange('${rowId}','${item.id}',${isParent})">
          <span class="${isParent ? 'perm-label-bold' : ''}">${item.label}</span>
          ${isLocked ? '<span class="perm-lock" title="เมนูบังคับ">🔒</span>' : ''}
        </label>
      </div>`;

    // Child rows (indented)
    if (isParent) {
      html += item.children.map(child => {
        const cChecked = selectedPerms.includes(child.id);
        return `
        <div class="perm-row perm-row-child">
          <label class="perm-row-label" style="padding-left:32px">
            <input type="checkbox" class="perm-cb perm-cb-child" data-row="${rowId}" data-parent="${item.id}" value="${child.id}"
              ${cChecked ? 'checked' : ''}
              onchange="onChildPermChange('${rowId}','${item.id}')">
            <span>${child.label}</span>
          </label>
        </div>`;
      }).join('');
    }
    return html;
  }).join('');

  return `
    <div class="perm-panel" id="perm-panel-${rowId}">
      <div class="perm-toolbar">
        <span style="font-size:12px;color:var(--text-muted)">เลือกเมนูที่ต้องการ</span>
        <div style="display:flex;gap:8px">
          <button type="button" class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 10px"
            onclick="selectAllPerms('${rowId}',true)">เลือกทั้งหมด</button>
          <button type="button" class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 10px"
            onclick="selectAllPerms('${rowId}',false)">ล้าง</button>
        </div>
      </div>
      <div class="perm-list">${rowsHtml}</div>
    </div>`;
}

function onParentPermChange(rowId, parentId, hasChildren) {
  // When parent toggled: also toggle all its children
  if (hasChildren) {
    const parentCb = document.querySelector(`.perm-cb[data-row="${rowId}"][value="${parentId}"]`);
    document.querySelectorAll(`.perm-cb-child[data-row="${rowId}"][data-parent="${parentId}"]`)
      .forEach(cb => { cb.checked = parentCb ? parentCb.checked : false; });
  }
  syncPermBadge(rowId);
}

function onChildPermChange(rowId, parentId) {
  // Sync parent checkbox: checked if at least one child checked
  const children = document.querySelectorAll(`.perm-cb-child[data-row="${rowId}"][data-parent="${parentId}"]`);
  const anyChecked = Array.from(children).some(c => c.checked);
  const parentCb = document.querySelector(`.perm-cb[data-row="${rowId}"][value="${parentId}"]`);
  if (parentCb && !parentCb.disabled) parentCb.checked = anyChecked;
  syncPermBadge(rowId);
}

function selectAllPerms(rowId, checked) {
  document.querySelectorAll(`.perm-cb[data-row="${rowId}"]`).forEach(cb => {
    if (!cb.disabled) cb.checked = checked;
  });
  syncPermBadge(rowId);
}

function onUserRoleChange(selectEl, rowId) {
  const roleId = selectEl.value;
  let perms = [];
  if (roleId && roleId !== 'OTHER') {
    perms = getDefaultPermissions(roleId);
  }

  // Deselect all existing
  document.querySelectorAll(`.perm-cb[data-row="${rowId}"]`).forEach(cb => {
    if (!cb.disabled) cb.checked = false;
  });
  document.querySelectorAll(`.perm-cb-child[data-row="${rowId}"]`).forEach(cb => {
    if (!cb.disabled) cb.checked = false;
  });

  // Apply new perms
  perms.forEach(permId => {
    const cb = document.querySelector(`.perm-cb[data-row="${rowId}"][value="${permId}"]`);
    if (cb && !cb.disabled) cb.checked = true;
    const ccb = document.querySelector(`.perm-cb-child[data-row="${rowId}"][value="${permId}"]`);
    if (ccb && !ccb.disabled) ccb.checked = true;
  });

  // Sync parents for newly checked children
  document.querySelectorAll(`.perm-cb[data-row="${rowId}"]`).forEach(cb => {
    const children = document.querySelectorAll(`.perm-cb-child[data-row="${rowId}"][data-parent="${cb.value}"]`);
    if (children.length > 0) {
      const anyChecked = Array.from(children).some(c => c.checked);
      if (!cb.disabled) cb.checked = anyChecked;
    }
  });

  syncPermBadge(rowId);
}

function syncPermBadge(rowId) {
  const all = document.querySelectorAll(`.perm-cb[data-row="${rowId}"]`);
  const count = Array.from(all).filter(c => c.checked).length;
  const btn = document.getElementById(`perm-toggle-${rowId}`);
  const panel = document.getElementById(`perm-panel-${rowId}`);
  const isOpen = panel && panel.classList.contains('open');
  if (btn) btn.innerHTML = `🔧 <span id="perm-badge-${rowId}" style="color:${count > 0 ? 'var(--primary-light)' : ''}">${count > 0 ? count + ' เมนู' : 'กำหนดสิทธิ์'}</span> ${isOpen ? '▲' : '▼'}`;
}

function refreshAllUserRoleDropdowns() {
  document.querySelectorAll('#users-container select').forEach(sel => {
    const val = sel.value;
    sel.innerHTML = '<option value="">-- กรุณาเลือก role --</option>' + buildRoleOptions(val);
  });
}

// keep old names as aliases so old code paths still work
function syncSelectAll(rowId) { syncPermBadge(rowId); }
function toggleGroupAll() { }
function syncGroupAll() { }
function toggleAllPerms(rowId, checked) { selectAllPerms(rowId, checked); }



function togglePermPanel(rowId) {
  const panel = document.getElementById(`perm-panel-${rowId}`);
  if (!panel) return;
  panel.classList.toggle('open');
  syncPermBadge(rowId);
}


function addUserRow(data = {}) {
  if (currentReqMode === 'revoke') { addRevokeRow(data); return; }
  const rowId = 'r' + (userRowIndex++);
  const container = document.getElementById('users-container');
  if (!container) return;

  // Pre-fill from data or from default role config
  const defaultRoleId = getDefaultRoleId();
  const preRoleId = data.roleId !== undefined ? data.roleId : defaultRoleId;
  const prePerms = data.permissions !== undefined ? data.permissions : getDefaultPermissions(preRoleId);

  const selectedPerms = prePerms;
  const permCount = selectedPerms.length;
  const isFirst = container.children.length === 0;

  const wrap = document.createElement('div');
  wrap.className = 'user-row-wrap';
  wrap.dataset.rowid = rowId;
  wrap.style.cssText = 'margin-bottom:12px';
  wrap.innerHTML = `
    <div class="user-row" style="display:grid;grid-template-columns:1fr 1fr 1.2fr auto auto;gap:10px;align-items:end;padding:14px;background:var(--bg-input);border:1px solid var(--border);border-radius:10px 10px 0 0;border-bottom:none;transition:border-color 0.2s">
      <div class="form-group" style="margin:0">
        ${isFirst ? '<label class="form-label">Username <span class="required">*</span></label>' : ''}
        <input class="form-control" type="text" placeholder="john.doe" value="${data.username || ''}" />
      </div>
      <div class="form-group" style="margin:0">
        ${isFirst ? '<label class="form-label">Email</label>' : ''}
        <input class="form-control" type="email" placeholder="john@example.com" value="${data.email || ''}" />
      </div>
      <div class="form-group" style="margin:0">
        ${isFirst ? '<label class="form-label">Role</label>' : ''}
        <select class="form-control" onchange="onUserRoleChange(this, '${rowId}')">
          <option value="">-- กรุณาเลือก role --</option>
          ${buildRoleOptions(preRoleId)}
        </select>
      </div>
      <div style="${isFirst ? 'padding-top:22px' : ''};padding-bottom:2px">
        <button type="button" id="perm-toggle-${rowId}" class="btn btn-outline btn-sm"
          style="white-space:nowrap;font-size:12px;${permCount > 0 ? 'color:var(--primary-light);border-color:rgba(99,102,241,0.4)' : ''}"
          onclick="togglePermPanel('${rowId}')">
          🔧 <span id="perm-badge-${rowId}" style="${permCount > 0 ? 'color:var(--primary-light)' : ''}">${permCount > 0 ? permCount + ' เมนู' : 'กำหนดสิทธิ์'}</span> ▼
        </button>
      </div>
      <div style="${isFirst ? 'padding-top:22px' : ''};padding-bottom:2px">
        <button type="button" class="btn btn-outline btn-sm"
          style="color:var(--danger);border-color:rgba(239,68,68,0.3);padding:8px 10px;"
          onclick="removeUserRow(this)" title="ลบ">✕</button>
      </div>
    </div>
    ${buildPermissionPanel(rowId, selectedPerms)}`;
  container.appendChild(wrap);
  updateRemoveButtons();
}

// ── Revoke Mode Row (username only) ──
function addRevokeRow(data = {}) {
  const container = document.getElementById('users-container');
  if (!container) return;
  const isFirst = container.children.length === 0;

  const wrap = document.createElement('div');
  wrap.className = 'user-row-wrap revoke-row-wrap';
  wrap.style.cssText = 'margin-bottom:8px';
  wrap.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end">
      <div class="form-group" style="margin:0">
        ${isFirst ? '<label class="form-label">Username <span class="required">*</span></label>' : ''}
        <input class="form-control" type="text" placeholder="เช่น john.doe" value="${data.username || ''}" />
      </div>
      <div style="${isFirst ? 'padding-top:22px' : ''};padding-bottom:0">
        <button type="button" class="btn btn-outline btn-sm"
          style="color:var(--danger);border-color:rgba(239,68,68,0.3);padding:8px 10px;"
          onclick="removeUserRow(this)" title="ลบ">✕</button>
      </div>
    </div>`;
  container.appendChild(wrap);
  updateRemoveButtons();
}

function removeUserRow(btn) {
  const wrap = btn.closest('.user-row-wrap');
  if (!wrap) return;
  const container = document.getElementById('users-container');
  if (container.querySelectorAll('.user-row-wrap').length <= 1) {
    showToast('ต้องมีอย่างน้อย 1 User', 'warning'); return;
  }
  wrap.remove();
  updateRemoveButtons();
}

function updateRemoveButtons() {
  const wraps = document.querySelectorAll('.user-row-wrap');
  wraps.forEach(w => {
    const btn = w.querySelector('button[title="ลบ"]');
    if (btn) btn.disabled = wraps.length <= 1;
  });
}

function collectUsers() {
  const wraps = document.querySelectorAll('#users-container .user-row-wrap');
  return Array.from(wraps).map(wrap => {
    const inputs = wrap.querySelectorAll('input[type="text"], input[type="email"]');
    const sel = wrap.querySelector('select');
    const rowId = wrap.dataset.rowid;
    const permissions = Array.from(
      wrap.querySelectorAll(`.perm-cb[data-row="${rowId}"]:checked`)
    ).map(cb => cb.value);
    return {
      username: (inputs[0]?.value || '').trim(),
      fullname: '',
      email: (inputs[1]?.value || '').trim(),
      roleId: sel?.value || '',
      permissions,
    };
  }).filter(u => u.username || u.email);
}

// ── Dashboard ──
// Helper: show loading skeleton rows in a table body
function setTableLoading(tbodyId, colCount) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${colCount}" class="text-center" style="padding:40px;color:var(--text-muted)">⏳ กำลังโหลด...</td></tr>`;
}
function renderDashboard(requests) {
  if (requests === undefined) {
    // Async load from Firebase
    setTableLoading('recent-tbody', 5);
    fbLoadRequests().then(reqs => renderDashboard(reqs));
    return;
  }

  const counts = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'PENDING').length,
    completed: requests.filter(r => r.status === 'COMPLETED').length,
  };

  // Stats
  document.getElementById('stat-total').textContent = counts.total;
  document.getElementById('stat-pending').textContent = counts.pending;
  document.getElementById('stat-completed').textContent = counts.completed;

  // Recent requests table
  const recent = [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const tbody = document.getElementById('recent-tbody');
  if (!tbody) return;

  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:40px;color:var(--text-muted)">ยังไม่มีคำขอ</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(r => {
    const st = REQUEST_STATUS[r.status] || {};
    const reqType = REQUEST_TYPES.find(t => t.id === r.requestType);
    const displayMerchant = r.merchantName ? `${r.merchantId} · ${r.merchantName}` : r.merchantId;
    return `
      <tr>
        <td><span style="font-family:monospace;font-size:12px;color:var(--primary-light)">${r.id}</span></td>
        <td>${reqType ? reqType.label : r.requestType}</td>
        <td>${displayMerchant}</td>
        <td><span class="badge badge-${r.status.toLowerCase()}">${st.icon} ${st.label}</span></td>
        <td style="color:var(--text-secondary);font-size:13px">${formatDateTime(r.createdAt)}</td>
      </tr>`;
  }).join('');

  // Update pending badge in sidebar
  const pendingBadge = document.getElementById('pending-badge');
  if (pendingBadge) pendingBadge.textContent = counts.pending;
}

// ── Request List ──
let filterStatus = '';
let filterType = '';
let searchTerm = '';

function renderRequestList(requests) {
  if (requests === undefined) {
    setTableLoading('req-list-tbody', 6);
    fbLoadRequests().then(reqs => renderRequestList(reqs));
    return;
  }

  let filtered = [...requests];
  if (filterStatus) filtered = filtered.filter(r => r.status === filterStatus);
  if (filterType) filtered = filtered.filter(r => r.requestType === filterType);
  if (searchTerm) filtered = filtered.filter(r =>
    r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.requesterName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.targetUsername || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const tbody = document.getElementById('req-list-tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-icon">📭</div>
      <h3>ไม่พบรายการ</h3>
      <p>ลองปรับตัวกรองหรือส่งคำขอใหม่</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const st = REQUEST_STATUS[r.status] || {};
    const reqType = REQUEST_TYPES.find(t => t.id === r.requestType);
    const displayMerchant = r.merchantName ? `${r.merchantId}<br><span style="font-size:11px;color:var(--text-muted)">${r.merchantName}</span>` : r.merchantId;
    const userCount = r.users ? r.users.length : (r.targetUsername ? 1 : 0);
    const userLabel = userCount > 0
      ? `<span style="font-size:13px;font-weight:700;color:var(--primary-light)">${userCount}</span> <span style="font-size:12px;color:var(--text-muted)">คน</span>`
      : '<span style="color:var(--text-muted)">—</span>';
    return `
      <tr>
        <td><span style="font-family:monospace;font-size:12px;color:var(--primary-light)">${r.id}</span></td>
        <td>${reqType ? reqType.label : r.requestType}</td>
        <td style="max-width:180px">${displayMerchant}</td>
        <td>${userLabel}</td>
        <td><span class="badge badge-${r.status.toLowerCase()}">${st.icon} ${st.label}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openDetailModal('${r.id}')">🔍 ดู</button>
        </td>
      </tr>`;
  }).join('');
}

// ── Admin Panel ──
function renderAdminPanel(allRequests) {
  if (allRequests === undefined) {
    const container = document.getElementById('admin-pending-list');
    if (container) container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">⏳ กำลังโหลด...</div>';
    fbLoadRequests().then(reqs => renderAdminPanel(reqs));
    return;
  }
  // แสดงทุก request ที่ยังไม่ COMPLETED
  const requests = allRequests.filter(r => r.status !== 'COMPLETED');
  const container = document.getElementById('admin-pending-list');
  if (!container) return;

  // Sync sidebar pending badge
  const pendingCount = allRequests.filter(r => r.status === 'PENDING').length;
  const pendingBadge = document.getElementById('pending-badge');
  if (pendingBadge) pendingBadge.textContent = pendingCount;

  if (requests.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🎉</div>
      <h3>ไม่มีคำขอรอดำเนินการ</h3>
      <p>คำขอทั้งหมดได้รับการจัดการแล้ว</p>
    </div>`;
    return;
  }

  container.innerHTML = requests.map(r => {
    const reqType = REQUEST_TYPES.find(t => t.id === r.requestType);
    const displayMerchant = r.merchantName ? `${r.merchantId} – ${r.merchantName}` : r.merchantId;
    const users = r.users || (r.targetUsername ? [{ username: r.targetUsername, fullname: r.targetFullname || '', email: r.targetEmail || '', roleId: r.roleId || '' }] : []);
    const usersHtml = users.length ? `
      <div style="background:var(--bg-input);border-radius:8px;overflow:hidden;border:1px solid var(--border);margin-top:4px">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:var(--bg-card2)">
            <th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:600">Username</th>
            <th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:600">Role</th>
            <th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:600">สิทธิ์เมนู</th>
          </tr></thead>
          <tbody>${users.map((u, i) => {
      const role = ROLES.find(ro => ro.id === u.roleId);
      const perms = (u.permissions || []).map(pid => {
        const menu = findMenuById(pid);
        return menu ? `<span style="display:inline-block;background:rgba(0,75,255,0.1);color:var(--primary-light);border-radius:4px;padding:1px 6px;font-size:11px;margin:2px;white-space:nowrap">${menu.label}</span>` : '';
      }).join('');
      return `<tr style="${i % 2 === 1 ? 'background:rgba(0,75,255,0.02)' : ''}">
              <td style="padding:8px 12px;font-family:monospace">${u.username || '—'}</td>
              <td style="padding:8px 12px">${role ? role.name : (u.roleId || '—')}</td>
              <td style="padding:8px 12px">${perms || '<span style="color:var(--text-muted)">ไม่ได้กำหนด</span>'}</td>
            </tr>`;
    }).join('')}</tbody>
        </table>
      </div>` : '<span style="color:var(--text-muted)">—</span>';
    return `
    <div class="card mb-4" style="border-left:3px solid var(--warning)">
      <div class="flex-between mb-4">
        <div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">
            <span style="font-family:monospace;color:var(--primary-light)">${r.id}</span> · ${formatDateTime(r.createdAt)}
          </div>
          <div style="font-size:16px;font-weight:700">${reqType ? reqType.label : r.requestType}</div>
        </div>
        <span class="badge badge-pending">⏳ รอดำเนินการ</span>
      </div>
      <div class="form-grid" style="margin-bottom:12px">
        <div>
          <div class="form-label">ผู้ขอ</div>
          <div style="font-weight:600">${r.requesterName}</div>
          <div style="font-size:12px;color:var(--text-muted)">${r.requesterEmail}</div>
        </div>
        <div>
          <div class="form-label">Merchant</div>
          <div style="font-weight:600">${displayMerchant}</div>
        </div>
      </div>
      <div style="margin-bottom:16px">
        <div class="form-label" style="margin-bottom:6px">User ที่ขอ (${users.length} คน)</div>
        ${usersHtml}
      </div>
      ${r.reason ? `<div style="background:var(--bg-input);padding:12px;border-radius:8px;font-size:13px;color:var(--text-secondary);margin-bottom:16px">
        <strong>เหตุผล:</strong> ${r.reason}
      </div>` : ''}
      <div class="flex gap-2">
        <button class="btn btn-success btn-sm" onclick="updateRequestStatus('${r.id}', 'COMPLETED')">✅ ดำเนินการเรียบร้อย</button>
        <button class="btn btn-outline btn-sm" onclick="openDetailModal('${r.id}')">🔍 ดูรายละเอียด</button>
      </div>
    </div>`;
  }).join('');
}

// ── Update Status ──
function updateRequestStatus(id, status) {
  const fields = {
    status,
    updatedAt: new Date().toISOString(),
  };
  if (status === 'COMPLETED') fields.completedAt = new Date().toISOString();

  fbUpdateRequest(id, fields).then(() => {
    const st = REQUEST_STATUS[status] || {};
    showToast(`อัปเดตสถานะเป็น "${st.label}" เรียบร้อย`, 'success');
    // Real-time listener will refresh all panels automatically
  }).catch(() => {
    showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
  });
}

// ── Reject Modal ──
let rejectTargetId = null;
function openRejectModal(id) {
  rejectTargetId = id;
  document.getElementById('reject-reason').value = '';
  document.getElementById('modal-reject').classList.add('show');
}
function closeRejectModal() {
  document.getElementById('modal-reject').classList.remove('show');
  rejectTargetId = null;
}
function confirmReject() {
  if (!rejectTargetId) return;
  const reason = document.getElementById('reject-reason').value.trim();
  const id = rejectTargetId;
  closeRejectModal();

  fbUpdateRequest(id, {
    status: 'REJECTED',
    rejectReason: reason,
    updatedAt: new Date().toISOString(),
    rejectedAt: new Date().toISOString(),
  }).then(() => {
    showToast('ปฏิเสธคำขอเรียบร้อย', 'warning');
    // Real-time listener will refresh all panels automatically
  }).catch(() => {
    showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
  });
}

// ── Detail Modal ──
let _currentDetailId = null;
function openDetailModal(id) {
  _currentDetailId = id;
  const requests = loadRequests();
  const r = requests.find(req => req.id === id);
  if (!r) {
    // Data may not be in snapshot yet — try fetching directly
    fbLoadRequests().then(reqs => {
      window._latestRequests = reqs;
      const found = reqs.find(req => req.id === id);
      if (found) openDetailModal(id);
      else showToast('ไม่พบรายการ Request', 'error');
    });
    return;
  }

  const reqType = REQUEST_TYPES.find(t => t.id === r.requestType);
  const role = ROLES.find(ro => ro.id === r.roleId);
  const st = REQUEST_STATUS[r.status] || {};
  const displayMerchant = r.merchantName ? `${r.merchantId} – ${r.merchantName}` : r.merchantId;

  const history = [
    { label: 'ส่งคำขอ', time: r.createdAt, icon: '📝', done: true },
    { label: 'รอการอนุมัติ', time: r.createdAt, icon: '⏳', done: true },
    { label: 'อนุมัติ / ได้รับการตรวจสอบ', time: r.approvedAt || null, icon: '✅', done: !!r.approvedAt },
    { label: 'กำลังดำเนินการ', time: null, icon: '🔄', done: r.status === 'IN_PROGRESS' || r.status === 'COMPLETED' },
    { label: 'เสร็จสิ้น', time: r.completedAt || null, icon: '🎉', done: !!r.completedAt },
  ];

  const usersData = r.users || (r.targetUsername ? [{ username: r.targetUsername, fullname: r.targetFullname || '', email: r.targetEmail || '', roleId: r.roleId || '', permissions: [] }] : []);
  const isRevoke = r.requestType === 'REVOKE_ACCESS';
  const usersTableHtml = usersData.length ? (
    isRevoke ? `
    <div style="background:var(--bg-input);border-radius:8px;overflow:hidden;border:1px solid var(--border)">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:var(--bg-card2)">
          <th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:600;width:50px">#</th>
          <th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:600">Username ที่ต้องการยกเลิกสิทธิ์</th>
        </tr></thead>
        <tbody>${usersData.map((u, i) => `
          <tr style="${i % 2 === 1 ? 'background:rgba(99,102,241,0.03)' : ''}">
            <td style="padding:8px 12px;color:var(--text-muted)">${i + 1}</td>
            <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:var(--danger)">${u.username || '—'}</td>
          </tr>`
    ).join('')}</tbody>
      </table>
    </div>
    `
      : `
    <div style="background:var(--bg-input);border-radius:8px;overflow:hidden;border:1px solid var(--border)">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:var(--bg-card2)">
          <th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:600">#</th>
          <th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:600">Username</th>
          <th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:600">Email</th>
          <th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:600">Role</th>
          <th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:600">สิทธิ์เมนู</th>
        </tr></thead>
        <tbody>${usersData.map((u, i) => {
        const role = ROLES.find(ro => ro.id === u.roleId);
        const perms = (u.permissions || []).map(pid => {
          const menu = findMenuById(pid);
          return menu ? `<span style="display:inline-block;background:rgba(99,102,241,0.12);color:var(--primary-light);border-radius:4px;padding:1px 6px;font-size:11px;margin:2px;white-space:nowrap">${menu.label}</span>` : '';
        }).join('');
        return `<tr style="${i % 2 === 1 ? 'background:rgba(99,102,241,0.03)' : ''}">
            <td style="padding:8px 12px;color:var(--text-muted)">${i + 1}</td>
            <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:var(--primary-light)">${u.username || '—'}</td>
            <td style="padding:8px 12px;font-size:12px;color:var(--text-secondary)">${u.email || '—'}</td>
            <td style="padding:8px 12px">${role ? role.name : (u.roleId || '—')}</td>
            <td style="padding:8px 12px">${perms || '<span style="color:var(--text-muted)">ไม่ได้กำหนด</span>'}</td>
          </tr>`;
      }).join('')}</tbody>
      </table>
    </div>`
  ) : '<span style="color:var(--text-muted)">—</span>';

  document.getElementById('modal-detail-body').innerHTML = `
    <div class="flex-between mb-4">
      <div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">Request ID</div>
        <div style="font-family:monospace;font-size:18px;color:var(--primary-light);font-weight:700">${r.id}</div>
      </div>
      <span class="badge badge-${r.status.toLowerCase()}">${st.icon} ${st.label}</span>
    </div>
    <div class="form-grid mb-4">
      <div><div class="form-label">ประเภทคำขอ</div><div style="font-weight:600">${reqType ? reqType.label : r.requestType}</div></div>
      <div><div class="form-label">Merchant</div><div style="font-weight:600">${displayMerchant}</div></div>
    </div>
    <div style="margin-bottom:16px">
      <div class="form-label" style="margin-bottom:8px">👤 รายชื่อ User (${usersData.length} คน)</div>
      ${usersTableHtml}
    </div>
    ${r.reason ? `<div style="background:var(--bg-input);padding:12px;border-radius:8px;font-size:13px;color:var(--text-secondary);margin-bottom:16px"><strong>เหตุผล / รายละเอียด:</strong><br>${r.reason}</div>` : ''}
    ${r.rejectReason ? `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);padding:12px;border-radius:8px;font-size:13px;margin-bottom:16px"><strong style="color:#f87171">เหตุผลที่ปฏิเสธ:</strong><br>${r.rejectReason}</div>` : ''}
    <div class="divider"></div>
    <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:12px">ประวัติสถานะ</div>
    <div class="timeline">
      ${history.map(h => `
        <div class="timeline-item">
          <div class="timeline-dot" style="${h.done ? 'border-color:var(--primary);background:var(--primary);color:white' : ''}">${h.done ? h.icon : '○'}</div>
          <div class="timeline-content">
            <div class="timeline-title" style="color:${h.done ? 'var(--text-primary)' : 'var(--text-muted)'}">${h.label}</div>
            ${h.time ? `<div class="timeline-time">${formatDateTime(h.time)}</div>` : ''}
          </div>
        </div>`).join('')}
    </div>
  `;
  document.getElementById('modal-detail').classList.add('show');
}

function closeDetailModal() {
  document.getElementById('modal-detail').classList.remove('show');
}

// ── Multi-step Form ──
let currentStep = 1;
const TOTAL_STEPS = 2;

function goToStep(step) {
  if (step < 1 || step > TOTAL_STEPS) return;
  currentStep = step;

  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const el = document.getElementById(`form-step-${i}`);
    if (el) el.classList.toggle('hidden', i !== step);

    const sw = document.getElementById(`step-wrap-${i}`);
    if (sw) {
      sw.querySelector('.step-circle').parentElement.parentElement.classList.remove('active', 'done');
      if (i < step) sw.closest('.step-item').classList.add('done');
      if (i === step) sw.closest('.step-item').classList.add('active');
    }
  }

  // Update step UI
  document.querySelectorAll('.step-item').forEach((item, idx) => {
    item.classList.remove('active', 'done');
    if (idx + 1 < step) item.classList.add('done');
    if (idx + 1 === step) item.classList.add('active');
  });

  document.getElementById('btn-prev').classList.toggle('hidden', step === 1);
  document.getElementById('btn-next').classList.toggle('hidden', step === TOTAL_STEPS);
  document.getElementById('btn-submit').classList.toggle('hidden', step !== TOTAL_STEPS);

  updatePreview();
}

function nextStep() {
  if (!validateCurrentStep()) return;
  goToStep(currentStep + 1);
}

function prevStep() { goToStep(currentStep - 1); }

function validateCurrentStep() {
  if (currentStep === 1) {
    const type = document.getElementById('req-type').value;
    const merchantId = document.getElementById('req-merchant').value.trim();
    const merchantName = document.getElementById('req-merchant-name').value.trim();
    if (!type) { showToast('กรุณาเลือกประเภทคำขอ', 'error'); return false; }
    if (!merchantId) { showToast('กรุณากรอก Merchant ID', 'error'); return false; }
    if (!merchantName) { showToast('กรุณากรอก Merchant Name', 'error'); return false; }
    const users = collectUsers();
    if (users.length === 0) { showToast('กรุณากรอกข้อมูล User อย่างน้อย 1 คน', 'error'); return false; }
    const emptyUser = users.find(u => !u.username);
    if (emptyUser) { showToast('กรุณากรอก Username ให้ครบทุก User', 'error'); return false; }
    // Check duplicate usernames
    const usernames = users.map(u => u.username.toLowerCase());
    const duplicates = usernames.filter((name, idx) => usernames.indexOf(name) !== idx);
    if (duplicates.length > 0) {
      const uniqueDups = [...new Set(duplicates)];
      showToast(`Username ซ้ำ: ${uniqueDups.join(', ')}`, 'error');
      return false;
    }
  }

  return true;
}

function updatePreview() {
  if (currentStep !== 2) return;
  const reqType = REQUEST_TYPES.find(t => t.id === document.getElementById('req-type').value);
  const merchantId = document.getElementById('req-merchant').value.trim();
  const merchantName = document.getElementById('req-merchant-name').value.trim();
  const users = collectUsers();

  document.getElementById('prev-type').textContent = reqType ? reqType.label : '—';
  document.getElementById('prev-merchant').textContent = merchantId || '—';
  document.getElementById('prev-merchant-name').textContent = merchantName || '—';

  // Render users mini-table
  const prevUsers = document.getElementById('prev-users');
  const prevUsersLabel = document.getElementById('prev-users-label');
  if (prevUsersLabel) {
    prevUsersLabel.textContent = currentReqMode === 'revoke' ? 'รายชื่อ User ที่ขอยกเลิก' : 'รายชื่อ User ที่ขอ';
  }

  if (prevUsers) {
    if (users.length === 0) { prevUsers.innerHTML = '<span style="color:var(--text-muted)">—</span>'; return; }

    if (currentReqMode === 'revoke') {
      prevUsers.innerHTML = `
      <div style="background:var(--bg-input);border-radius:8px;overflow:hidden;border:1px solid var(--border);font-size:13px">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:var(--bg-card2)">
            <th style="padding:7px 10px;text-align:left;color:var(--text-muted);font-weight:600;width:50px">#</th>
            <th style="padding:7px 10px;text-align:left;color:var(--text-muted);font-weight:600">Username ที่ต้องการยกเลิกสิทธิ์</th>
          </tr></thead>
          <tbody>${users.map((u, i) => `<tr>
            <td style="padding:7px 10px;color:var(--text-muted)">${i + 1}</td>
            <td style="padding:7px 10px;font-family:monospace;color:var(--danger)">${u.username || '—'}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
    } else {
      prevUsers.innerHTML = `
      <div style="background:var(--bg-input);border-radius:8px;overflow:hidden;border:1px solid var(--border);font-size:13px">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:var(--bg-card2)">
            <th style="padding:7px 10px;text-align:left;color:var(--text-muted);font-weight:600">#</th>
            <th style="padding:7px 10px;text-align:left;color:var(--text-muted);font-weight:600">Username</th>
            <th style="padding:7px 10px;text-align:left;color:var(--text-muted);font-weight:600">Role</th>
            <th style="padding:7px 10px;text-align:left;color:var(--text-muted);font-weight:600">สิทธิ์</th>
          </tr></thead>
          <tbody>${users.map((u, i) => {
        const role = ROLES.find(ro => ro.id === u.roleId);
        const roleName = role ? role.name : (u.roleId === 'OTHER' ? 'Other' : '—'); const pc = (u.permissions || []).length;
        return `<tr><td style="padding:7px 10px;color:var(--text-muted)">${i + 1}</td>
                <td style="padding:7px 10px;font-family:monospace">${u.username || '—'}</td>
                <td style="padding:7px 10px">${roleName}</td>
                <td style="padding:7px 10px">${pc > 0 ? `<span style="color:var(--primary-light);font-weight:600">${pc}</span> เมนู` : '<span style="color:var(--text-muted)">ไม่ได้กำหนด</span>'}</td></tr>`;
      }).join('')}</tbody>
        </table>
      </div>`;
    }
  }
}

async function submitRequest() {
  const reqType = document.getElementById('req-type').value;
  const merchant = document.getElementById('req-merchant').value;
  if (!reqType || !merchant) {
    showToast('ข้อมูลไม่ครบถ้วน', 'error');
    return;
  }

  // Disable submit button to prevent double-submit
  const btnSubmit = document.getElementById('btn-submit');
  if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = '⏳ กำลังส่ง...'; }

  const users = collectUsers();
  const newReq = {
    id: generateId(),
    requestType: reqType,
    merchantId: document.getElementById('req-merchant').value.trim(),
    merchantName: document.getElementById('req-merchant-name').value.trim(),
    requesterName: 'System / Owner',
    requesterEmail: '',
    department: '',
    position: '',
    users,
    reason: (document.getElementById('req-reason')?.value || '').trim(),
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await fbSaveRequest(newReq);

    // Show success
    document.getElementById('page-new_request-inner').classList.add('hidden');
    document.getElementById('submit-success').classList.remove('hidden');
    document.getElementById('success-req-id').textContent = newReq.id;
    showToast(`ส่งคำขอ ${newReq.id} สำเร็จ! 🎉`, 'success');

    // Start 10-second countdown
    startCountdown(10);
  } catch (err) {
    console.error('Submit error:', err);
    showToast('เกิดข้อผิดพลาด: ' + (err.message || 'กรุณาลองใหม่'), 'error');
    if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = '🚀 ส่งคำขอ'; }
  }
}

let _countdownTimer = null;

function startCountdown(seconds) {
  clearCountdown();
  let remaining = seconds;
  const el = document.getElementById('countdown-seconds');
  if (el) el.textContent = remaining;
  _countdownTimer = setInterval(() => {
    remaining--;
    if (el) el.textContent = remaining;
    if (remaining <= 0) {
      clearCountdown();
      navigateTo('dashboard');
    }
  }, 1000);
}

function clearCountdown() {
  if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
}

function resetForm() {
  document.getElementById('page-new_request-inner').classList.remove('hidden');
  document.getElementById('submit-success').classList.add('hidden');
  document.getElementById('req-form').reset();
  // Clear and reset user rows
  const container = document.getElementById('users-container');
  if (container) { container.innerHTML = ''; userRowIndex = 0; addUserRow(); }
  currentStep = 1;
  goToStep(1);
}

// ── Role Card Selection (no-op – roles are now per-user dropdowns) ──
function initRoleCards() { }

// ── Search & Filter ──
function initFilters() {
  const search = document.getElementById('req-search');
  const statusFilter = document.getElementById('filter-status');
  const typeFilter = document.getElementById('filter-type');

  if (search) search.addEventListener('input', e => { searchTerm = e.target.value; renderRequestList(); });
  if (statusFilter) statusFilter.addEventListener('change', e => { filterStatus = e.target.value; renderRequestList(); });
  if (typeFilter) typeFilter.addEventListener('change', e => { filterType = e.target.value; renderRequestList(); });
}



// ============================================================
// IMPORT EXCEL / CSV — Matrix format
// ============================================================

function importExcelFile(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = ''; // reset so same file can be re-imported

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      let data, isCSV = false;

      if (file.name.endsWith('.csv')) {
        isCSV = true;
        // Parse CSV manually — strip BOM if present
        const text = e.target.result.replace(/^\uFEFF/, '');
        data = text.split(/\r?\n/).map(line => {
          const row = [];
          let inQuote = false, cell = '';
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { inQuote = !inQuote; continue; }
            if (ch === ',' && !inQuote) { row.push(cell.trim()); cell = ''; continue; }
            cell += ch;
          }
          row.push(cell.trim());
          return row;
        });
      } else {
        // Parse Excel with SheetJS
        if (typeof XLSX === 'undefined') { showToast('ไม่สามารถโหลด SheetJS ได้', 'error'); return; }
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      }

      // ── Parse Matrix sections ──
      let merchantId = '', merchantName = '';
      const usernames = [], roles = [], emails = [];
      const menuPermMap = {}; // { menuLabel: [val_per_user] }
      let section = '';

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0 || (row.length === 1 && !row[0])) continue;
        const firstCell = String(row[0] || '').trim();

        if (firstCell.includes('Merchant Information') || firstCell.includes('--- Merchant')) { section = 'merchant'; continue; }
        if (firstCell.includes('User Detail') || firstCell.includes('--- User')) { section = 'user'; continue; }
        if (firstCell.includes('Permission') || firstCell.includes('--- Permission')) { section = 'perm'; continue; }

        if (section === 'merchant') {
          if (firstCell.includes('Merchant ID') || firstCell === 'Merchant ID') merchantId = String(row[1] ?? '').trim();
          if (firstCell.includes('Merchant Name') || firstCell === 'Merchant Name') merchantName = String(row[1] ?? '').trim();
        }

        if (section === 'user') {
          if (firstCell === 'User Name') for (let c = 1; c < row.length; c++) usernames.push(String(row[c] || '').trim());
          if (firstCell === 'Role') for (let c = 1; c < row.length; c++) roles.push(String(row[c] || '').trim());
          if (firstCell === 'Email') for (let c = 1; c < row.length; c++) emails.push(String(row[c] || '').trim());
        }

        if (section === 'perm') {
          if (firstCell === 'Menu Item List') continue; // skip header row if present
          menuPermMap[firstCell] = [];
          for (let c = 1; c < row.length; c++) menuPermMap[firstCell].push(Number(row[c]) || 0);
        }
      }

      if (usernames.length === 0) { showToast('ไม่พบข้อมูล User ในไฟล์', 'error'); return; }

      // ── Map role names to role IDs ──
      function findRoleId(name) {
        if (!name || name === '-') return '';
        const r = ROLES.find(ro => ro.name.toLowerCase() === name.toLowerCase() || ro.id === name);
        return r ? r.id : 'OTHER';
      }

      // ── Map menu labels to menu IDs ──
      const allMenus = [];
      const menuGroups = loadMenuGroups ? loadMenuGroups() : MENU_GROUPS;
      menuGroups.forEach(m => {
        allMenus.push({ id: m.id, label: m.label });
        if (m.children) m.children.forEach(c => allMenus.push({ id: c.id, label: c.label }));
      });

      function findMenuId(label) {
        const m = allMenus.find(x => x.label === label);
        return m ? m.id : null;
      }

      // ── Build user data array ──
      const usersData = usernames.map((username, idx) => {
        const roleId = findRoleId(roles[idx] || '');
        const permissions = [];
        for (const [label, vals] of Object.entries(menuPermMap)) {
          if (vals[idx] === 1) {
            const mid = findMenuId(label);
            if (mid) permissions.push(mid);
          }
        }
        return {
          username: username === '-' ? '' : username,
          fullname: '',
          email: (emails[idx] || '') === '-' ? '' : (emails[idx] || ''),
          roleId,
          permissions,
        };
      });

      // ── Populate form ──
      // Set Merchant fields
      document.getElementById('req-merchant').value = merchantId;
      document.getElementById('req-merchant-name').value = merchantName;

      // Set request type to first option if not already set
      const reqTypeEl = document.getElementById('req-type');
      if (reqTypeEl && !reqTypeEl.value) {
        const firstOpt = reqTypeEl.querySelector('option[value]:not([value=""])');
        if (firstOpt) { reqTypeEl.value = firstOpt.value; onReqTypeChange(firstOpt.value); }
      }

      // Clear existing user rows and add imported ones
      const container = document.getElementById('users-container');
      if (container) container.innerHTML = '';
      userRowIndex = 0;

      usersData.forEach(u => addUserRow(u));

      showToast(`Import สำเร็จ! นำเข้า ${usersData.length} User จาก "${file.name}" 📂`, 'success');
      goToStep(1); // ensure we're on step 1

    } catch (err) {
      console.error('Import error:', err);
      showToast('ไม่สามารถอ่านไฟล์ได้: ' + err.message, 'error');
    }
  };

  if (file.name.endsWith('.csv')) {
    reader.readAsText(file, 'UTF-8');
  } else {
    reader.readAsArrayBuffer(file);
  }
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  initRoleCards();
  initFilters();
  updateSidebarAuth(); // set login/logout state in sidebar

  // Real-time Firebase Listener (Requests)
  fbListenRequests((requests) => {
    window._latestRequests = requests;
    if (currentPage === 'dashboard') renderDashboard(requests);
    if (currentPage === 'requests') renderRequestList(requests);
    if (currentPage === 'admin') renderAdminPanel(requests);
  });

  // Real-time Firebase Listener (Admin config)
  fbListenSettings('requestTypes', (types) => {
    if (!types) types = REQUEST_TYPES.map(t => ({ ...t }));
    localStorage.setItem(TYPE_STORAGE_KEY, JSON.stringify(types)); // local backup for sync functions
    refreshTypeDropdown();
    if (currentPage === 'manage_types') renderManageTypes();
  });

  fbListenSettings('menuGroups', (groups) => {
    if (!groups) {
      // Firebase has no data yet — seed from hardcoded defaults
      groups = _DEFAULT_MENU_GROUPS.map(m => ({ id: m.id, label: m.label, ...(m.locked ? { locked: true } : {}), ...(m.children ? { children: m.children.map(c => ({ id: c.id, label: c.label })) } : {}) }));
      fbSaveSettings('menuGroups', groups); // persist to Firebase
    }
    MENU_GROUPS.length = 0;
    groups.forEach(g => MENU_GROUPS.push(g));
    if (currentPage === 'manage_menus') renderManageMenus();
  });

  fbListenSettings('roles', (roles) => {
    if (!roles) {
      roles = ROLES.map((r, i) => ({ id: r.id, name: r.name, description: r.description || '', level: r.level || 'low', defaultPermissions: [], isDefault: i === 0 }));
    }
    localStorage.setItem(ROLE_DEFAULTS_KEY, JSON.stringify(roles));
    ROLES.length = 0;
    roles.forEach(r => ROLES.push({ id: r.id, name: r.name, description: r.description, level: r.level }));
    if (currentPage === 'manage_roles') renderManageRoles(roles);
    if (currentPage === 'new_request') refreshAllUserRoleDropdowns();
  });

  // Init with first user row
  userRowIndex = 0;
  addUserRow();
  goToStep(1);
  navigateTo('dashboard');

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('show');
    });
  });
});

// ============================================================
// ADMIN CRUD — Manage Request Types
// ============================================================

const TYPE_STORAGE_KEY = 'merchant_rs_req_types';
const MENU_STORAGE_KEY = 'merchant_rs_menu_groups';

function loadRequestTypes() {
  try {
    const stored = localStorage.getItem(TYPE_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { }
  return REQUEST_TYPES.map(t => ({ ...t }));
}

async function saveRequestTypes(types) {
  await fbSaveSettings('requestTypes', types);
  // refreshTypeDropdown will be called by realtime listener if needed, or we can call it here
}

function refreshTypeDropdown() {
  const types = loadRequestTypes();
  const typeSelect = document.getElementById('req-type');
  const typeFilter = document.getElementById('filter-type');
  if (typeSelect) {
    typeSelect.innerHTML = '<option value="">— เลือกประเภทคำขอ —</option>';
    types.forEach(t => typeSelect.innerHTML += `<option value="${t.id}">${t.label}</option>`);
  }
  if (typeFilter) {
    typeFilter.innerHTML = '<option value="">— ทุกประเภท —</option>';
    types.forEach(t => typeFilter.innerHTML += `<option value="${t.id}">${t.label}</option>`);
  }
}

// ── Render table ──
function renderManageTypes() {
  const types = loadRequestTypes();
  const tbody = document.getElementById('type-table-body');
  if (!tbody) return;
  if (types.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:30px">ไม่มีข้อมูล</td></tr>`;
    return;
  }
  tbody.innerHTML = types.map((t, i) => `
    <tr>
      <td style="color:var(--text-muted)">${i + 1}</td>
      <td><code style="background:var(--bg-input);padding:2px 8px;border-radius:4px;font-size:12px;color:var(--primary-light)">${t.id}</code></td>
      <td>${t.label}</td>
      <td style="text-align:right">
        <button class="btn btn-outline btn-sm" onclick="editTypeRow('${t.id}')" style="margin-right:6px">✏️ แก้ไข</button>
        <button class="btn btn-outline btn-sm" onclick="deleteTypeRow('${t.id}')" style="color:var(--danger);border-color:rgba(239,68,68,0.3)">🗑️ ลบ</button>
      </td>
    </tr>`).join('');
}

// ── Form show/hide ──
let _typeEditingId = null;
function showAddTypeForm() {
  _typeEditingId = null;
  document.getElementById('type-form-title').textContent = '➕ เพิ่มประเภทคำขอใหม่';
  document.getElementById('type-edit-id').value = '';
  document.getElementById('type-edit-label').value = '';
  document.getElementById('type-edit-id').disabled = false;
  document.getElementById('type-form-card').style.display = '';
  document.getElementById('type-edit-id').focus();
}

function editTypeRow(id) {
  const types = loadRequestTypes();
  const t = types.find(x => x.id === id);
  if (!t) return;
  _typeEditingId = id;
  document.getElementById('type-form-title').textContent = '✏️ แก้ไขประเภทคำขอ';
  document.getElementById('type-edit-id').value = t.id;
  document.getElementById('type-edit-id').disabled = true; // ID not changeable in edit mode
  document.getElementById('type-edit-label').value = t.label;
  document.getElementById('type-form-card').style.display = '';
  document.getElementById('type-edit-label').focus();
}

function hideTypeForm() {
  document.getElementById('type-form-card').style.display = 'none';
}

async function saveTypeForm() {
  const id = document.getElementById('type-edit-id').value.trim().toUpperCase().replace(/\s+/g, '_');
  const label = document.getElementById('type-edit-label').value.trim();
  if (!id) { showToast('กรุณากรอก ID', 'error'); return; }
  if (!label) { showToast('กรุณากรอกชื่อแสดงผล', 'error'); return; }

  const types = loadRequestTypes();
  if (_typeEditingId) {
    // Edit
    const idx = types.findIndex(x => x.id === _typeEditingId);
    if (idx !== -1) types[idx].label = label;
  } else {
    // Add — check duplicate
    if (types.some(x => x.id === id)) { showToast('ID นี้มีอยู่แล้ว', 'error'); return; }
    types.push({ id, label });
  }
  await saveRequestTypes(types);
  hideTypeForm();
  // table renders via realtime listener
  showToast('บันทึกเรียบร้อย', 'success');
}

async function deleteTypeRow(id) {
  if (!confirm(`ลบประเภทคำขอ "${id}" หรือไม่?`)) return;
  const types = loadRequestTypes();
  const filtered = types.filter(x => x.id !== id);
  await saveRequestTypes(filtered);
  // table renders via realtime listener
  showToast('ลบเรียบร้อย', 'success');
}

// ============================================================
// ADMIN CRUD — Manage Permission Menus
// ============================================================

function loadMenuGroups() {
  // Always use the global MENU_GROUPS which is kept in sync by the Firebase listener
  return MENU_GROUPS;
}

async function saveMenuGroups(groups) {
  await fbSaveSettings('menuGroups', groups);
  // Keep global MENU_GROUPS in sync so permission panel re-renders correctly before listener returns
  MENU_GROUPS.length = 0;
  groups.forEach(g => MENU_GROUPS.push(g));
}

// ── Render tree ──
function renderManageMenus() {
  const groups = loadMenuGroups();
  const container = document.getElementById('menu-tree-list');
  if (!container) return;
  if (groups.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:40px">ไม่มีข้อมูล</div>`;
    return;
  }
  container.innerHTML = groups.map((item, idx) => {
    const childrenHtml = (item.children || []).map(child => `
      <div class="menu-tree-child">
        <div class="menu-tree-row" style="padding-left:40px">
          <span class="menu-tree-icon">↳</span>
          <span class="menu-tree-label">${child.label}</span>
          <span class="menu-tree-id">${child.id}</span>
          <div class="menu-tree-actions">
            <button class="btn btn-outline btn-sm" onclick="editMenuRow('${item.id}','${child.id}')" style="font-size:11px;padding:4px 10px">✏️</button>
            <button class="btn btn-outline btn-sm" onclick="deleteMenuRow('${item.id}','${child.id}')" style="font-size:11px;padding:4px 10px;color:var(--danger);border-color:rgba(239,68,68,0.3)">🗑️</button>
          </div>
        </div>
      </div>`).join('');

    return `
      <div class="menu-tree-group">
        <div class="menu-tree-row menu-tree-row-parent">
          <span class="menu-tree-icon">${item.children ? '📁' : '📄'}</span>
          <span class="menu-tree-label" style="font-weight:700">${item.label}</span>
          <span class="menu-tree-id">${item.id}</span>
          ${item.locked ? '<span style="font-size:11px;color:var(--text-muted)">🔒 บังคับ</span>' : ''}
          <div class="menu-tree-actions">
            ${!item.locked ? `<button class="btn btn-outline btn-sm" onclick="showAddMenuForm('${item.id}')" style="font-size:11px;padding:4px 10px">➕ ลูก</button>` : ''}
            <button class="btn btn-outline btn-sm" onclick="editMenuRow(null,'${item.id}')" style="font-size:11px;padding:4px 10px">✏️</button>
            ${!item.locked ? `<button class="btn btn-outline btn-sm" onclick="deleteMenuRow(null,'${item.id}')" style="font-size:11px;padding:4px 10px;color:var(--danger);border-color:rgba(239,68,68,0.3)">🗑️</button>` : ''}
          </div>
        </div>
        ${childrenHtml}
      </div>`;
  }).join('');
}

// ── Form show/hide ──
async function showAddMenuForm(parentId) {
  document.getElementById('menu-edit-parent').value = parentId || '';
  document.getElementById('menu-edit-orig-id').value = '';
  document.getElementById('menu-edit-id').disabled = false;
  document.getElementById('menu-form-title').textContent = parentId ? `➕ เพิ่มเมนูย่อย ใต้ "${parentId}"` : '➕ เพิ่มเมนูหลัก';
  document.getElementById('menu-edit-id').value = '';
  document.getElementById('menu-edit-label').value = '';
  document.getElementById('menu-form-card').style.display = '';
  document.getElementById('menu-edit-id').focus();
}

function editMenuRow(parentId, itemId) {
  const groups = loadMenuGroups();
  let label = '';
  if (parentId) {
    const parent = groups.find(g => g.id === parentId);
    const child = parent?.children?.find(c => c.id === itemId);
    if (child) label = child.label;
  } else {
    const item = groups.find(g => g.id === itemId);
    if (item) label = item.label;
  }
  document.getElementById('menu-edit-parent').value = parentId || '';
  document.getElementById('menu-edit-orig-id').value = itemId;
  document.getElementById('menu-edit-id').value = itemId;
  document.getElementById('menu-edit-id').disabled = true;
  document.getElementById('menu-edit-label').value = label;
  document.getElementById('menu-form-title').textContent = '✏️ แก้ไขชื่อเมนู';
  document.getElementById('menu-form-card').style.display = '';
  document.getElementById('menu-edit-label').focus();
}

function hideMenuForm() {
  document.getElementById('menu-form-card').style.display = 'none';
}

async function saveMenuForm() {
  const parentId = document.getElementById('menu-edit-parent').value;
  const origId = document.getElementById('menu-edit-orig-id').value;
  const newId = document.getElementById('menu-edit-id').value.trim().toUpperCase().replace(/\s+/g, '');
  const label = document.getElementById('menu-edit-label').value.trim();
  if (!newId) { showToast('กรุณากรอก ID', 'error'); return; }
  if (!label) { showToast('กรุณากรอกชื่อเมนู', 'error'); return; }

  const groups = loadMenuGroups();

  if (origId) {
    // Edit existing
    if (parentId) {
      const parent = groups.find(g => g.id === parentId);
      if (parent?.children) {
        const cidx = parent.children.findIndex(c => c.id === origId);
        if (cidx !== -1) parent.children[cidx].label = label;
      }
    } else {
      const gidx = groups.findIndex(g => g.id === origId);
      if (gidx !== -1) groups[gidx].label = label;
    }
  } else {
    // Add new
    if (parentId) {
      const parent = groups.find(g => g.id === parentId);
      if (!parent) { showToast('ไม่พบเมนูหลัก', 'error'); return; }
      if (!parent.children) parent.children = [];
      if (parent.children.some(c => c.id === newId)) { showToast('ID นี้มีอยู่แล้ว', 'error'); return; }
      parent.children.push({ id: newId, label });
    } else {
      const allIds = groups.flatMap(g => g.children ? [g.id, ...g.children.map(c => c.id)] : [g.id]);
      if (allIds.includes(newId)) { showToast('ID นี้มีอยู่แล้ว', 'error'); return; }
      groups.push({ id: newId, label });
    }
  }

  await saveMenuGroups(groups);
  hideMenuForm();
  // table renders via realtime listener
  showToast('บันทึกเรียบร้อย', 'success');
}

async function deleteMenuRow(parentId, itemId) {
  if (!confirm(`ลบเมนู "${itemId}" หรือไม่?${!parentId ? '\n\nหมายเหตุ: เมนูย่อยทั้งหมดจะถูกลบด้วย' : ''}`)) return;
  const groups = loadMenuGroups();
  if (parentId) {
    const parent = groups.find(g => g.id === parentId);
    if (parent?.children) parent.children = parent.children.filter(c => c.id !== itemId);
  } else {
    const idx = groups.findIndex(g => g.id === itemId);
    if (idx !== -1) groups.splice(idx, 1);
  }
  await saveMenuGroups(groups);
  // table renders via realtime listener
  showToast('ลบเรียบร้อย', 'success');
}

// ============================================================
// ADMIN CRUD — Manage Role Defaults
// ============================================================

const ROLE_DEFAULTS_KEY = 'merchant_rs_role_defaults';

function loadRoleDefaults() {
  try {
    const stored = localStorage.getItem(ROLE_DEFAULTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch { }
  // Clone from static ROLES as initial data (no permissions pre-checked)
  return ROLES.map((r, i) => ({
    id: r.id,
    name: r.name,
    description: r.description || '',
    level: r.level || 'low',
    defaultPermissions: [],
    isDefault: i === 0, // first role is default initially
  }));
}

async function saveRoleDefaults(roles) {
  await fbSaveSettings('roles', roles);
  // Keep global ROLES in sync
  ROLES.length = 0;
  roles.forEach(r => ROLES.push({ id: r.id, name: r.name, description: r.description, level: r.level }));
}

function getDefaultRoleId() {
  return '';
}

function getDefaultPermissions(roleId) {
  if (!roleId) return [];
  const roles = loadRoleDefaults();
  const role = roles.find(r => r.id === roleId);
  return role ? (role.defaultPermissions || []) : [];
}

// ── Render table ──
function renderManageRoles(rolesData) {
  const roles = rolesData || loadRoleDefaults();
  const tbody = document.getElementById('role-table-body');
  if (!tbody) return;
  if (roles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px">ไม่มีข้อมูล</td></tr>`;
    return;
  }
  const levelMeta = {
    high: { label: 'High', cls: 'level-badge-high' },
    medium: { label: 'Medium', cls: 'level-badge-medium' },
    low: { label: 'Low', cls: 'level-badge-low' },
  };
  tbody.innerHTML = roles.map((r, i) => {
    const lm = levelMeta[r.level] || levelMeta.low;
    const permCount = (r.defaultPermissions || []).length;
    return `
      <tr>
        <td style="color:var(--text-muted)">${i + 1}</td>
        <td><code style="background:var(--bg-input);padding:2px 8px;border-radius:4px;font-size:12px;color:var(--primary-light)">${r.id}</code></td>
        <td>
          <div style="font-weight:600">${r.name}</div>
          ${r.description ? `<div style="font-size:12px;color:var(--text-muted)">${r.description}</div>` : ''}
        </td>
        <td><span class="level-badge ${lm.cls}">${lm.label}</span></td>
        <td>
          ${permCount > 0
        ? `<span style="font-weight:700;color:var(--primary-light)">${permCount}</span> <span style="color:var(--text-muted);font-size:12px">เมนู</span>`
        : `<span style="color:var(--text-muted);font-size:12px">ไม่ได้กำหนด</span>`}
        </td>
        <td>
          ${r.isDefault
        ? `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3)">&#10003; Default</span>`
        : `<button class="btn btn-outline btn-sm" style="font-size:11px;padding:3px 10px" onclick="setDefaultRole('${r.id}')">Set Default</button>`}
        </td>
        <td style="text-align:right">
          <button class="btn btn-outline btn-sm" onclick="editRoleRow('${r.id}')" style="margin-right:6px">✏️ แก้ไข</button>
          ${!r.isDefault ? `<button class="btn btn-outline btn-sm" onclick="deleteRoleRow('${r.id}')" style="color:var(--danger);border-color:rgba(239,68,68,0.3)">🗑️ ลบ</button>` : ''}
        </td>
      </tr>`;
  }).join('');
}

// ── Permission panel inside role form ──
function buildRoleFormPermPanel(selectedPerms = []) {
  const panel = document.getElementById('role-form-perm-panel');
  if (!panel) return;
  const groups = loadMenuGroups();

  const rowsHtml = groups.map(item => {
    const isLocked = !!item.locked;
    const isParent = !!(item.children && item.children.length);
    const isChecked = isLocked || selectedPerms.includes(item.id);

    let html = `
      <div class="perm-row perm-row-parent">
        <label class="perm-row-label">
          <input type="checkbox" class="role-form-perm-cb" value="${item.id}"
            ${isChecked ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
          <span class="${isParent ? 'perm-label-bold' : ''}">${item.label}</span>
          ${isLocked ? '<span class="perm-lock" title="เมนูบังคับ">🔒</span>' : ''}
        </label>
      </div>`;

    if (isParent) {
      html += item.children.map(child => {
        const cChecked = selectedPerms.includes(child.id);
        return `
        <div class="perm-row perm-row-child">
          <label class="perm-row-label" style="padding-left:32px">
            <input type="checkbox" class="role-form-perm-cb" data-parent="${item.id}" value="${child.id}"
              ${cChecked ? 'checked' : ''}>
            <span>${child.label}</span>
          </label>
        </div>`;
      }).join('');
    }
    return html;
  }).join('');

  panel.innerHTML = `
    <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:10px;padding:16px">
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button type="button" class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 10px"
          onclick="roleFormSelectAll(true)">เลือกทั้งหมด</button>
        <button type="button" class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 10px"
          onclick="roleFormSelectAll(false)">ล้าง</button>
      </div>
      <div class="perm-list">${rowsHtml}</div>
    </div>`;
}

function roleFormSelectAll(checked) {
  document.querySelectorAll('.role-form-perm-cb').forEach(cb => {
    if (!cb.disabled) cb.checked = checked;
  });
}

function collectRoleFormPerms() {
  return Array.from(document.querySelectorAll('.role-form-perm-cb:checked')).map(cb => cb.value);
}

// ── Form show/hide ──
let _roleEditingId = null;

function showAddRoleForm() {
  _roleEditingId = null;
  document.getElementById('role-form-title').textContent = '➕ เพิ่ม Role';
  document.getElementById('role-edit-id').value = '';
  document.getElementById('role-edit-id').disabled = false;
  document.getElementById('role-edit-name').value = '';
  document.getElementById('role-edit-desc').value = '';
  document.getElementById('role-edit-level').value = 'low';
  document.getElementById('role-edit-orig-id').value = '';
  buildRoleFormPermPanel([]);
  document.getElementById('role-form-card').style.display = '';
  document.getElementById('role-edit-id').focus();
}

function editRoleRow(id) {
  const roles = loadRoleDefaults();
  const r = roles.find(x => x.id === id);
  if (!r) return;
  _roleEditingId = id;
  document.getElementById('role-form-title').textContent = '✏️ แก้ไข Role';
  document.getElementById('role-edit-id').value = r.id;
  document.getElementById('role-edit-id').disabled = true;
  document.getElementById('role-edit-name').value = r.name;
  document.getElementById('role-edit-desc').value = r.description || '';
  document.getElementById('role-edit-level').value = r.level || 'low';
  document.getElementById('role-edit-orig-id').value = r.id;
  buildRoleFormPermPanel(r.defaultPermissions || []);
  document.getElementById('role-form-card').style.display = '';
  document.getElementById('role-edit-name').focus();
}

function hideRoleForm() {
  document.getElementById('role-form-card').style.display = 'none';
}

async function saveRoleForm() {
  const rawId = document.getElementById('role-edit-id').value.trim().toUpperCase().replace(/\s+/g, '_');
  const name = document.getElementById('role-edit-name').value.trim();
  const desc = document.getElementById('role-edit-desc').value.trim();
  const level = document.getElementById('role-edit-level').value;
  const perms = collectRoleFormPerms();

  if (!rawId) { showToast('กรุณากรอก Role ID', 'error'); return; }
  if (!name) { showToast('กรุณากรอกชื่อแสดงผล', 'error'); return; }

  const roles = loadRoleDefaults();
  if (_roleEditingId) {
    const idx = roles.findIndex(x => x.id === _roleEditingId);
    if (idx !== -1) {
      roles[idx].name = name;
      roles[idx].description = desc;
      roles[idx].level = level;
      roles[idx].defaultPermissions = perms;
    }
  } else {
    if (roles.some(x => x.id === rawId)) { showToast('Role ID นี้มีอยู่แล้ว', 'error'); return; }
    roles.push({ id: rawId, name, description: desc, level, defaultPermissions: perms, isDefault: false });
  }

  await saveRoleDefaults(roles);
  hideRoleForm();
  // table renders via realtime listener
  showToast('บันทึกเรียบร้อย', 'success');
}

async function deleteRoleRow(id) {
  if (!confirm(`ลบ Role "${id}" หรือไม่?`)) return;
  const roles = loadRoleDefaults();
  const filtered = roles.filter(x => x.id !== id);
  await saveRoleDefaults(filtered);
  // table renders via realtime listener
  showToast('ลบเรียบร้อย', 'success');
}

async function setDefaultRole(id) {
  const roles = loadRoleDefaults();
  roles.forEach(r => r.isDefault = (r.id === id));
  await saveRoleDefaults(roles);
  // table renders via realtime listener
  showToast(`ตั้ง "${id}" เป็น Default Role เรียบร้อย`, 'success');
}

// ============================================================
// EXPORT FUNCTIONS
// ============================================================

// ── Export ทุก Request เป็น Excel — Matrix format (1 Request ต่อ 1 Sheet) ──
function exportAllMatrixExcel() {
  if (typeof XLSX === 'undefined') { showToast('ไม่สามารถโหลด SheetJS ได้ ลองใหม่อีกครั้ง', 'error'); return; }
  const requests = loadRequests();
  if (requests.length === 0) { showToast('ไม่มีข้อมูลให้ Export', 'warning'); return; }

  const allMenus = [];
  const menuGroups = loadMenuGroups ? loadMenuGroups() : MENU_GROUPS;
  menuGroups.forEach(m => {
    allMenus.push({ id: m.id, label: m.label });
    if (m.children) m.children.forEach(c => allMenus.push({ id: c.id, label: c.label }));
  });

  const wb = XLSX.utils.book_new();

  requests.forEach((r, idx) => {
    const reqType = REQUEST_TYPES.find(t => t.id === r.requestType);
    const users = r.users || (r.targetUsername ? [{ username: r.targetUsername, fullname: r.targetFullname || '', email: r.targetEmail || '', roleId: r.roleId || '', permissions: [] }] : []);
    const userCount = users.length;
    const emptyUserCols = Array(userCount).fill('');

    const data = [];
    data.push(['--- Merchant Information ---', ...emptyUserCols]);
    data.push(['Batch ID', r.id, ...Array(Math.max(0, userCount - 1)).fill('')]);
    data.push(['Merchant ID', r.merchantId, ...Array(Math.max(0, userCount - 1)).fill('')]);
    data.push(['Merchant Name', r.merchantName || '', ...Array(Math.max(0, userCount - 1)).fill('')]);
    data.push(['Request Type', reqType ? reqType.label : r.requestType, ...Array(Math.max(0, userCount - 1)).fill('')]);
    data.push([]);

    data.push(['--- User Details ---', ...emptyUserCols]);
    data.push(['User Name', ...users.map(u => u.username || '-')]);
    const roleNames = users.map(u => { const role = ROLES.find(ro => ro.id === u.roleId); return role ? role.name : (u.roleId || '-'); });
    data.push(['Role', ...roleNames]);
    data.push(['Email', ...users.map(u => u.email || '-')]);
    data.push([]);

    data.push(['--- Permission Access Matrix (1=Selected 0=No) ---', ...emptyUserCols]);
    allMenus.forEach(menu => {
      const row = [menu.label];
      users.forEach(u => {
        const perms = u.permissions || [];
        row.push(perms.includes(menu.id) ? 1 : 0);
      });
      data.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const colWidths = [{ wch: 48 }];
    for (let i = 0; i < userCount; i++) colWidths.push({ wch: 22 });
    ws['!cols'] = colWidths;

    let sheetName = r.id;
    if (sheetName.length > 31) sheetName = sheetName.slice(0, 31);
    let finalName = sheetName;
    let counter = 2;
    while (wb.SheetNames.includes(finalName)) { finalName = sheetName.slice(0, 28) + '_' + counter++; }

    XLSX.utils.book_append_sheet(wb, ws, finalName);
  });

  const ts = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Batch_Export_${ts}_Matrix.xlsx`);
  showToast('Export Excel (Matrix) สำเร็จ! 📊', 'success');
}

// ── Export Request เดียว เป็น Excel — Matrix format ──
function exportDetailMatrixExcel(id) {
  if (typeof XLSX === 'undefined') { showToast('ไม่สามารถโหลด SheetJS ได้', 'error'); return; }
  const requests = loadRequests();
  const r = requests.find(req => req.id === id);
  if (!r) { showToast('ไม่พบ Request', 'error'); return; }

  const allMenus = [];
  const menuGroups = loadMenuGroups ? loadMenuGroups() : MENU_GROUPS;
  menuGroups.forEach(m => {
    allMenus.push({ id: m.id, label: m.label });
    if (m.children) m.children.forEach(c => allMenus.push({ id: c.id, label: c.label }));
  });

  const reqType = REQUEST_TYPES.find(t => t.id === r.requestType);
  const users = r.users || (r.targetUsername ? [{ username: r.targetUsername, fullname: r.targetFullname || '', email: r.targetEmail || '', roleId: r.roleId || '', permissions: [] }] : []);
  const userCount = users.length;
  const emptyUserCols = Array(userCount).fill('');

  const data = [];
  data.push(['--- Merchant Information ---', ...emptyUserCols]);
  data.push(['Batch ID', r.id, ...Array(Math.max(0, userCount - 1)).fill('')]);
  data.push(['Merchant ID', r.merchantId, ...Array(Math.max(0, userCount - 1)).fill('')]);
  data.push(['Merchant Name', r.merchantName || '', ...Array(Math.max(0, userCount - 1)).fill('')]);
  data.push(['Request Type', reqType ? reqType.label : r.requestType, ...Array(Math.max(0, userCount - 1)).fill('')]);
  data.push([]);

  data.push(['--- User Details ---', ...emptyUserCols]);
  data.push(['User Name', ...users.map(u => u.username || '-')]);
  data.push(['Role', ...users.map(u => { const role = ROLES.find(ro => ro.id === u.roleId); return role ? role.name : (u.roleId || '-'); })]);
  data.push(['Email', ...users.map(u => u.email || '-')]);
  data.push([]);

  data.push(['--- Permission Access Matrix (1=Selected 0=No) ---', ...emptyUserCols]);
  allMenus.forEach(menu => {
    const row = [menu.label];
    users.forEach(u => { row.push((u.permissions || []).includes(menu.id) ? 1 : 0); });
    data.push(row);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  const colWidths = [{ wch: 48 }];
  for (let i = 0; i < userCount; i++) colWidths.push({ wch: 22 });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, r.id.slice(0, 31));
  XLSX.writeFile(wb, `Batch_${r.id}_Matrix.xlsx`);
  showToast('Export Excel สำเร็จ! 📊', 'success');
}

// ── Export ทุก Request เป็น CSV ──
function exportAllCSV() {
  const requests = loadRequests();
  if (requests.length === 0) { showToast('ไม่มีข้อมูลให้ Export', 'warning'); return; }

  const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;

  const header = ['Request ID', 'ประเภทคำขอ', 'Merchant ID', 'Merchant Name', 'ผู้ขอ', 'Email ผู้ขอ', 'สถานะ', 'จำนวน User', 'รายชื่อ Username', 'เหตุผล', 'วันที่ส่ง', 'วันที่อัปเดต'];

  const rows = requests.map(r => {
    const reqType = REQUEST_TYPES.find(t => t.id === r.requestType);
    const users = r.users || (r.targetUsername ? [{ username: r.targetUsername }] : []);
    const usernames = users.map(u => u.username).filter(Boolean).join(', ');
    const st = REQUEST_STATUS[r.status] || {};
    return [
      r.id,
      reqType ? reqType.label : r.requestType,
      r.merchantId,
      r.merchantName || '',
      r.requesterName || '',
      r.requesterEmail || '',
      st.label || r.status,
      users.length,
      usernames,
      r.reason || '',
      formatDateTime(r.createdAt),
      formatDateTime(r.updatedAt),
    ].map(esc).join(',');
  });

  const csv = '\uFEFF' + [header.map(esc).join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `requests_export_${ts}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export CSV สำเร็จ!', 'success');
}

// ── Export รายละเอียด Request เดียว เป็น PDF (print window) ──
function exportDetailPDF(id) {
  const requests = loadRequests();
  const r = requests.find(req => req.id === id);
  if (!r) { showToast('ไม่พบ Request', 'error'); return; }

  const reqType = REQUEST_TYPES.find(t => t.id === r.requestType);
  const st = REQUEST_STATUS[r.status] || {};
  const displayMerchant = r.merchantName ? `${r.merchantId} – ${r.merchantName}` : r.merchantId;
  const isRevoke = r.requestType === 'REVOKE_ACCESS';
  const usersData = r.users || (r.targetUsername ? [{ username: r.targetUsername, fullname: r.targetFullname || '', email: r.targetEmail || '', roleId: r.roleId || '', permissions: [] }] : []);

  const usersTableHtml = usersData.length === 0 ? '<p>—</p>' : isRevoke ? `
    <table>
      <thead><tr><th>#</th><th>Username ที่ต้องการยกเลิกสิทธิ์</th></tr></thead>
      <tbody>${usersData.map((u, i) => `<tr><td>${i + 1}</td><td>${u.username || '—'}</td></tr>`).join('')}</tbody>
    </table>` : `
    <table>
      <thead><tr><th>#</th><th>Username</th><th>Email</th><th>Role</th><th>สิทธิ์เมนู</th></tr></thead>
      <tbody>${usersData.map((u, i) => {
    const role = ROLES.find(ro => ro.id === u.roleId);
    const perms = (u.permissions || []).map(pid => { const m = findMenuById(pid); return m ? m.label : ''; }).filter(Boolean).join(', ');
    return `<tr><td>${i + 1}</td><td>${u.username || '—'}</td><td>${u.email || '—'}</td><td>${role ? role.name : (u.roleId || '—')}</td><td>${perms || '—'}</td></tr>`;
  }).join('')}</tbody>
    </table>`;

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8"/>
  <title>Request ${r.id}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Sarabun', sans-serif; font-size: 14px; color: #111827; padding: 32px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #004BFF; padding-bottom: 14px; margin-bottom: 20px; }
    .logo { font-size: 18px; font-weight: 700; color: #004BFF; }
    .logo small { display: block; font-size: 11px; color: #6b7280; font-weight: 400; margin-top: 2px; }
    .req-id { font-size: 13px; font-family: monospace; color: #3366FF; font-weight: 700; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-pending { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
    .badge-completed { background: #d1fae5; color: #047857; border: 1px solid #6ee7b7; }
    .badge-rejected { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .section-title { font-size: 13px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; margin-top: 18px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
    .info-item label { font-size: 11px; color: #9ca3af; display: block; margin-bottom: 2px; }
    .info-item span { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 6px; }
    th { background: #f3f4f6; color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; }
    tr:last-child td { border-bottom: none; }
    .reason-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; font-size: 13px; color: #374151; margin-top: 6px; }
    .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 18px; }
      @page { margin: 12mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">🏪 Merchant Control RS<small>Service Request System</small></div>
    </div>
    <div style="text-align:right">
      <div class="req-id">${r.id}</div>
      <span class="badge badge-${r.status.toLowerCase()}">${st.icon || ''} ${st.label || r.status}</span>
    </div>
  </div>

  <div class="section-title">ข้อมูลคำขอ</div>
  <div class="info-grid">
    <div class="info-item"><label>ประเภทคำขอ</label><span>${reqType ? reqType.label : r.requestType}</span></div>
    <div class="info-item"><label>Merchant</label><span>${displayMerchant}</span></div>
    <div class="info-item"><label>ผู้ขอ</label><span>${r.requesterName || '—'}</span></div>
    <div class="info-item"><label>Email ผู้ขอ</label><span>${r.requesterEmail || '—'}</span></div>
    <div class="info-item"><label>วันที่ส่งคำขอ</label><span>${formatDateTime(r.createdAt)}</span></div>
    <div class="info-item"><label>อัปเดตล่าสุด</label><span>${formatDateTime(r.updatedAt)}</span></div>
  </div>

  <div class="section-title">รายชื่อ User (${usersData.length} คน)</div>
  ${usersTableHtml}

  ${r.reason ? `<div class="section-title">เหตุผล / รายละเอียด</div><div class="reason-box">${r.reason}</div>` : ''}
  ${r.rejectReason ? `<div class="section-title" style="color:#ef4444">เหตุผลที่ปฏิเสธ</div><div class="reason-box" style="border-color:#fca5a5;background:#fff5f5">${r.rejectReason}</div>` : ''}

  <div class="footer">
    <span>Merchant Control Service Request System</span>
    <span>พิมพ์เมื่อ: ${formatDateTime(new Date().toISOString())}</span>
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
  else showToast('กรุณาอนุญาต Popup เพื่อ Export PDF', 'warning');
}

