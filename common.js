/* ================================================================
   George Design - Shared JS (common.js)
   Designer Internal SaaS System
   ================================================================ */

// ========== GLOBAL STATE ==========
const App = {
  currentPage: 'dashboard',
  darkMode: localStorage.getItem('gd-dark') === 'true',
  favorites: JSON.parse(localStorage.getItem('gd-favorites') || '[]'),
  history: JSON.parse(localStorage.getItem('gd-history') || '[]'),
  compareList: JSON.parse(localStorage.getItem('gd-compare') || '[]'),
};
function gdSaveCompare() { try { localStorage.setItem('gd-compare', JSON.stringify(App.compareList)); } catch (e) {} }

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  if (App.darkMode) document.body.classList.add('dark');
  renderSidebar();
  highlightCurrentNav();
  initModals();
  initGlobalKeyboard();
  updateComparePanel();
});

// ========== SIDEBAR (centralized, rendered into <aside id="sidebar">) ==========
// Single source of truth for the left nav. 首页 merges 工作台+数据看板;
// 系统管理 folded into 个人中心.
// ========== 演示角色（管理端/用户端）全站共享 ==========
var GD_LEADER = '陈磊';
var GD_DESIGNERS = ['陈磊','林悦','王明远','张薇','李强','孙敏','周杰'];
var GDRole = {
  role: function () { return localStorage.getItem('gd-demo-role') || 'leader'; },
  me: function () { return localStorage.getItem('gd-demo-me') || (this.role() === 'leader' ? GD_LEADER : '林悦'); },
  isLeader: function () { return this.role() === 'leader' && this.me() === GD_LEADER; },
  set: function (role, me) {
    localStorage.setItem('gd-demo-role', role);
    localStorage.setItem('gd-demo-me', me || (role === 'leader' ? GD_LEADER : '林悦'));
  },
  initial: function (n) { return (n || '').charAt(0); },
  // 统一权限判断（组长既是设计师又是管理者，权限是设计师的超集）
  can: function (action) {
    var leader = this.isLeader();
    var perms = {
      // 管理者专属
      assignTask: leader,         // 派发任务给他人
      createProject: leader,      // 新建协作项目
      editAnyProgress: leader,    // 编辑任意项目进度/状态
      deleteProject: leader,      // 删除协作项目
      manageIntake: leader,       // 登记/分配外部派单
      editAnyStatus: leader,      // 修改任意成员状态
      grantPoints: leader,        // 发放积分
      reviewCases: leader,        // 审核案例积分
      viewTeamOverview: leader,   // 团队总览数据
      inviteMembers: leader,      // 邀请同事加入项目
      // 设计师（含组长）通用
      reuseCase: true,
      copyProject: true,
      createOwnCase: true,
      updateOwnProgress: true,
      editOwnStatus: true,
      viewRanking: true
    };
    return !!perms[action];
  }
};
window.GDRole = GDRole;
// ========== 案例编号规则：设计师编号(3) - 国家码(3) - 该国家第N个(4) ==========
// 例：1000-USA-0018 → 设计师 100、美国、第 18 个
var GD_COUNTRY_CODE = {
  '美国':'USA','欧美':'USA','中国':'CHN','新加坡':'SGP','马来西亚':'MYS','日本':'JPN',
  '韩国':'KOR','英国':'GBR','法国':'FRA','德国':'DEU','澳大利亚':'AUS','加拿大':'CAN','非洲':'AFR','泰国':'THA'
};
function gdCountryCode(country) { return GD_COUNTRY_CODE[country] || 'GLB'; }
// 生成编号：designerId 形如 '001' → 取数字补到3位；seq 为该国家序号
function gdCaseNumber(designerId, country, seq) {
  var d = String(designerId || '000').replace(/\D/g, '') || '000';
  d = d.length >= 3 ? d.slice(-3) : ('000' + d).slice(-3);
  var s = ('0000' + (seq || 1)).slice(-4);
  return d + '-' + gdCountryCode(country) + '-' + s;
}
window.gdCountryCode = gdCountryCode;
window.gdCaseNumber = gdCaseNumber;
function gdSwitchRole(role) {
  GDRole.set(role, role === 'leader' ? GD_LEADER : (document.getElementById('gdRoleWho') ? document.getElementById('gdRoleWho').value : '林悦'));
  location.reload();
}
function gdSwitchMe(name) { GDRole.set('designer', name); location.reload(); }
window.gdSwitchRole = gdSwitchRole;
window.gdSwitchMe = gdSwitchMe;

