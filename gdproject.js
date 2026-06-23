/* ================================================================
   gdproject.js — 共享「项目 → 空间 → 空间详情」层级渲染器
   被 灵感库(cases) / 我的案例(mycases) / NAS 复用。
   依赖：common.js(gdThumbInner, showToast) + gdcase.js(GDCase)
   用法：
     GDProject.mount({
       rootEl, projects, getProjects, title, rootLabel,
       editable:false, onEdit, onDelete, onCreate, extraSpaceActions,
       afterChange
     });
   ================================================================ */
(function () {
  var SPACE_ICON = { '客厅':'🛋️','卧室':'🛏️','主卧':'🛏️','次卧':'🛏️','厨房':'🍳','餐厅':'🍽️','书房':'📚','茶室':'🍵','卫生间':'🚿','阳台':'🌿','儿童房':'🧸','玄关':'🚪','衣帽间':'👔','客卧':'🛏️' };
  function tagClass(s){ var m={'现代简约':'tag-blue','北欧':'tag-green','新中式':'tag-purple','轻奢':'tag-orange','工业风':'tag-red','日式':'tag-pink','美式':'tag-cyan','法式':'tag-purple','侘寂':'tag-green','地中海':'tag-blue','极简':'tag-blue','原木':'tag-green'}; return m[s]||'tag-blue'; }
  function icon(sp){ return SPACE_ICON[sp] || '🏠'; }
  function uniq(arr){ var seen={},out=[]; arr.forEach(function(x){ if(x && !seen[x]){ seen[x]=1; out.push(x); } }); return out; }

  // 把项目里的 spaces 字符串数组展开成带唯一 id 的空间单元
  function expandSpaces(projects) {
    var all = [];
    projects.forEach(function (p) {
      p.spaceUnits = (p.spaces || []).map(function (sp, i) {
        // 积分价：基于预算与复用热度，稳定生成（80~400）
        var price = p.casePoints != null ? p.casePoints
          : Math.max(80, Math.min(400, Math.round((p.budget || 20) * 3 + (p.reuseCount || 0) * 2)));
        var u = {
          id: p.id * 100 + i,
          projId: p.id,
          name: p.name + ' · ' + sp,
          spaceName: sp,
          designer: p.designer, designerId: p.designerId,
          style: p.style, space: sp, country: p.country,
          area: p.spaces.length ? Math.round((p.area || 0) / p.spaces.length) : p.area,
          budget: p.spaces.length ? Math.round((p.budget || 0) / p.spaces.length) : p.budget,
          reuseCount: Math.max(2, Math.round((p.reuseCount || 0) / Math.max(1, p.spaces.length))),
          time: p.time, theme: p.theme,
          number: (p.number || ('PRJ' + p.id)) + '-' + sp,
          hasVR: p.hasVR,
          dept: p.dept || '',
          points: price,
          software: p.software || null,
          delivery: p.delivery || (p.hasVR ? 'vr' : 'effect'),
          spaceList: (p.spaces || []).slice()
        };
        // 注册积分价（若未注册）：默认已通过审核
        if (window.GDPoints && GDPoints.getCasePrice(u.id) == null) {
          GDPoints.setCasePoints(u.id, price, p.designer || '未知', '已通过');
        }
        all.push(u);
        return u;
      });
    });
    return all;
  }

  function mount(cfg) {
    var state = {
      cfg: cfg,
      currentProj: null,
      projects: cfg.getProjects ? cfg.getProjects() : cfg.projects,
    };
    cfg._state = state;

    // 注册 GDCase 数据源 = 所有空间单元
    function refreshSource() {
      state.projects = cfg.getProjects ? cfg.getProjects() : cfg.projects;
      state.spaces = expandSpaces(state.projects);
      if (window.GDCase) {
        GDCase.setSource(function () { return state.spaces; }, {
          afterReuse: function () { if (state.currentProj) renderSpaces(state.currentProj.id); if (cfg.afterChange) cfg.afterChange(); },
          onEdit: cfg.onEditSpace || function(){},
          onDelete: cfg.onDeleteSpace || function(){}
        });
      }
    }

    // 渲染骨架
    state.root = document.getElementById(cfg.rootEl);
    state.root.innerHTML =
      '<div class="crumb" id="gp-crumb"></div>' +
      '<div id="gp-projects">' +
        (cfg.hideToolbar ? '' : '<div class="gp-toolbar" id="gp-toolbar"></div>') +
        '<div style="margin-bottom:12px;font-size:12px;color:var(--text-secondary);" id="gp-count"></div>' +
        '<div class="folder-wrap" id="gp-grid"></div>' +
      '</div>' +
      '<div id="gp-spaces" style="display:none;">' +
        '<div class="proj-hero" id="gp-hero"></div>' +
        '<h3 style="margin:22px 0 12px;font-size:16px;">项目空间</h3>' +
        '<div class="space-grid" id="gp-spacegrid"></div>' +
      '</div>';

    // 工具栏：丰富筛选（搜索/风格/空间/国家/预算/软件/排序）+ 可选「新建」
    if (!cfg.hideToolbar) {
      var createBtn = cfg.editable && cfg.onCreate
        ? '<button class="btn btn-primary" onclick="GDProject._create(\'' + cfg.rootEl + '\')">＋ ' + (cfg.createLabel || '新建项目') + '</button>'
        : '';
      // 从数据动态汇总可选项
      var projs0 = cfg.getProjects ? cfg.getProjects() : cfg.projects;
      var styles = uniq(projs0.map(function (p) { return p.style; }));
      var countries = uniq(projs0.map(function (p) { return p.country; }));
      var spaces = uniq([].concat.apply([], projs0.map(function (p) { return p.spaces || []; })));
      var SW_NAMES = { max:'3DMax', kjl:'酷家乐', swj:'三维家', su:'SketchUp草图大师', cad:'AutoCAD' };
      function opts(arr) { return arr.map(function (x) { return '<option>' + x + '</option>'; }).join(''); }
      var k = cfg.rootEl;
      document.getElementById('gp-toolbar').innerHTML =
        '<div class="gp-filter-row">' +
          '<div class="search-input-wrap gp-search-wrap"><input type="text" placeholder="🔍 搜索案例名 / 设计师 / 编号..." id="gp-search" oninput="GDProject._render(\'' + k + '\')"></div>' +
          createBtn +
        '</div>' +
        '<div class="gp-filter-row">' +
          '<select id="gp-style" onchange="GDProject._render(\'' + k + '\')"><option value="">全部风格</option>' + opts(styles) + '</select>' +
          '<select id="gp-space" onchange="GDProject._render(\'' + k + '\')"><option value="">全部空间</option>' + opts(spaces) + '</select>' +
          '<select id="gp-country" onchange="GDProject._render(\'' + k + '\')"><option value="">全部国家</option>' + opts(countries) + '</select>' +
          '<select id="gp-budget" onchange="GDProject._render(\'' + k + '\')"><option value="">全部预算</option><option value="0-50">50万以下</option><option value="50-100">50-100万</option><option value="100-999">100万以上</option></select>' +
          '<select id="gp-sw" onchange="GDProject._render(\'' + k + '\')"><option value="">全部软件</option>' +
            Object.keys(SW_NAMES).map(function (key) { return '<option value="' + key + '">' + SW_NAMES[key] + '</option>'; }).join('') + '</select>' +
          '<select id="gp-delivery" onchange="GDProject._render(\'' + k + '\')"><option value="">全部交付</option><option value="vr">全屋VR全景</option><option value="effect">全屋效果图</option></select>' +
          '<select id="gp-sort" onchange="GDProject._render(\'' + k + '\')"><option value="newest">最新</option><option value="mostReuse">复用最多</option><option value="budgetHigh">预算高→低</option></select>' +
          '<button class="btn btn-secondary btn-sm" onclick="GDProject._reset(\'' + k + '\')">重置</button>' +
        '</div>';
    }

    function showProjects() {
      state.currentProj = null;
      document.getElementById('gp-projects').style.display = '';
      document.getElementById('gp-spaces').style.display = 'none';
      if (cfg.onTitle) cfg.onTitle(cfg.title);
      document.getElementById('gp-crumb').innerHTML = '<span class="crumb-cur">' + (cfg.rootLabel || '全部项目') + '</span>';
      render();
    }
    function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
    function render() {
      refreshSource();
      var s = (val('gp-search') || '').toLowerCase();
      var style = val('gp-style'), space = val('gp-space'), country = val('gp-country');
      var budget = val('gp-budget'), sw = val('gp-sw'), delivery = val('gp-delivery'), sort = val('gp-sort') || 'newest';
      var list = state.projects.filter(function (p) {
        var hay = ((p.name || '') + (p.designer || '') + (p.number || '')).toLowerCase();
        if (s && hay.indexOf(s) < 0) return false;
        if (style && p.style !== style) return false;
        if (space && (p.spaces || []).indexOf(space) < 0) return false;
        if (country && p.country !== country) return false;
        if (sw) { var psw = Array.isArray(p.software) ? p.software : [p.software]; if (psw.indexOf(sw) < 0) return false; }
        if (delivery && (p.delivery || (p.hasVR ? 'vr' : 'effect')) !== delivery) return false;
        if (budget) { var r = budget.split('-'), lo = +r[0], hi = +r[1]; if (!((p.budget || 0) >= lo && (p.budget || 0) < hi)) return false; }
        return true;
      });
      if (sort === 'newest') list.sort(function (a, b) { return (b.time || '').localeCompare(a.time || ''); });
      if (sort === 'mostReuse') list.sort(function (a, b) { return (b.reuseCount || 0) - (a.reuseCount || 0); });
      if (sort === 'budgetHigh') list.sort(function (a, b) { return (b.budget || 0) - (a.budget || 0); });

      // 活跃筛选数 + 实时计数
      var active = [s, style, space, country, budget, sw, delivery].filter(Boolean).length;
      document.getElementById('gp-count').innerHTML = '共 <strong>' + list.length + '</strong> 个项目' +
        (active ? '　·　已应用 ' + active + ' 个筛选 <a style="color:var(--primary);cursor:pointer;" onclick="GDProject._reset(\'' + cfg.rootEl + '\')">清除</a>' : '');
      if (!list.length) {
        document.getElementById('gp-grid').innerHTML =
          '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);">' +
          '<div style="font-size:40px;margin-bottom:10px;">🔍</div>' +
          '<div style="font-size:15px;margin-bottom:6px;">没有匹配的案例</div>' +
          '<div style="font-size:13px;">试试调整或<a style="color:var(--primary);cursor:pointer;" onclick="GDProject._reset(\'' + cfg.rootEl + '\')">清除全部筛选</a></div></div>';
        return;
      }
      document.getElementById('gp-grid').innerHTML = list.map(function (p) {
        var deliv = p.delivery || (p.hasVR ? 'vr' : 'effect');
        var vr = deliv === 'vr' ? '<span class="tag tag-orange">🥽 全屋VR全景</span>' : '<span class="tag tag-cyan">🖼 全屋效果图</span>';
        var sw = (window.GDCase && GDCase.software) ? GDCase.software(p) : null;
        var swBadge = sw ? '<span class="sw-dot" title="设计软件：' + sw.name + '">' + sw.icon + '</span>' : '';
        var swRow = sw ? '<div class="folder-sw-row" title="本案例由该软件设计制作">' +
            '<span class="folder-sw-label">设计软件：</span>' +
            '<span class="sw-pill">' + sw.icon + ' ' + sw.name + '</span>' +
          '</div>' : '';
        var editBtns = cfg.editable ? '<div class="folder-edit">' +
            '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GDProject._edit(\'' + cfg.rootEl + '\',' + p.id + ')">编辑</button>' +
            '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();GDProject._del(\'' + cfg.rootEl + '\',' + p.id + ')">删除</button></div>'
          : (cfg.copyProject ? '<div class="folder-edit"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GDProject._open(\'' + cfg.rootEl + '\',' + p.id + ')">详情</button><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();GDProject._copy(\'' + cfg.rootEl + '\',' + p.id + ')">📑 复制整个项目</button></div>' : '');
        return '<div class="folder-card has-cover" onclick="GDProject._open(\'' + cfg.rootEl + '\',' + p.id + ')">' +
          '<div class="folder-cover">' + gdThumbInner(p.theme, 500 + p.id, { space: (p.spaces || [''])[0], style: p.style }) +
            '<div class="folder-cover-badge">📁 ' + (p.spaces || []).length + ' 个空间</div>' +
            '<div class="folder-deliver-badge">' + (deliv === 'vr' ? '🥽 VR' : '🖼 效果图') + '</div>' +
            (swBadge ? '<div class="folder-sw-badge" title="设计软件">' + swBadge + '</div>' : '') + '</div>' +
          '<div class="folder-meta">' +
            '<div class="folder-title">' + p.name + '</div>' +
            '<div class="folder-sub">' + (p.designer || '') + ' · ' + (p.area || '-') + '㎡ · ¥' + (p.budget || '-') + '万</div>' +
            '<div class="folder-num" title="' + (function(){ var parts=(p.number||'').split('-'); return parts.length===3 ? ('编号解读：设计师'+parts[0]+' · '+parts[1]+'(国家码) · 该国第'+parseInt(parts[2],10)+'个案例') : '案例编号'; })() + '">🔖 ' + (p.number || '-') + '　·　' + (p.country || '') + '</div>' +
            swRow +
            '<div class="folder-tags"><span class="tag ' + tagClass(p.style) + '">' + p.style + '</span>' + vr +
              '<span class="tag tag-green">🔄 ' + (p.reuseCount || 0) + '</span></div>' +
            editBtns +
          '</div></div>';
      }).join('') || '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px;">' + (cfg.emptyText || '暂无项目') + '</p>';
    }
    function openProject(id) {
      var p = state.projects.find(function (x) { return x.id === id; }); if (!p) return;
      state.currentProj = p;
      document.getElementById('gp-projects').style.display = 'none';
      document.getElementById('gp-spaces').style.display = '';
      if (cfg.onTitle) cfg.onTitle(p.name);
      document.getElementById('gp-crumb').innerHTML =
        '<a class="crumb-link" onclick="GDProject._home(\'' + cfg.rootEl + '\')">' + (cfg.rootLabel || '全部项目') + '</a><span class="crumb-sep">/</span><span class="crumb-cur">' + p.name + '</span>';
      renderSpaces(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function renderSpaces(id) {
      refreshSource();
      var p = state.projects.find(function (x) { return x.id === id; }); if (!p) return;
      state.currentProj = p;
      var first = p.spaceUnits[0];
      var vrBtn = first ? (p.hasVR
        ? '<button class="btn btn-secondary" onclick="GDCase.view(' + first.id + ')">🔗 全屋VR全景</button>'
        : '<button class="btn btn-secondary" onclick="GDCase.view(' + first.id + ')">🖼 全屋效果图</button>') : '';
      var pptBtn = first ? '<button class="btn btn-primary" onclick="GDCase.viewPPT(' + first.id + ')">📄 总PPT设计提案</button>' : '';
      document.getElementById('gp-hero').innerHTML =
        '<div class="proj-hero-cover">' + gdThumbInner(p.theme, 500 + p.id, { space: (p.spaces || [''])[0], style: p.style }) + '</div>' +
        '<div class="proj-hero-info">' +
          '<div class="proj-hero-title">' + p.name + '</div>' +
          '<div class="proj-hero-sub">' + (p.designer || '') + (p.designerId ? '（' + p.designerId + '）' : '') + ' · ' + p.style + ' · ' + (p.area || '-') + '㎡ · ¥' + (p.budget || '-') + '万' + (p.country ? ' · ' + p.country : '') + '</div>' +
          '<div class="proj-hero-desc">整套项目级交付资料：方案提案、全屋漫游与全屋选品清单。进入下方空间查看各空间的产品、模型与图纸。</div>' +
          '<div class="proj-hero-actions">' + pptBtn + vrBtn +
            '<button class="btn btn-secondary" onclick="GDProject._wholeBOM(\'' + cfg.rootEl + '\',' + p.id + ')">📋 导出全屋产品清单</button>' +
            (cfg.editable ? '<button class="btn btn-secondary" onclick="GDProject._edit(\'' + cfg.rootEl + '\',' + p.id + ')">✎ 编辑项目</button>' : '') +
            (cfg.copyProject ? '<button class="btn btn-primary" onclick="GDProject._copy(\'' + cfg.rootEl + '\',' + p.id + ')">📑 复制整个项目</button>' : '') +
          '</div>' +
        '</div>';
      document.getElementById('gp-spacegrid').innerHTML = p.spaceUnits.map(function (u) {
        var extra = cfg.extraSpaceActions ? cfg.extraSpaceActions(u) : '';
        var swObj = (window.GDCase && GDCase.software) ? GDCase.software(u) : null;
        var sw = swObj ? swObj.icon : '';
        var price = (window.GDPoints && GDPoints.getCasePrice(u.id) != null) ? GDPoints.getCasePrice(u.id) : (u.points != null ? u.points : null);
        var pointsBadge = price != null ? '<span class="pts-badge">🪙 ' + price + '</span>' : '';
        return '<div class="space-tile">' +
          '<div class="space-thumb" onclick="GDCase.openDetail(' + u.id + ')">' + gdThumbInner(u.theme, 600 + u.id, { space: u.spaceName, style: u.style }) +
            '<div class="space-icon">' + icon(u.spaceName) + '</div>' + (pointsBadge ? '<div class="space-pts">' + pointsBadge + '</div>' : '') + '</div>' +
          '<div class="space-meta" onclick="GDCase.openDetail(' + u.id + ')">' +
            '<div class="space-name">' + u.spaceName + (sw ? ' <span class="space-sw" title="设计软件：' + swObj.name + '">' + sw + '</span>' : '') + '</div>' +
            '<div class="space-sub">产品清单 · 3D模型 · CAD图纸</div>' +
          '</div>' +
          '<div class="space-actions">' +
            '<button class="btn btn-ghost btn-sm" onclick="GDCase.openDetail(' + u.id + ')">详情</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="GDCase.view(' + u.id + ')">' + ((window.GDCase && GDCase.hasVR(u)) ? 'VR' : '看图') + '</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="GDCase.toggleCompareById(' + u.id + ')">对比</button>' +
            (cfg.editable ? '' : '<button class="btn btn-primary btn-sm" onclick="GDCase.reuse(' + u.id + ')">复用</button>') +
            extra +
          '</div>' +
        '</div>';
      }).join('');
    }

    // 全屋 BOM
    function wholeBOM(id) {
      var p = state.projects.find(function (x) { return x.id === id; }); if (!p) return;
      var lines = ['全屋选品清单 (BOM) — ' + p.name, '项目编号: ' + (p.number || ('PRJ' + p.id)), '设计师: ' + (p.designer || '-'), '', '空间,产品名,SKU,品类,数量'];
      p.spaceUnits.forEach(function (u) {
        var base = u.id;
        [[u.style + '主家具', 'SKU-' + (100 + base), '家具', 1],
         [u.spaceName + '灯具', 'SKU-' + (300 + base), '灯具', 2],
         [u.spaceName + '软装', 'SKU-' + (200 + base), '软装', 3]].forEach(function (r) {
          lines.push([u.spaceName].concat(r).join(','));
        });
      });
      var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = '全屋BOM-' + (p.number || p.id) + '.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      if (window.showToast) showToast('success', '已导出全屋选品清单（含 ' + p.spaceUnits.length + ' 个空间）');
    }

    // Esc 返回
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.currentProj && !document.querySelector('.modal-overlay.show')) showProjects();
    });

    state.showProjects = showProjects;
    state.render = render;
    state.openProject = openProject;
    state.renderSpaces = renderSpaces;
    state.wholeBOM = wholeBOM;

    showProjects();
    return state;
  }

  // 复制整个项目（含全部空间）到「我的案例」
  function copyProjectToMine(k, id) {
    var st = INSTANCES[k]; if (!st) return;
    var projs = st.cfg.getProjects ? st.cfg.getProjects() : st.cfg.projects;
    var p = projs.find(function (x) { return x.id === id; }); if (!p) return;
    if (!confirm('将整个项目「' + p.name + '」复制到我的案例？包含其全部 ' + (p.spaces || []).length + ' 个空间。')) return;
    var ME = (window.GDRole ? GDRole.me() : '陈磊');
    if (window.GDStore) {
      var my = GDStore.get('gd-my-projects', []);
      var nid = my.reduce(function (m, x) { return Math.max(m, x.id); }, 1000) + 1;
      var copy = {
        id: nid, name: p.name + '（复制）', designer: ME, designerId: '001',
        style: p.style || '现代简约', theme: p.theme || 'modern', area: p.area || 120, budget: p.budget || 30,
        country: p.country || '欧美', hasVR: !!p.hasVR, reuseCount: 0, time: (window.gdToday ? gdToday() : '2026-05-23'),
        number: '001-Copy-PRJ' + nid, casePoints: 150, spaces: (p.spaces || []).slice(), copiedFrom: p.name
      };
      my.unshift(copy); GDStore.set('gd-my-projects', my);
      // 积分结算：复制整项目按空间数计费（每空间 80 分）转给原作者
      var msg = '项目已复制到「我的案例」';
      if (window.GDPoints) {
        var owner = p.designer || '未知';
        var cost = (p.spaces || []).length * 80;
        var r = GDPoints.reuseSettle('proj' + id, cost, owner, ME);
        msg += r.ok ? ('，' + r.msg) : ('（' + r.msg + '）');
      }
      if (window.showToast) showToast('success', msg);
    }
  }

  // 静态分发（onclick 里用 rootEl 找到对应实例）
  var INSTANCES = {};
  function _wrap(cfg) { var st = mount(cfg); INSTANCES[cfg.rootEl] = st; return st; }

  window.GDProject = {
    mount: _wrap,
    expandSpaces: expandSpaces,
    _render: function (k) { INSTANCES[k].render(); },
    _home: function (k) { INSTANCES[k].showProjects(); },
    _open: function (k, id) { INSTANCES[k].openProject(id); },
    _wholeBOM: function (k, id) { INSTANCES[k].wholeBOM(id); },
    _create: function (k) { var c = INSTANCES[k].cfg; if (c.onCreate) c.onCreate(); },
    _edit: function (k, id) { var c = INSTANCES[k].cfg; if (c.onEdit) c.onEdit(id); },
    _del: function (k, id) { var c = INSTANCES[k].cfg; if (c.onDelete) c.onDelete(id); },
    _copy: function (k, id) { copyProjectToMine(k, id); },
    _reset: function (k) {
      ['gp-search','gp-style','gp-space','gp-country','gp-budget','gp-sw','gp-delivery'].forEach(function (id) {
        var e = document.getElementById(id); if (e) e.value = '';
      });
      var so = document.getElementById('gp-sort'); if (so) so.value = 'newest';
      INSTANCES[k].render();
    },
    get: function (k) { return INSTANCES[k]; }
  };
})();
