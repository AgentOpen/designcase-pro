/* ================================================================
   gdcase.js — Unified Case module (shared by 灵感库 / 我的案例 / NAS)
   One card renderer + one rich detail modal with ALL features:
   详情文件(产品/模型/CAD) · VR或案例图 · 对比 · 复用 · (编辑/删除)
   ================================================================ */
(function () {
  // ---- VR tour map (by case number) ----
  var VR_DEFAULT = 'https://img.gbuilderchina.com/panorama/direct-86c6862f-b698-4fd0-893c-355d0ba0e4a4/tour.html';
  var VR_NUMBERS = {
    '001-America-案例001': 1, '002-Europe-案例004': 1, '003-Japan-案例006': 1,
    '004-Malaysia-案例010': 1, '005-America-案例013': 1, '001-Singapore-案例002': 1,
    '003-Europe-案例011': 1, '005-Singapore-案例014': 1
  };
  function hasVR(c) { return c.hasVR || !!VR_NUMBERS[c.number]; }
  function vrUrl(c) { return c.vrUrl || VR_DEFAULT; }

  var THEME_MAP = { '现代简约':'modern','北欧':'nordic','新中式':'chinese','轻奢':'luxury','工业风':'industrial','日式':'japanese','美式':'american' };
  function tagClass(style) {
    var m = {'现代简约':'tag-blue','北欧':'tag-green','新中式':'tag-purple','轻奢':'tag-orange','工业风':'tag-red','日式':'tag-pink','美式':'tag-cyan'};
    return m[style] || 'tag-blue';
  }
  function theme(c) { return c.theme || THEME_MAP[c.style] || 'modern'; }

  // Deterministic demo sub-files for a case
  function caseProducts(c) {
    var base = (c.id || 1);
    return [
      { name: c.style + '主沙发', sku: 'SKU-' + (100 + base), cat: '沙发', qty: 1 },
      { name: c.style + '茶几', sku: 'SKU-' + (200 + base), cat: '茶几', qty: 1 },
      { name: '装饰吊灯', sku: 'SKU-' + (300 + base), cat: '灯具', qty: 2 }
    ];
  }
  function caseModels(c) {
    return [
      { file: c.name + '.max', fmt: '3DMax', size: (40 + (c.id||1) % 30) + 'MB' },
      { file: c.name + '.skp', fmt: 'SketchUp', size: (25 + (c.id||1) % 20) + 'MB' },
      { file: c.name + '.fbx', fmt: 'FBX', size: (18 + (c.id||1) % 12) + 'MB' }
    ];
  }
  function caseCads(c) {
    return [
      { file: '平面布局图.dwg', fmt: 'DWG' },
      { file: '立面图.dwg', fmt: 'DWG' },
      { file: '节点大样图.dwg', fmt: 'DWG' }
    ];
  }

  // ---- Unified card ----
  // opts.context: 'cases' | 'mycases' | 'nas'
  function renderCard(c, opts) {
    opts = opts || {};
    var ctx = opts.context || 'cases';
    var vrBadge = hasVR(c) ? '<span class="tag tag-orange case-vr-badge">VR全景</span>' : '<span class="tag tag-cyan case-vr-badge">案例图</span>';
    var meta = (c.designer ? c.designer : '') +
      (c.area ? ' · ' + c.area + '㎡' : '') + (c.budget ? ' · ¥' + c.budget + '万' : '');
    var sub = (c.number ? c.number : '') + (c.dept ? ' · ' + c.dept : '');
    // action buttons differ by context
    var actions = '';
    actions += '<button class="btn btn-ghost btn-sm" onclick="GDCase.openDetail(' + c.id + ')">详情</button>';
    actions += '<button class="btn btn-ghost btn-sm" onclick="GDCase.view(' + c.id + ')">' + (hasVR(c) ? 'VR' : '看图') + '</button>';
    actions += '<button class="btn btn-ghost btn-sm" onclick="GDCase.toggleCompareById(' + c.id + ')">对比</button>';
    if (ctx === 'mycases') {
      actions += '<button class="btn btn-ghost btn-sm" onclick="GDCase.edit(' + c.id + ')">编辑</button>';
      actions += '<button class="btn btn-danger btn-sm" onclick="GDCase.del(' + c.id + ')">删除</button>';
    } else if (ctx === 'nas') {
      actions += '<button class="btn btn-primary btn-sm" onclick="GDCase.reuse(' + c.id + ')">复用</button>';
      if (opts.extraActions) actions += opts.extraActions(c);
    } else {
      actions += '<button class="btn btn-primary btn-sm" onclick="GDCase.reuse(' + c.id + ')">复用</button>';
    }
    return '' +
    '<div class="case-card">' +
      '<div class="card-thumb" onclick="GDCase.view(' + c.id + ')">' +
        gdThumbInner(theme(c), 200 + (c.id || 0), { space: c.space, style: c.style }) +
        '<div class="case-thumb-badges">' + vrBadge + '</div>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="card-body-title">' + c.name + '</div>' +
        '<div class="card-body-meta">' + meta + '</div>' +
        '<div class="card-body-tags">' +
          '<span class="tag ' + tagClass(c.style) + '">' + c.style + '</span>' +
          (c.space ? '<span class="tag tag-green">' + c.space + '</span>' : '') +
          (c.country ? '<span class="tag tag-orange">' + c.country + '</span>' : '') +
        '</div>' +
        '<div class="card-body-meta" style="font-size:11px;color:var(--text-muted);">' +
          (c.reuseCount != null ? '🔄 ' + c.reuseCount + ' 次复用' : '') +
          (c.time ? ' · ' + c.time : '') +
          (sub ? '<br>' + sub : '') +
        '</div>' +
        '<div class="card-body-footer" style="flex-wrap:wrap;gap:6px;">' + actions + '</div>' +
      '</div>' +
    '</div>';
  }

  // ---- Lookup: pages register their dataset via GDCase.setSource ----
  var SOURCE = function () { return []; };
  var CALLBACKS = {};
  function setSource(fn, callbacks) { SOURCE = fn; CALLBACKS = callbacks || {}; }
  function find(id) { return SOURCE().find(function (c) { return c.id === id; }); }

  // ---- Detail modal ----
  function openDetail(id) {
    var c = find(id); if (!c) return;
    GDCase._current = id;
    var prods = caseProducts(c), models = caseModels(c), cads = caseCads(c);
    var body = document.getElementById('gdcaseBody');
    body.innerHTML =
      '<div class="case-detail-thumb" style="height:220px;border-radius:var(--radius);overflow:hidden;margin-bottom:16px;position:relative;">' +
        gdThumbInner(theme(c), 200 + c.id, { space: c.space, style: c.style }) +
        (hasVR(c) ? '<button class="btn btn-primary case-detail-vr" onclick="GDCase.view(' + c.id + ')">▶ 进入 VR 全景</button>' : '') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;font-size:13px;">' +
        kv('案例名称', c.name) + kv('设计师', (c.designer||'') + (c.designerId ? '（' + c.designerId + '）':'')) +
        kv('风格', c.style) + kv('空间', c.space || '-') +
        kv('面积', (c.area||'-') + '㎡') + kv('预算', '¥' + (c.budget||'-') + '万') +
        kv('国家', c.country || '-') + kv('创建时间', c.time || '-') +
        kv('复用次数', (c.reuseCount!=null?c.reuseCount:'-') + ' 次') + kv('案例编号', c.number || '-') +
      '</div>' +
      section('产品清单', table(['产品名','SKU','品类','数量','操作'],
        prods.map(function (p) { return [p.name, p.sku, p.cat, p.qty, dlBtn(p.name)]; }))) +
      section('3D模型文件', table(['文件名','格式','大小','操作'],
        models.map(function (m) { return [m.file, m.fmt, m.size, dlBtn(m.file)]; }))) +
      section('CAD图纸列表', table(['文件名','格式','操作'],
        cads.map(function (d) { return [d.file, d.fmt, dlBtn(d.file)]; }))) +
      '<h4 style="margin:0 0 8px;">客户交付资料</h4>' +
      '<div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">' +
        '<button class="btn btn-secondary" onclick="GDCase.viewPPT(' + c.id + ')">📄 PPT设计提案</button>' +
        '<button class="btn btn-secondary" onclick="GDCase.view(' + c.id + ')">' + (hasVR(c)?'🔗 全屋VR全景':'🖼 案例效果图') + '</button>' +
        '<button class="btn btn-secondary" onclick="GDCase.exportBOM(' + c.id + ')">📋 导出选品清单(BOM)</button>' +
      '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
        '<button class="btn btn-primary btn-lg" onclick="GDCase.reuse(' + c.id + ')">🔄 一键复用</button>' +
        '<button class="btn btn-secondary" onclick="simulateDownload(\'全部资料\')">📦 下载全部资料</button>' +
        '<button class="btn btn-ghost" onclick="closeModal(\'gdcaseModal\')">关闭</button>' +
      '</div>' +
      '<div class="reuse-steps" id="gdReuseSteps" style="display:none;">' +
        '<div class="reuse-step" id="grs1"><div class="reuse-step-icon">📋</div><div class="reuse-step-text">创建副本</div></div>' +
        '<div class="reuse-step" id="grs2"><div class="reuse-step-icon">📁</div><div class="reuse-step-text">拷贝文件</div></div>' +
        '<div class="reuse-step" id="grs3"><div class="reuse-step-icon">✅</div><div class="reuse-step-text">完成</div></div>' +
      '</div>';
    document.getElementById('gdcaseTitle').textContent = c.name;
    openModal('gdcaseModal');
  }
  function kv(k, v) { return '<div><strong>' + k + '：</strong>' + v + '</div>'; }
  function section(title, inner) { return '<h4 style="margin:0 0 8px;">' + title + '</h4><div class="table-wrap" style="margin-bottom:20px;">' + inner + '</div>'; }
  function table(heads, rows) {
    return '<table><thead><tr>' + heads.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table>';
  }
  function dlBtn(label) { return '<button class="btn btn-ghost btn-sm" onclick="simulateDownload(\'' + String(label).replace(/'/g, '') + '\')">下载</button>'; }

  // ---- View: VR if available, else image lightbox ----
  function view(id) {
    var c = find(id); if (!c) return;
    if (hasVR(c)) {
      document.getElementById('gdvrTitle').textContent = 'VR 全景 · ' + c.name;
      document.getElementById('gdvrFrame').src = vrUrl(c);
      openModal('gdvrModal');
    } else {
      document.getElementById('gdimgTitle').textContent = '案例效果图 · ' + c.name;
      document.getElementById('gdimgBody').innerHTML =
        [0,1,2,3].map(function (i) {
          return '<div class="card-thumb" style="height:200px;border-radius:10px;overflow:hidden;">' +
            gdThumbInner(theme(c), 800 + c.id * 10 + i, { space: c.space, style: c.style }) + '</div>';
        }).join('');
      openModal('gdimgModal');
    }
  }
  function closeVR() { document.getElementById('gdvrFrame').src = ''; closeModal('gdvrModal'); }

  // ---- PPT proposal viewer ----
  var PPT = { title: 'Villa Design', chapters: [
    { name:'封面', icon:'🏠' }, { name:'平面图', icon:'📐' }, { name:'客厅', icon:'🛋️' },
    { name:'餐厅', icon:'🍽️' }, { name:'主卧', icon:'🛏️' }, { name:'书房', icon:'💼' }
  ]};
  function viewPPT(id) {
    var c = find(id); if (!c) return;
    GDCase._pptCase = id; GDCase._pptIdx = 0;
    document.getElementById('gdpptTitle').textContent = 'PPT 设计提案 · ' + c.name;
    document.getElementById('gdpptSide').innerHTML = PPT.chapters.map(function (ch, i) {
      return '<div class="ppt-chapter' + (i===0?' active':'') + '" onclick="GDCase.pptGo(' + i + ')">' + ch.icon + ' ' + ch.name + '</div>';
    }).join('');
    pptRender();
    openModal('gdpptModal');
  }
  function pptGo(i) { GDCase._pptIdx = i; document.querySelectorAll('#gdpptSide .ppt-chapter').forEach(function (el, j) { el.classList.toggle('active', j === i); }); pptRender(); }
  function pptRender() {
    var c = find(GDCase._pptCase); var ch = PPT.chapters[GDCase._pptIdx];
    document.getElementById('gdpptCanvas').innerHTML =
      '<div style="width:100%;max-width:640px;aspect-ratio:3/2;border-radius:12px;overflow:hidden;position:relative;box-shadow:var(--shadow-lg);">' +
      gdThumbInner(theme(c), 9000 + GDCase._pptIdx, { space: c.space, style: c.style }) +
      '<div style="position:absolute;left:0;right:0;bottom:0;padding:14px 18px;background:linear-gradient(transparent,rgba(0,0,0,.6));color:#fff;">' +
      '<div style="font-size:18px;font-weight:700;">' + ch.icon + ' ' + ch.name + '</div></div></div>';
  }

  // ---- Compare (uses common.js toggleCompare/openCompareModal) ----
  function toggleCompareById(id) {
    var c = find(id); if (!c) return;
    if (typeof toggleCompare === 'function') toggleCompare(c);
  }

  // ---- Reuse (persists via common.js gdPersistReuse) ----
  function reuse(id) {
    var c = find(id); if (!c) return;
    // ensure detail modal open to show steps; if not, just animate toast
    var steps = document.getElementById('gdReuseSteps');
    if (!document.getElementById('gdcaseModal').classList.contains('show')) openDetail(id);
    steps = document.getElementById('gdReuseSteps');
    if (steps) {
      steps.style.display = 'flex';
      ['grs1','grs2','grs3'].forEach(function (sid, i) {
        var el = document.getElementById(sid); if (!el) return;
        el.className = 'reuse-step';
        setTimeout(function () { el.classList.add('active'); setTimeout(function () { el.classList.add('done'); }, 500); }, i * 700);
      });
    }
    setTimeout(function () {
      if (typeof gdPersistReuse === 'function') gdPersistReuse(c, { name: '陈磊', id: '001' });
      c.reuseCount = (c.reuseCount || 0) + 1;
      if (CALLBACKS.afterReuse) CALLBACKS.afterReuse();
      showToast('success', '案例复用成功！已创建独立副本到「我的案例」');
    }, 2300);
  }

  // ---- BOM export ----
  function exportBOM(id) {
    var c = find(id); if (!c) return;
    var prods = caseProducts(c);
    var lines = ['案例选品清单 (BOM) — ' + c.name, '案例编号: ' + (c.number||'-'), '设计师: ' + (c.designer||'-'), '', '产品名,SKU,品类,数量'];
    prods.forEach(function (p) { lines.push([p.name, p.sku, p.cat, p.qty].join(',')); });
    var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'BOM-' + (c.number || c.name) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('success', '已导出选品清单（BOM）CSV');
  }

  // ---- Edit / Delete (mycases only; delegate to page callbacks) ----
  function edit(id) { if (CALLBACKS.onEdit) CALLBACKS.onEdit(id); }
  function del(id) { if (CALLBACKS.onDelete) CALLBACKS.onDelete(id); }

  // ---- Inject shared modals once ----
  function injectModals() {
    if (document.getElementById('gdcaseModal')) return;
    var html =
    '<div class="modal-overlay" id="gdcaseModal"><div class="modal modal-lg">' +
      '<div class="modal-header"><h2 id="gdcaseTitle">案例详情</h2><button class="modal-close" onclick="closeModal(\'gdcaseModal\')">✕</button></div>' +
      '<div class="modal-body" id="gdcaseBody"></div></div></div>' +
    '<div class="modal-overlay" id="gdvrModal"><div class="modal modal-lg" style="height:84vh;">' +
      '<div class="modal-header"><h2 id="gdvrTitle">VR 全景</h2><button class="modal-close" onclick="GDCase.closeVR()">✕</button></div>' +
      '<iframe id="gdvrFrame" style="width:100%;height:calc(100% - 56px);border:none;" allow="fullscreen"></iframe></div></div>' +
    '<div class="modal-overlay" id="gdimgModal"><div class="modal modal-lg">' +
      '<div class="modal-header"><h2 id="gdimgTitle">案例效果图</h2><button class="modal-close" onclick="closeModal(\'gdimgModal\')">✕</button></div>' +
      '<div class="modal-body" id="gdimgBody" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"></div></div></div>' +
    '<div class="modal-overlay" id="gdpptModal"><div class="modal modal-lg" style="max-width:1000px;">' +
      '<div class="modal-header"><h2 id="gdpptTitle">PPT 设计提案</h2><button class="modal-close" onclick="closeModal(\'gdpptModal\')">✕</button></div>' +
      '<div class="ppt-layout"><div class="ppt-side" id="gdpptSide"></div><div class="ppt-main"><div class="ppt-canvas" id="gdpptCanvas"></div></div></div></div></div>';
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
  }
  document.addEventListener('DOMContentLoaded', injectModals);

  window.GDCase = {
    renderCard: renderCard, setSource: setSource, openDetail: openDetail,
    view: view, closeVR: closeVR, viewPPT: viewPPT, pptGo: pptGo,
    toggleCompareById: toggleCompareById, reuse: reuse, exportBOM: exportBOM,
    edit: edit, del: del, hasVR: hasVR, _current: null, _pptCase: null, _pptIdx: 0
  };
})();