var GD_NAV = [
  { section: '主菜单', items: [
    { page: 'home',     icon: '⊞', label: '首页',       href: 'dashboard.html' },
    { page: 'products', icon: '⊡', label: '素材库',     href: 'products.html', badge: '128' },
    { page: 'cases',    icon: '⊟', label: '灵感库',     href: 'cases.html' },
    { page: 'mycases',  icon: '⊠', label: '我的案例',   href: 'mycases.html' },
  ]},
  { section: '文件与数据', items: [
    { page: 'nas',      icon: '⊡', label: 'NAS文件管理', href: 'nas.html' },
  ]},
  { section: '团队', items: [
    { page: 'team',     icon: '◇', label: '团队协作',   href: 'team.html' },
    { page: 'ranking',  icon: '★', label: '设计师榜单', href: 'ranking.html' },
  ]},
  { section: '我的', items: [
    { page: 'profile',  icon: '👤', label: '个人中心',  href: 'profile.html' },
  ]},
];

function renderSidebar() {
  const aside = document.getElementById('sidebar');
  if (!aside) return;
  // notification unread count
  var unread = 0;
  try { unread = (JSON.parse(localStorage.getItem('gd-notifications') || '[]')).filter(function (n) { return !n.read; }).length; } catch (e) {}
  var navHtml = GD_NAV.map(function (sec) {
    return '<div class="sidebar-section"><div class="sidebar-section-title">' + sec.section + '</div>' +
      sec.items.map(function (it) {
        var badge = it.badge ? '<span class="nav-badge">' + it.badge + '</span>' : '';
        if (it.page === 'home' && unread > 0) badge = '<span class="nav-badge nav-badge-dot">' + unread + '</span>';
        return '<a href="' + it.href + '" class="nav-item" data-page="' + it.page + '">' +
          '<span class="nav-icon">' + it.icon + '</span> ' + it.label + badge + '</a>';
      }).join('') + '</div>';
  }).join('');
  var me = GDRole.me();
  var isLeader = GDRole.isLeader();
  var roleName = isLeader ? '资深设计师 · 部门主管' : '设计师';
  var roleSwitcher =
    '<div class="sidebar-role">' +
      '<div class="sidebar-role-label">演示身份</div>' +
      '<div class="sidebar-role-btns">' +
        '<button class="srole-btn ' + (GDRole.role() === 'leader' ? 'active' : '') + '" onclick="event.stopPropagation();gdSwitchRole(\'leader\')">👑 管理端</button>' +
        '<button class="srole-btn ' + (GDRole.role() === 'designer' ? 'active' : '') + '" onclick="event.stopPropagation();gdSwitchRole(\'designer\')">🎨 用户端</button>' +
      '</div>' +
      (GDRole.role() === 'designer'
        ? '<select id="gdRoleWho" class="srole-sel" onclick="event.stopPropagation()" onchange="gdSwitchMe(this.value)">' +
            GD_DESIGNERS.filter(function (n) { return n !== GD_LEADER; }).map(function (n) { return '<option' + (n === me ? ' selected' : '') + '>' + n + '</option>'; }).join('') +
          '</select>'
        : '') +
    '</div>';
  aside.innerHTML =
    '<div class="sidebar-logo"><div class="sidebar-logo-icon">G</div><div class="sidebar-logo-text">George Design</div></div>' +
    '<nav class="sidebar-nav">' + navHtml + '</nav>' +
    roleSwitcher +
    '<div class="sidebar-user" onclick="window.location.href=\'profile.html\'" style="cursor:pointer" title="个人中心">' +
      '<div class="sidebar-avatar chen">' + GDRole.initial(me) + '</div>' +
      '<div class="sidebar-user-info"><div class="sidebar-user-name">' + me + '</div>' +
      '<div class="sidebar-user-role">' + roleName + '</div></div></div>';
}

