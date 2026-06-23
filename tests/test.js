/* George Design — logic self-test (Node, no deps)
   Loads common.js in a minimal sandbox and asserts the pure logic
   we added/fixed: reuse-copy, persistence shape, navigateTo map, photo URLs. */
const fs=require('fs'), vm=require('vm');
const store={};
const g={ console, Math, JSON, Date, encodeURIComponent, Array, Object, String,
  window:{}, document:{addEventListener(){},querySelectorAll(){return [];}},
  localStorage:{getItem(k){return store[k]||null;},setItem(k,v){store[k]=v;},removeItem(k){delete store[k];}},
  location:{href:''}, setTimeout:()=>0, setInterval:()=>0, clearInterval:()=>{} };
g.window.location=g.location;
vm.createContext(g);
vm.runInContext(fs.readFileSync(__dirname+'/../common.js','utf8'), g);
vm.runInContext(fs.readFileSync(__dirname+'/../gdcase.js','utf8'), g);

let pass=0, fail=0, groups={};
function t(grp,name,fn){ try{fn();pass++;(groups[grp]=groups[grp]||[]).push(['✓',name]);}
  catch(e){fail++;(groups[grp]=groups[grp]||[]).push(['✗',name+' — '+e.message]);} }
function eq(a,b,m){ if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error((m||'expected')+' '+JSON.stringify(b)+' got '+JSON.stringify(a)); }
function ok(v,m){ if(!v) throw new Error(m||'expected truthy'); }

const src={ id:8, name:'现代简约三居室', designer:'陈磊', designerId:'001', style:'现代简约',
  space:'客厅', area:140, budget:25, country:'欧美', reuseCount:56, time:'2026-05-10', theme:'modern', number:'001-Europe-案例008' };

t('复用副本','生成独立副本（非同引用）',()=>{ const r=g.gdMakeReuseCopy(src,{name:'陈磊',id:'001'}); ok(r.copy!==src); ok(r.copy.id!==src.id); });
t('复用副本','副本归属复用人',()=>{ const r=g.gdMakeReuseCopy(src,{name:'林悦',id:'002'}); eq(r.copy.designer,'林悦'); eq(r.copy.designerId,'002'); });
t('复用副本','副本 origin 指向源案例',()=>{ const r=g.gdMakeReuseCopy(src,{name:'陈磊',id:'001'}); eq(r.copy.origin,8); });
t('复用副本','副本复用次数归零',()=>{ const r=g.gdMakeReuseCopy(src,{name:'陈磊',id:'001'}); eq(r.copy.reuseCount,0); });
t('复用副本','保留风格/空间/面积/预算',()=>{ const r=g.gdMakeReuseCopy(src,{name:'陈磊',id:'001'}); eq([r.copy.style,r.copy.space,r.copy.area,r.copy.budget],['现代简约','客厅',140,25]); });
t('复用副本','NAS 副本路径含 reuse 与编号',()=>{ const r=g.gdMakeReuseCopy(src,{name:'陈磊',id:'001'}); ok(r.nasPath.indexOf('reuse/')>=0); ok(r.nasPath.indexOf(r.copy.number)>=0); });
t('复用副本','复用记录含来源/复用人',()=>{ const r=g.gdMakeReuseCopy(src,{name:'王明远',id:'003'}); eq(r.record.from,'现代简约三居室'); eq(r.record.fromNumber,'001-Europe-案例008'); eq(r.record.by,'王明远'); });

t('持久化','gdPersistReuse 写入三处',()=>{
  Object.keys(store).forEach(k=>delete store[k]);
  g.gdPersistReuse(src,{name:'陈磊',id:'001'});
  const mine=JSON.parse(store['gd-mycases']||'[]');
  const copies=JSON.parse(store['gd-nascopies']||'[]');
  const recs=JSON.parse(store['gd-reuse']||'[]');
  ok(mine.length===1,'mine'); ok(copies.length===1,'copies'); ok(recs.length===1,'recs');
});
t('持久化','多次复用累加',()=>{
  Object.keys(store).forEach(k=>delete store[k]);
  g.gdPersistReuse(src,{name:'陈磊',id:'001'}); g.gdPersistReuse(src,{name:'陈磊',id:'001'});
  eq(JSON.parse(store['gd-mycases']).length,2);
});
t('持久化','GDStore 读默认值不抛错',()=>{ eq(g.GDStore.get('nope', []), []); });

t('navigateTo','页面->文件映射正确',()=>{
  g.navigateTo('cases'); eq(g.location.href,'cases.html');
  g.navigateTo('nas'); eq(g.location.href,'nas.html');
  g.navigateTo('library'); eq(g.location.href,'index.html');
});

