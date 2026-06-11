/* ================================================================
   gdpoints.js — 站点积分钱包 / 案例积分 / 复用扣分 / 审核
   ----------------------------------------------------------------
   规则（演示）：
   - 每位设计师有一个积分钱包，部门负责人每月发放初始积分（默认 5000）。
   - 设计师产出优秀案例 → 案例被审核通过后获得积分（案例可设积分价 price）。
   - 复用他人案例 → 需支付该案例的积分价，转给案例作者。
   - 优秀设计师（产出多、被复用多）积分 > 初始；大量复用他人者积分 < 初始。
   localStorage:
     gd-wallets      = { 设计师名: {balance, initial, history:[{t,delta,reason}]} }
     gd-case-points  = { 案例id: {price, status:'待审核'|'已通过'|'已驳回', author} }
   ================================================================ */
(function () {
  var INIT_GRANT = 5000;
  var MEMBERS = ['陈磊','林悦','王明远','张薇','李强','孙敏','周杰'];

  function load(key, def) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; } }
  function save(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

  function wallets() {
    var w = load('gd-wallets', null);
    if (!w) {
      w = {};
      // 演示初始：有人高于初始（优秀），有人低于初始（大量复用）
      var seed = { '陈磊': 7200, '林悦': 6100, '王明远': 5400, '张薇': 4800, '李强': 3600, '孙敏': 5000, '周杰': 4200 };
      MEMBERS.forEach(function (m) {
        w[m] = { balance: seed[m] != null ? seed[m] : INIT_GRANT, initial: INIT_GRANT, history: [
          { t: '2026-05-01', delta: INIT_GRANT, reason: '本月初始积分发放' }
        ] };
      });
      save('gd-wallets', w);
    }
    return w;
  }
  function casePoints() { return load('gd-case-points', {}); }

  function getBalance(name) { var w = wallets(); return w[name] ? w[name].balance : 0; }
  function getInitial(name) { var w = wallets(); return w[name] ? w[name].initial : INIT_GRANT; }
  function getWallet(name) { return wallets()[name] || { balance: 0, initial: INIT_GRANT, history: [] }; }

  function addPoints(name, delta, reason) {
    var w = wallets();
    if (!w[name]) w[name] = { balance: 0, initial: INIT_GRANT, history: [] };
    w[name].balance += delta;
    w[name].history.unshift({ t: (window.gdToday ? gdToday() : '2026-05-23'), delta: delta, reason: reason });
    save('gd-wallets', w);
    return w[name].balance;
  }

  // 部门负责人发放积分（可对单人或全员）
  function grantMonthly(amount, names) {
    amount = amount || INIT_GRANT;
    (names || MEMBERS).forEach(function (m) { addPoints(m, amount, '部门负责人发放月度积分'); });
  }

  // 案例积分价 + 审核状态
  function getCasePrice(id) { var cp = casePoints(); return cp[id] ? cp[id].price : null; }
  function getCaseStatus(id) { var cp = casePoints(); return cp[id] ? cp[id].status : '未提交'; }
  function setCasePoints(id, price, author, status) {
    var cp = casePoints();
    cp[id] = { price: price, author: author, status: status || '待审核' };
    save('gd-case-points', cp);
  }
  function reviewCase(id, approve) {
    var cp = casePoints();
    if (!cp[id]) return;
    cp[id].status = approve ? '已通过' : '已驳回';
    save('gd-case-points', cp);
    if (approve) {
      // 案例通过：作者获得"产出奖励"（价格的一半，封顶 300）
      var reward = Math.min(300, Math.round((cp[id].price || 0) / 2));
      if (reward > 0) addPoints(cp[id].author, reward, '优秀案例《' + id + '》审核通过奖励');
    }
  }

  // 复用结算：复用者向作者支付该案例积分价
  // 返回 {ok, msg}
  function reuseSettle(caseId, price, author, reuser) {
    if (!price) price = 0;
    if (reuser === author) return { ok: true, msg: '复用自己的案例，无需支付积分' };
    var bal = getBalance(reuser);
    if (bal < price) return { ok: false, msg: '积分不足（需 ' + price + '，当前 ' + bal + '）' };
    if (price > 0) {
      addPoints(reuser, -price, '复用《' + author + '》的案例支付积分');
      addPoints(author, price, '案例被 ' + reuser + ' 复用获得积分');
    }
    return { ok: true, msg: price > 0 ? ('已支付 ' + price + ' 积分给 ' + author) : '免费复用' };
  }

  // 排行：返回 [{name, balance, initial, delta}]
  function ranking() {
    var w = wallets();
    return MEMBERS.map(function (m) {
      var x = w[m] || { balance: 0, initial: INIT_GRANT };
      return { name: m, balance: x.balance, initial: x.initial, delta: x.balance - x.initial };
    }).sort(function (a, b) { return b.balance - a.balance; });
  }

  window.GDPoints = {
    INIT_GRANT: INIT_GRANT, MEMBERS: MEMBERS,
    getBalance: getBalance, getInitial: getInitial, getWallet: getWallet,
    addPoints: addPoints, grantMonthly: grantMonthly,
    getCasePrice: getCasePrice, getCaseStatus: getCaseStatus, setCasePoints: setCasePoints,
    reviewCase: reviewCase, reuseSettle: reuseSettle, ranking: ranking
  };
})();