// ========== NAV HIGHLIGHT + TITLE ==========
function highlightCurrentNav() {
  const path = window.location.pathname;
  const filename = path.substring(path.lastIndexOf('/') + 1) || 'dashboard.html';

  const pageMap = {
    'dashboard.html': 'home', 'analytics.html': 'home',
    'products.html': 'products',
    'cases.html': 'cases',
    'mycases.html': 'mycases',
    'nas.html': 'nas',
    'team.html': 'team',
    'ranking.html': 'ranking',
    'admin.html': 'profile',
    'profile.html': 'profile',
  };

  const page = pageMap[filename] || 'home';
  App.currentPage = page;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`[data-page="${page}"]`).forEach(n => n.classList.add('active'));

  const titles = {
    home: '首页', products: '素材库', cases: '灵感库',
    mycases: '我的案例', nas: 'NAS文件管理',
    team: '团队协作', ranking: '设计师榜单', profile: '个人中心'
  };
  const titleEl = document.getElementById('headerTitle');
  if (titleEl && !titleEl.dataset.keep) titleEl.textContent = titles[page] || '';

  addHistory(page, titles[page] || page);

  if (typeof initPage === 'function') initPage(page);
}

// ========== DARK MODE ==========
function toggleDarkMode() {
  App.darkMode = !App.darkMode;
  document.body.classList.toggle('dark', App.darkMode);
  localStorage.setItem('gd-dark', App.darkMode);
  showToast('info', App.darkMode ? '已切换到暗色模式' : '已切换到亮色模式');
}

