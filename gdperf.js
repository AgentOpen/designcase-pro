/* ================================================================
   gdperf.js — 设计师绩效（佣金）模块
   规则（演示）：
   - 绩效（佣金）= Σ(已交付案例平方数 × 每平佣金单价 × 设计师等级系数)
   - 不同等级佣金比例不同：初级/中级/高级/资深/专家
   - 提供 本月 / 上月 / 本季度 汇总
   依赖：common.js(GDRole)
   ================================================================ */
(function () {
  // 设计师等级：等级 → {label, 每平米基础佣金(元), 等级系数}
  var LEVELS = {
    P1: { label: '初级设计师', perSqm: 8,  factor: 1.0 },
    P2: { label: '中级设计师', perSqm: 12, factor: 1.15 },
    P3: { label: '高级设计师', perSqm: 18, factor: 1.3 },
    P4: { label: '资深设计师', perSqm: 25, factor: 1.5 },
    P5: { label: '专家设计师', perSqm: 35, factor: 1.8 }
  };
  // 每位设计师的等级（演示）
  var DESIGNER_LEVEL = {
    '陈磊': 'P4', '林悦': 'P3', '王明远': 'P3', '张薇': 'P2', '李强': 'P2', '孙敏': 'P1', '周杰': 'P1'
  };

  function levelOf(name) { return DESIGNER_LEVEL[name] || 'P1'; }
  function levelInfo(name) { return LEVELS[levelOf(name)]; }

  // 单个案例佣金 = 平方数 × 每平佣金 × 等级系数
  function caseCommission(area, name) {
    var lv = levelInfo(name);
    return Math.round((area || 0) * lv.perSqm * lv.factor);
  }

  // 演示用：某设计师在某「期间」交付的案例（平方数列表）
  // periods: thisMonth / lastMonth / thisQuarter
  // 用稳定的伪数据（按名字+期间）生成，便于演示
  function seededAreas(name, period) {
    var base = {
      '陈磊':      { thisMonth: [320, 96, 140],      lastMonth: [260, 180],        thisQuarter: [320, 96, 140, 260, 180, 200] },
      '林悦':      { thisMonth: [140, 96],           lastMonth: [120, 90],         thisQuarter: [140, 96, 120, 90, 110] },
      '王明远':    { thisMonth: [90, 280],           lastMonth: [120],             thisQuarter: [90, 280, 120, 150] },
      '张薇':      { thisMonth: [260],               lastMonth: [150, 80],         thisQuarter: [260, 150, 80, 120] },
      '李强':      { thisMonth: [180, 200],          lastMonth: [160],             thisQuarter: [180, 200, 160, 90] },
      '孙敏':      { thisMonth: [210],               lastMonth: [120],             thisQuarter: [210, 120, 80] },
      '周杰':      { thisMonth: [135],               lastMonth: [90, 60],          thisQuarter: [135, 90, 60] }
    };
    return (base[name] && base[name][period]) || [];
  }

  // 汇总某期间：返回 {commission, area, count, perSqm, factor, level, label}
  function summary(name, period) {
    var areas = seededAreas(name, period);
    var lv = levelInfo(name);
    var area = areas.reduce(function (s, a) { return s + a; }, 0);
    var commission = areas.reduce(function (s, a) { return s + caseCommission(a, name); }, 0);
    return { commission: commission, area: area, count: areas.length, perSqm: lv.perSqm, factor: lv.factor, level: levelOf(name), label: lv.label };
  }

  // 团队佣金排行（本月）：[{name, level, label, commission, area}]
  function teamRanking(period) {
    period = period || 'thisMonth';
    return Object.keys(DESIGNER_LEVEL).map(function (n) {
      var s = summary(n, period);
      return { name: n, level: s.level, label: s.label, commission: s.commission, area: s.area };
    }).sort(function (a, b) { return b.commission - a.commission; });
  }

  // ====== 按月数据（用于自定义时间区间查询）======
  // 为每位设计师生成稳定的「年-月 → 案例平方数组」数据（演示：2025-12 ~ 2026-06）
  var MONTHS = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
  function monthlyAreas(name, ym) {
    // 用名字+月份生成稳定伪数据
    var seedStr = name + ym, h = 0;
    for (var i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) % 100000;
    var n = (h % 3) + 1;             // 1~3 个案例
    var areas = [];
    for (var j = 0; j < n; j++) { areas.push(60 + ((h >> (j + 1)) % 7) * 30); } // 60~240㎡
    return areas;
  }
  // 自定义区间查询：from/to 形如 'YYYY-MM'（含端点）。返回该设计师区间汇总
  function rangeSummary(name, from, to) {
    var lv = levelInfo(name), area = 0, commission = 0, count = 0;
    MONTHS.forEach(function (ym) {
      if (ym >= from && ym <= to) {
        var areas = monthlyAreas(name, ym);
        count += areas.length;
        areas.forEach(function (a) { area += a; commission += caseCommission(a, name); });
      }
    });
    return { commission: commission, area: area, count: count, level: levelOf(name), label: lv.label };
  }
  function months() { return MONTHS.slice(); }

  // ====== 部门 / 全公司 聚合 ======
  // 汇总一组设计师在某 period（thisMonth/lastMonth/thisQuarter）的合计
  function groupSummary(names, period) {
    var commission = 0, area = 0, count = 0;
    names.forEach(function (n) { var s = summary(n, period); commission += s.commission; area += s.area; count += s.count; });
    return { commission: commission, area: area, count: count };
  }
  function groupRangeSummary(names, from, to) {
    var commission = 0, area = 0, count = 0;
    names.forEach(function (n) { var s = rangeSummary(n, from, to); commission += s.commission; area += s.area; count += s.count; });
    return { commission: commission, area: area, count: count };
  }
  // 各部门在某 period 的合计（用于总负责人查看分部门数据）
  function deptBreakdown(period) {
    if (!window.GDOrg) return [];
    return GDOrg.allDepts().map(function (d) {
      var g = groupSummary(GDOrg.membersOf(d), period);
      return { dept: d, commission: g.commission, area: g.area, count: g.count };
    });
  }
  function deptRangeBreakdown(from, to) {
    if (!window.GDOrg) return [];
    return GDOrg.allDepts().map(function (d) {
      var g = groupRangeSummary(GDOrg.membersOf(d), from, to);
      return { dept: d, commission: g.commission, area: g.area, count: g.count };
    });
  }

  window.GDPerf = {
    LEVELS: LEVELS,
    levelOf: levelOf,
    levelInfo: levelInfo,
    caseCommission: caseCommission,
    summary: summary,
    teamRanking: teamRanking,
    months: months,
    rangeSummary: rangeSummary,
    groupSummary: groupSummary,
    groupRangeSummary: groupRangeSummary,
    deptBreakdown: deptBreakdown,
    deptRangeBreakdown: deptRangeBreakdown
  };
})();
