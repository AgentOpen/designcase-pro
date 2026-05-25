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
  compareList: [],
};

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  if (App.darkMode) document.body.classList.add('dark');
  highlightCurrentNav();
  initModals();
  initGlobalKeyboard();
  updateComparePanel();
});

// ========== SIDEBAR NAVIGATION (direct links, no SPA) ==========
function highlightCurrentNav() {
  const path = window.location.pathname;
  const filename = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

  // Map filenames to data-page values
  const pageMap = {
    'index.html': 'dashboard',
    'dashboard.html': 'dashboard',
    'products.html': 'products',
    'cases.html': 'cases',
    'mycases.html': 'mycases',
    'nas.html': 'nas',
    'analytics.html': 'analytics',
    'admin.html': 'admin',
    'profile.html': 'profile',
  };

  const page = pageMap[filename] || 'dashboard';
  App.currentPage = page;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const items = document.querySelectorAll(`[data-page="${page}"]`);
  items.forEach(n => n.classList.add('active'));

  const titles = {
    dashboard: '工作台', products: '产品库', cases: '案例库',
    mycases: '我的案例', nas: 'NAS文件管理',
    analytics: '数据看板', admin: '系统管理', settings: '同步设置'
  };
  const titleEl = document.getElementById('headerTitle');
  if (titleEl) titleEl.textContent = titles[page] || '';

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
}

function updateComparePanel() {
  const panel = document.getElementById('comparePanel');
  const items = document.getElementById('compareItems');
  if (!panel || !items) return;
  if (App.compareList.length === 0) {
    panel.classList.add('hidden');
  } else {
    panel.classList.remove('hidden');
    items.innerHTML = App.compareList.map((c, i) =>
      `<div class="compare-item">${c.name} <span class="remove" onclick="App.compareList.splice(${i},1);updateComparePanel();showToast('info','已移除')">\u2715</span></div>`
    ).join('');
    items.innerHTML += `<button class="btn btn-primary btn-sm" onclick="openCompareModal()">对比 (${App.compareList.length})</button>
      <button class="btn btn-ghost btn-sm" onclick="App.compareList=[];updateComparePanel()">清空</button>`;
  }
}

function openCompareModal() {
  if (App.compareList.length < 2) { showToast('warning', '请至少选择2个案例进行对比'); return; }
  const body = document.getElementById('compareModalBody');
  if (!body) return;
  body.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>对比项</th>${App.compareList.map(c => `<th>${c.name}</th>`).join('')}</tr></thead>
        <tbody>
          <tr><td>风格</td>${App.compareList.map(c => `<td><span class="tag tag-blue">${c.style}</span></td>`).join('')}</tr>
          <tr><td>空间</td>${App.compareList.map(c => `<td><span class="tag tag-green">${c.space}</span></td>`).join('')}</tr>
          <tr><td>面积</td>${App.compareList.map(c => `<td>${c.area}㎡</td>`).join('')}</tr>
          <tr><td>预算</td>${App.compareList.map(c => `<td>${c.budget}万</td>`).join('')}</tr>
          <tr><td>设计师</td>${App.compareList.map(c => `<td>${c.designer}</td>`).join('')}</tr>
          <tr><td>复用次数</td>${App.compareList.map(c => `<td>${c.reuseCount}次</td>`).join('')}</tr>
          <tr><td>国家</td>${App.compareList.map(c => `<td>${c.country || '-'}</td>`).join('')}</tr>
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
    dashboard: 'dashboard.html', products: 'products.html', cases: 'cases.html',
    mycases: 'mycases.html', nas: 'nas.html',
    analytics: 'analytics.html', admin: 'admin.html', settings: 'settings.html'
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
        case 'a': e.preventDefault(); window.location.href = 'analytics.html'; break;
        case 's': e.preventDefault(); window.location.href = 'settings.html'; break;
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