// ========== TOAST ==========
function showToast(type, msg) {
  const ct = document.getElementById('toastContainer');
  if (!ct) return;
  const icons = { success: '\u2705', error: '\u274C', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || ''}</span> ${msg}`;
  ct.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ========== MODAL ==========
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}
function initModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
  });
}

// ========== DOWNLOAD SIMULATION ==========
function simulateDownload(label) {
  const fmtLabel = label || '模型';
  openModal('downloadModal');
  const status = document.getElementById('downloadStatus');
  const bar = document.getElementById('downloadProgressBar');
  const txt = document.getElementById('downloadPercent');
  if (status) status.textContent = `正在准备下载 ${fmtLabel}...`;
  let pct = 0;
  const int = setInterval(() => {
    pct += Math.random() * 25 + 5;
    if (pct >= 100) {
      pct = 100; clearInterval(int);
      if (bar) bar.style.width = '100%';
      if (txt) txt.textContent = '100%';
      if (status) status.textContent = '下载完成！文件已保存到本地。';
      setTimeout(() => { closeModal('downloadModal'); showToast('success', fmtLabel + '下载成功'); }, 1000);
    } else {
      if (bar) bar.style.width = pct + '%';
      if (txt) txt.textContent = Math.floor(pct) + '%';
    }
  }, 400);
}

// ========== FAVORITES ==========
function toggleFavorite(id, type) {
  const key = `${type}-${id}`;
  const idx = App.favorites.indexOf(key);
  if (idx >= 0) {
    App.favorites.splice(idx, 1);
    showToast('info', '已取消收藏');
  } else {
    App.favorites.push(key);
    showToast('success', '已添加到收藏夹');
  }
  localStorage.setItem('gd-favorites', JSON.stringify(App.favorites));
  return App.favorites.includes(key);
}

function isFavorite(id, type) {
  return App.favorites.includes(`${type}-${id}`);
}

// ========== CASE COMPARE ==========
function toggleCompare(caseData) {
  const idx = App.compareList.findIndex(c => c.id === caseData.id);
  if (idx >= 0) {
    App.compareList.splice(idx, 1);
    showToast('info', '已从对比列表中移除');
  } else if (App.compareList.length >= 3) {
    showToast('warning', '最多同时对比3个案例');
    return;
  } else {
    App.compareList.push(caseData);
    showToast('success', '已添加到案例对比');
  }
  updateComparePanel();
  gdSaveCompare();
}

function updateComparePanel() {
  const panel = document.getElementById('comparePanel');
  const items = document.getElementById('compareItems');
  const cnt = document.getElementById('compareCount');
  if (cnt) cnt.textContent = App.compareList.length;
  if (!panel || !items) return;
  if (App.compareList.length === 0) {
    panel.classList.add('hidden');
  } else {
    panel.classList.remove('hidden');
    items.innerHTML = App.compareList.map((c, i) =>
      `<div class="compare-item">${c.name} <span class="remove" onclick="App.compareList.splice(${i},1);gdSaveCompare();updateComparePanel();showToast('info','已移除')">\u2715</span></div>`
    ).join('');
    items.innerHTML += `<button class="btn btn-primary btn-sm" onclick="openCompareModal()">对比 (${App.compareList.length})</button>`;
  }
}
function clearCompare() { App.compareList = []; gdSaveCompare(); updateComparePanel(); }
window.clearCompare = clearCompare;
window.updateComparePanel = updateComparePanel;
window.gdSaveCompare = gdSaveCompare;

function openCompareModal() {
  if (App.compareList.length < 2) { showToast('warning', '请至少选择2个案例进行对比'); return; }
  const body = document.getElementById('compareModalBody');
  if (!body) return;
  const L = App.compareList;
  // 软件名映射
  const SWN = { max:'3DMax', kjl:'酷家乐', swj:'三维家', su:'SketchUp', cad:'AutoCAD' };
  const swText = c => { var k = Array.isArray(c.software) ? c.software[0] : c.software; return SWN[k] || k || '—'; };
  const delivText = c => ((c.delivery||(c.hasVR?'vr':'effect'))==='vr' ? '全屋VR全景' : '全屋效果图');
  // 差异判断：某行各值是否不全相同 → 高亮
  const rowVals = (fn) => L.map(fn);
  const diff = (vals) => new Set(vals.map(v=>String(v))).size > 1;
  const row = (label, fn, render) => {
    const vals = rowVals(fn);
    const hl = diff(vals);
    return `<tr${hl?' class="cmp-diff"':''}><td>${label}${hl?' <span class="cmp-diff-dot" title="存在差异">●</span>':''}</td>${L.map((c,i)=>`<td>${(render?render(c,vals[i]):vals[i])}</td>`).join('')}</tr>`;
  };
  body.innerHTML = `
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">共 ${L.length} 个案例对比　·　<span class="cmp-diff-dot">●</span> 标记表示该项存在差异</div>
    <div class="table-wrap">
      <table class="cmp-table">
        <thead><tr><th>对比项</th>${L.map(c => `<th>${c.name}</th>`).join('')}</tr></thead>
        <tbody>
          ${row('案例编号', c=>c.number||'-')}
          ${row('风格', c=>c.style, (c,v)=>`<span class="tag tag-blue">${v}</span>`)}
          ${row('空间', c=>c.space||(c.spaceName||'-'), (c,v)=>`<span class="tag tag-green">${v}</span>`)}
          ${row('面积', c=>c.area, (c,v)=>`${v}㎡`)}
          ${row('预算', c=>c.budget, (c,v)=>`<strong>${v}万</strong>`)}
          ${row('交付方案', c=>delivText(c), (c,v)=>`<span class="tag ${v.indexOf('VR')>=0?'tag-orange':'tag-cyan'}">${v}</span>`)}
          ${row('设计软件', c=>swText(c))}
          ${row('复用积分价', c=>(window.GDPoints&&GDPoints.getCasePrice(c.id)!=null?GDPoints.getCasePrice(c.id):(c.points||'-')), (c,v)=>`🪙 ${v}`)}
          ${row('设计师', c=>c.designer)}
          ${row('国家', c=>c.country||'-')}
          ${row('复用次数', c=>c.reuseCount, (c,v)=>`${v}次`)}
        </tbody>
      </table>
    </div>`;
  openModal('compareModal');
}

// ========== HISTORY ==========
function addHistory(page, title) {
  const now = new Date();
  const ts = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
  App.history.unshift({ page, title, time: ts });
  if (App.history.length > 50) App.history.length = 50;
  localStorage.setItem('gd-history', JSON.stringify(App.history));
  renderHistory();
}

function toggleHistory() {
  const panel = document.getElementById('historyPanel');
  if (panel) {
    panel.classList.toggle('show');
    if (panel.classList.contains('show')) renderHistory();
  }
}

function renderHistory() {
  const el = document.getElementById('historyList');
  if (!el) return;
  const pageUrlMap = {
    home: 'dashboard.html', dashboard: 'dashboard.html', products: 'products.html', cases: 'cases.html',
    mycases: 'mycases.html', nas: 'nas.html',
    team: 'team.html', ranking: 'ranking.html', profile: 'profile.html'
  };
  el.innerHTML = App.history.slice(0, 20).map(h =>
    `<div class="history-item" onclick="window.location.href='${pageUrlMap[h.page] || 'dashboard.html'}';toggleHistory()">
      <div>${h.title}</div>
      <div class="history-item-time">${h.time}</div>
    </div>`
  ).join('') || '<div class="history-item" style="color:var(--text-muted);">暂无操作记录</div>';
}

// ========== SHORTCUTS ==========
function showShortcuts() {
  openModal('shortcutsModal');
}

function initGlobalKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === '?') { e.preventDefault(); showShortcuts(); return; }
    if (e.key === 'Escape') { document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); return; }
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'd': e.preventDefault(); window.location.href = 'dashboard.html'; break;
        case 'p': e.preventDefault(); window.location.href = 'products.html'; break;
        case 'c': e.preventDefault(); window.location.href = 'cases.html'; break;
        case 'm': e.preventDefault(); window.location.href = 'mycases.html'; break;
        case 'n': e.preventDefault(); window.location.href = 'nas.html'; break;
        case 'r': e.preventDefault(); window.location.href = 'ranking.html'; break;
        case 'b': e.preventDefault(); toggleDarkMode(); break;
        case 'h': e.preventDefault(); toggleHistory(); break;
      }
    }
  });
}

// ========== AI PRODUCT SEARCH (simulation) ==========
function openAISearch() {
  openModal('aiSearchModal');
}

function executeAISearch() {
  const input = document.getElementById('aiSearchInput');
  const result = document.getElementById('aiSearchResult');
  if (!input || !result) return;
  const query = input.value.trim();
  if (!query) { showToast('warning', '请输入需求描述'); return; }
  result.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">AI正在分析您的需求...</p>';
  setTimeout(() => {
    const products = typeof allProducts !== 'undefined' ? allProducts : [];
    const matched = products.sort(() => Math.random() - 0.5).slice(0, 3);
    result.innerHTML = matched.map(p => `
      <div class="product-card" style="margin-bottom:12px;" onclick="closeModal('aiSearchModal');openProductDetail(${p.id})">
        <div class="card-thumb"><div class="card-thumb-placeholder theme-${p.theme}" style="height:120px;"></div></div>
        <div class="card-body">
          <div class="card-body-title">${p.name} <span style="font-size:11px;color:var(--success);">AI推荐</span></div>
          <div class="card-body-tags">
            <span class="tag tag-blue">${p.style}</span>
            <span class="tag tag-green">${p.space}</span>
          </div>
        </div>
      </div>
    `).join('') || '<p style="text-align:center;color:var(--text-muted);padding:20px;">未找到匹配产品</p>';
  }, 1500);
}

// ========== IMAGE SEARCH (simulation) ==========
function openImageSearch() {
  openModal('imageSearchModal');
}

function simulateImageSearch() {
  const result = document.getElementById('imageSearchResult');
  if (!result) return;
  result.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">正在识别图片特征...</p>';
  setTimeout(() => {
    const products = typeof allProducts !== 'undefined' ? allProducts : [];
    const matched = products.sort(() => Math.random() - 0.5).slice(0, 3);
    result.innerHTML = '<p style="font-size:12px;color:var(--success);margin-bottom:12px;">已识别到相似产品</p>' +
      matched.map(p => `
        <div class="product-card" style="margin-bottom:12px;cursor:pointer;" onclick="closeModal('imageSearchModal');openProductDetail(${p.id})">
          <div class="card-thumb"><div class="card-thumb-placeholder theme-${p.theme}" style="height:100px;"></div></div>
          <div class="card-body">
            <div class="card-body-title">${p.name}</div>
            <div class="card-body-meta">${p.sku}</div>
          </div>
        </div>
      `).join('');
  }, 2000);
}

// ========== SYNC ==========
function startSync() {
  const statusEl = document.getElementById('syncStatusBadge');
  if (statusEl) {
    statusEl.className = 'sync-status syncing';
    statusEl.innerHTML = '\u23F3 正在同步...';
  }
  showToast('info', '正在启动本地同步...');
  let pct = 0;
  const bar = document.getElementById('syncProgressBar');
  const txt = document.getElementById('syncProgressText');
  const int = setInterval(() => {
    pct += Math.random() * 20 + 10;
    if (pct >= 100) {
      pct = 100; clearInterval(int);
      if (bar) bar.style.width = '100%';
      if (txt) txt.textContent = '100%';
      if (statusEl) {
        statusEl.className = 'sync-status synced';
        statusEl.innerHTML = '\u2705 同步完成';
      }
      showToast('success', '本地同步完成');
    } else {
      if (bar) bar.style.width = pct + '%';
      if (txt) txt.textContent = Math.floor(pct) + '%';
    }
  }, 300);
}

// ========== NAS NAVIGATION ==========
function selectNASDir(el, name) {
  document.querySelectorAll('#nasDirTree .dir-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  if (typeof renderNASFiles === 'function') renderNASFiles(name);
}

// Export for page-specific scripts
window.App = App;
window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;
window.simulateDownload = simulateDownload;
window.toggleFavorite = toggleFavorite;
window.isFavorite = isFavorite;
window.toggleCompare = toggleCompare;
window.toggleDarkMode = toggleDarkMode;
window.toggleHistory = toggleHistory;
window.showShortcuts = showShortcuts;
window.openAISearch = openAISearch;
window.executeAISearch = executeAISearch;
window.openImageSearch = openImageSearch;
window.simulateImageSearch = simulateImageSearch;
window.startSync = startSync;
window.selectNASDir = selectNASDir;
/* ============================================================
   Real-image thumbnails (faithful overlay on gradient placeholder)
   - Keeps the original .card-thumb-placeholder gradient as fallback.
   - Loads a deterministic, keyword-matched real photo on top.
   - Works on GitHub Pages (pure <img>, no fetch / no build).
   ============================================================ */
// product theme -> search keyword
var GD_PRODUCT_KW = {
  sofa:'modern sofa furniture', bed:'bedroom bed interior', lamp:'pendant lamp lighting',
  table:'coffee table furniture', chair:'designer chair furniture', shelf:'shelf storage furniture',
  dining:'dining table room', carpet:'rug carpet floor', curtain:'window curtain interior',
  vase:'decor vase ornament', screen:'room divider screen'
};
// case style/space -> search keyword
var GD_SPACE_KW = {
  '客厅':'living room interior','卧室':'bedroom interior','厨房':'kitchen interior',
  '餐厅':'dining room interior','书房':'home office study','儿童房':'kids room interior','玄关':'entryway hallway'
};
var GD_STYLE_KW = {
  '北欧':'scandinavian','现代简约':'modern minimalist','新中式':'chinese style','轻奢':'luxury',
  '工业风':'industrial loft','日式':'japanese','美式':'american classic'
};
// deterministic real image URL (loremflickr keeps a stable photo per lock id)
function gdPhoto(keywords, lockId, w, h) {
  w = w || 600; h = h || 450;
  var kw = encodeURIComponent(String(keywords).trim().replace(/\s+/g, ','));
  return 'https://loremflickr.com/' + w + '/' + h + '/' + kw + '?lock=' + (lockId || 1);
}
// Build the inner HTML of a .card-thumb: gradient layer + real image overlay.
// theme = product theme key; for cases pass {space, style} via opts.
function gdThumbInner(theme, lockId, opts) {
  opts = opts || {};
  var kw;
  if (opts.space || opts.style) {
    kw = (GD_SPACE_KW[opts.space] || 'interior design') + ' ' + (GD_STYLE_KW[opts.style] || '');
  } else {
    kw = GD_PRODUCT_KW[theme] || 'interior design furniture';
  }
  var src = gdPhoto(kw, lockId);
  return '<div class="card-thumb-placeholder theme-' + (theme || 'modern') + '">' +
    '<img class="gd-real-img" src="' + src + '" alt="" loading="lazy" ' +
    'onload="this.classList.add(\'loaded\')" ' +
    'onerror="this.style.display=\'none\'"></div>';
}
window.gdPhoto = gdPhoto;
window.gdThumbInner = gdThumbInner;

/* ---- navigateTo: fix for the original undefined-function bug ---- */
function navigateTo(page) {
  var map = {
    dashboard:'dashboard.html', products:'products.html', cases:'cases.html',
    mycases:'mycases.html', nas:'nas.html', team:'team.html', ranking:'ranking.html',
    home:'dashboard.html', profile:'profile.html', library:'index.html'
  };
  if (map[page]) window.location.href = map[page];
}
window.navigateTo = navigateTo;

/* ---- hydrate any STATIC .card-thumb-placeholder with a real photo ---- */
function gdHydrateStaticThumbs() {
  var nodes = document.querySelectorAll('.card-thumb-placeholder:not(.gd-hydrated)');
  nodes.forEach(function (el, i) {
    if (el.querySelector('.gd-real-img')) { el.classList.add('gd-hydrated'); return; }
    var theme = (Array.prototype.find.call(el.classList, function (c) { return c.indexOf('theme-') === 0; }) || 'theme-modern').slice(6);
    var kw = (window.GD_PRODUCT_KW && window.GD_PRODUCT_KW[theme]) || 'interior design furniture';
    var img = document.createElement('img');
    img.className = 'gd-real-img';
    img.loading = 'lazy';
    img.src = gdPhoto(kw, 700 + i);
    img.onload = function () { img.classList.add('loaded'); };
    img.onerror = function () { img.style.display = 'none'; };
    el.appendChild(img);
    el.classList.add('gd-hydrated');
  });
}
window.gdHydrateStaticThumbs = gdHydrateStaticThumbs;
// GD_PRODUCT_KW lives in this file; expose it for the hydrator
window.GD_PRODUCT_KW = GD_PRODUCT_KW;
document.addEventListener('DOMContentLoaded', function () { setTimeout(gdHydrateStaticThumbs, 50); });

/* ============================================================
   Persistence layer (localStorage) — makes reuse / create / delete real
   ============================================================ */
var GDStore = {
  k: { mine:'gd-mycases', reuse:'gd-reuse', nascopies:'gd-nascopies' },
  get: function (key, def) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  },
  set: function (key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
};
window.GDStore = GDStore;

// Build an independent, owned copy of a source case + a NAS copy path + a reuse record.
function gdMakeReuseCopy(src, user) {
  user = user || { name:'陈磊', id:'001' };
  var mine = GDStore.get(GDStore.k.mine, []);
  var newId = 900 + mine.length + 1;
  var seq = String(newId).padStart(3, '0');
  var copy = {
    id: newId, name: src.name + '（复用）', designer: user.name, designerId: user.id,
    style: src.style, space: src.space, area: src.area, budget: src.budget,
    country: src.country, reuseCount: 0, time: gdToday(), theme: src.theme || 'modern',
    number: user.id + '-Reuse-案例' + seq, origin: src.id
  };
  var nasPath = '设计' + '/' + user.name + '(' + user.id + ')/reuse/' + copy.number;
  var record = { from: src.name, fromNumber: src.number, by: user.name, time: gdNow(), copyNumber: copy.number };
  return { copy: copy, nasPath: nasPath, record: record };
}
function gdToday() {
  var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function gdNow() {
  var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
  return gdToday() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
// Persist a reuse: store owned copy + nas copy node + reuse record.
function gdPersistReuse(src, user) {
  var r = gdMakeReuseCopy(src, user);
  var mine = GDStore.get(GDStore.k.mine, []); mine.unshift(r.copy); GDStore.set(GDStore.k.mine, mine);
  var copies = GDStore.get(GDStore.k.nascopies, []); copies.unshift({ path:r.nasPath, name:r.copy.name, number:r.copy.number, time:r.record.time }); GDStore.set(GDStore.k.nascopies, copies);
  var recs = GDStore.get(GDStore.k.reuse, []); recs.unshift(r.record); GDStore.set(GDStore.k.reuse, recs);
  return r;
}
window.gdMakeReuseCopy = gdMakeReuseCopy;
window.gdPersistReuse = gdPersistReuse;
window.gdToday = gdToday; window.gdNow = gdNow;

/* ============================================================
   Personal Product Library (folders + add + compare)
   localStorage: gd-prod-folders = [{id,name,items:[productId,...]}]
   ============================================================ */
var GDLib = {
  key: 'gd-prod-folders',
  load: function () {
    try { return JSON.parse(localStorage.getItem(this.key) || '[]'); }
    catch (e) { return []; }
  },
  save: function (folders) { localStorage.setItem(this.key, JSON.stringify(folders)); },
  ensureDefault: function () {
    var f = this.load();
    if (!f.length) { f = [{ id: 1, name: '默认收藏夹', items: [] }]; this.save(f); }
    return f;
  },
  addFolder: function (name) {
    var f = this.load();
    var id = f.reduce(function (m, x) { return Math.max(m, x.id); }, 0) + 1;
    f.push({ id: id, name: name, items: [] }); this.save(f); return id;
  },
  removeFolder: function (id) { this.save(this.load().filter(function (x) { return x.id !== id; })); },
  addItem: function (folderId, productId) {
    var f = this.load();
    var folder = f.find(function (x) { return x.id === folderId; });
    if (folder && folder.items.indexOf(productId) < 0) { folder.items.push(productId); this.save(f); return true; }
    return false;
  },
  removeItem: function (folderId, productId) {
    var f = this.load();
    var folder = f.find(function (x) { return x.id === folderId; });
    if (folder) { folder.items = folder.items.filter(function (i) { return i !== productId; }); this.save(f); }
  },
  totalItems: function () {
    return this.load().reduce(function (s, x) { return s + x.items.length; }, 0);
  }
};
window.GDLib = GDLib;

// Compute the attribute-difference matrix between products (for compare view)
function gdProductCompareRows(products) {
  var fields = [
    ['名称', 'name'], ['SKU', 'sku'], ['风格', 'style'], ['空间', 'space'],
    ['品类', 'category'], ['价格', function (p) { return '¥' + (p.price || 0).toLocaleString(); }],
    ['下载量', function (p) { return (p.downloads || 0) + ' 次'; }]
  ];
  return fields.map(function (f) {
    var vals = products.map(function (p) { return typeof f[1] === 'function' ? f[1](p) : p[f[1]]; });
    var diff = vals.some(function (v) { return v !== vals[0]; });
    return { label: f[0], values: vals, diff: diff };
  });
}
window.gdProductCompareRows = gdProductCompareRows;