t('真实图片','gdPhoto 生成确定性 URL',()=>{
  const a=g.gdPhoto('living room',123), b=g.gdPhoto('living room',123);
  eq(a,b); ok(a.indexOf('loremflickr')>=0); ok(a.indexOf('lock=123')>=0);
});
t('真实图片','gdThumbInner 产品主题嵌入 img + 渐变兜底',()=>{
  const h=g.gdThumbInner('sofa', 5);
  ok(h.indexOf('theme-sofa')>=0,'gradient class'); ok(h.indexOf('gd-real-img')>=0,'img'); ok(h.indexOf('onerror')>=0,'fallback');
});
t('真实图片','gdThumbInner 案例用空间+风格关键词',()=>{
  const h=g.gdThumbInner('modern', 9, {space:'客厅', style:'北欧'});
  ok(h.indexOf('gd-real-img')>=0); ok(h.indexOf('theme-modern')>=0);
});
t('日期','gdToday 格式 YYYY-MM-DD',()=>{ ok(/^\d{4}-\d{2}-\d{2}$/.test(g.gdToday())); });

/* ===== Part 2: 个人产品库 ===== */
t('产品库','GDLib 新建/添加/计数/移除',()=>{
  g.GDLib.save([]); const id=g.GDLib.addFolder('非洲风格');
  ok(g.GDLib.addItem(id,7),'addItem'); eq(g.GDLib.totalItems(),1);
  ok(!g.GDLib.addItem(id,7),'去重'); g.GDLib.removeItem(id,7); eq(g.GDLib.totalItems(),0);
});
t('产品库','GDLib ensureDefault 建默认夹',()=>{ g.localStorage.removeItem('gd-prod-folders'); const f=g.GDLib.ensureDefault(); ok(f.length>=1); });
t('产品库','对比矩阵：相同值不标差异，不同值标差异',()=>{
  const rows=g.gdProductCompareRows([
    {name:'A',sku:'s1',style:'北欧',space:'客厅',category:'沙发',price:100,downloads:5},
    {name:'B',sku:'s2',style:'北欧',space:'卧室',category:'床',price:100,downloads:9}]);
  ok(!rows.find(r=>r.label==='风格').diff,'风格同');
  ok(!rows.find(r=>r.label==='价格').diff,'价格同');
  ok(rows.find(r=>r.label==='空间').diff,'空间异');
  ok(rows.find(r=>r.label==='品类').diff,'品类异');
});

/* ===== Part 3: 统一案例卡片 ===== */
const GDCase=g.window.GDCase;
const tc={ id:1,name:'测试案例',designer:'陈磊',designerId:'001',style:'北欧',space:'客厅',area:80,budget:12,country:'美国',reuseCount:5,time:'2026-05-01',number:'001-America-案例001' };
t('统一案例','renderCard 案例库含 复用',()=>{ ok(GDCase.renderCard(tc,{context:'cases'}).indexOf('复用')>=0); });
t('统一案例','renderCard 我的案例含 编辑+删除',()=>{ const h=GDCase.renderCard(tc,{context:'mycases'}); ok(h.indexOf('编辑')>=0&&h.indexOf('删除')>=0); });
t('统一案例','renderCard NAS 含 extraActions',()=>{ ok(GDCase.renderCard(tc,{context:'nas',extraActions:()=>'<b>下载到我的NAS</b>'}).indexOf('下载到我的NAS')>=0); });
t('统一案例','三上下文均含 详情/对比/看图按钮',()=>{
  ['cases','mycases','nas'].forEach(ctx=>{ const h=GDCase.renderCard(tc,{context:ctx}); ok(h.indexOf('详情')>=0&&h.indexOf('对比')>=0,ctx); });
});
t('统一案例','hasVR 按编号判定',()=>{
  ok(GDCase.hasVR({number:'001-America-案例001'}),'有VR');
  ok(!GDCase.hasVR({number:'999-X-案例999'}),'无VR');
});

/* ===== 导航合并 ===== */
t('导航','navigateTo 指向新页面',()=>{
  g.navigateTo('ranking'); eq(g.location.href,'ranking.html');
  g.navigateTo('team'); eq(g.location.href,'team.html');
  g.navigateTo('home'); eq(g.location.href,'dashboard.html');
});

console.log('\n══════════════════════════════════════════════');
console.log('  George Design · 逻辑自测报告');
console.log('══════════════════════════════════════════════');
Object.keys(groups).forEach(grp=>{ console.log('\n【'+grp+'】'); groups[grp].forEach(r=>console.log('  '+r[0]+' '+r[1])); });
console.log('\n──────────────────────────────────────────────');
console.log('  通过 '+pass+' / '+(pass+fail)+'　失败 '+fail);
console.log('══════════════════════════════════════════════\n');
process.exit(fail?1:0);
