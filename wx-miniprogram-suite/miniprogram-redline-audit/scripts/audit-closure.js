#!/usr/bin/env node
/**
 * 微信小程序「四层交互闭环」审计（通用、可跨项目复用）
 *
 * 用法:  node audit-closure.js <miniprogram根目录>
 *
 * 覆盖四层闭环:
 *   1. 导航闭环  - 目标页存在、API 与页类型匹配(TabBar 页只用 switchTab)、路径为绝对路径
 *   2. 事件闭环  - 每个 wxml 的 bindXxx / catchXxx 方法都在对应页面 JS 的 Page() 顶层方法中存在
 *   3. 数据闭环  - Storage 写入键都有读取(死键 0)；只读未写列出供人工确认(云端/外部注入)
 *   4. 孤儿页    - 每个页面都有入口(被某处 navigate 指向，或在 TabBar)，无进不来出不去的死页
 *
 * 业务强相关项全部下沉到顶部 CFG，按项目改这里即可，不要改逻辑正文:
 *   - 导航封装名(若项目用 app.navTo 之类)
 *   - Storage 封装读写正则(若项目用 app.S/app.L 之类)
 *   - Storage 键前缀(若项目封装自动加前缀，如 'myapp_')
 *
 * 返回码: 0 = 无阻断; 1 = 有阻断(导航 / 事件)。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || '.');

// ===== 按项目改这里 =====
const CFG = {
  // 导航 API（原生 + 常见封装）。顺序：长名在前，避免 navigateTo 被 navTo 截断
  NAV_APIS: ['navigateTo', 'redirectTo', 'reLaunch', 'switchTab', 'navTo', 'switchTo', 'navigate'],
  // Storage 写入键采集（每条正则第 1 捕获组为 key）
  STORAGE_WRITES: [
    /app\.S\(\s*'([^']+)'/g,
    /wx\.setStorageSync\(\s*'([^']+)'/g,
    /wx\.setStorage\(\s*\{\s*key\s*:\s*'([^']+)'/g,
  ],
  // Storage 读取键采集
  STORAGE_READS: [
    /app\.L\(\s*'([^']+)'/g,
    /wx\.getStorageSync\(\s*'([^']+)'/g,
    /wx\.getStorage\(\s*\{\s*key\s*:\s*'([^']+)'/g,
  ],
  // 若项目 Storage 封装自动加前缀，填在这里(如 'myapp_')；否则留空
  KEY_PREFIX: '',
};
// ========================

const IGNORE_DIR = new Set(['node_modules', 'miniprogram_npm', '_lib', 'cloudfunctions', '.git', 'dist', 'assets', '.codebuddy']);

function walk(dir, out, exts) {
  out = out || [];
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (_e) { return out; }
  ents.forEach(function (d) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (IGNORE_DIR.has(d.name)) return;
      walk(p, out, exts);
    } else if (!exts || exts.indexOf(path.extname(d.name)) >= 0) {
      out.push(p);
    }
  });
  return out;
}

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
}

// ---- 收集页面 + TabBar ----
function collectPages() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  const pages = [];
  (cfg.pages || []).forEach(function (p) { pages.push(p); });
  (cfg.subPackages || cfg.subpackages || []).forEach(function (sp) {
    const r = (sp.root || '').replace(/\/$/, '');
    (sp.pages || []).forEach(function (p) { pages.push(r ? r + '/' + p : p); });
  });
  const pageSet = {};
  pages.forEach(function (p) { pageSet['/' + p] = true; });
  const tabSet = {};
  ((cfg.tabBar || {}).list || []).forEach(function (t) { tabSet['/' + t.pagePath] = true; });
  return { pages: pages, pageSet: pageSet, tabSet: tabSet };
}

// ---- 提取页面方法名（兼容 Page({...}) 与 Page(Extras.enhance(PAGE, {...})) 包装） ----
function findMatchParen(src, openIdx) {
  let depth = 0;
  for (let k = openIdx; k < src.length; k++) {
    const c = src[k];
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return k; }
  }
  return -1;
}

// 提取从 openBraceIndex（指向 '{'）开始的对象字面量内的顶层方法名
function methodsInBrace(src, openIdx) {
  let depth = 0, end = -1, inStr = null;
  for (let k = openIdx; k < src.length; k++) {
    const c = src[k];
    if (inStr) { if (c === '\\') { k++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '/' && src[k + 1] === '/') { const nl = src.indexOf('\n', k); k = nl < 0 ? src.length : nl; continue; }
    if (c === '/' && src[k + 1] === '*') { const nl = src.indexOf('*/', k); k = nl < 0 ? src.length : nl + 1; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = k; break; } }
  }
  if (end < 0) return [];
  const body = src.slice(openIdx + 1, end);
  const depthAt = new Array(body.length);
  let d = 0, s2 = null;
  for (let k = 0; k < body.length; k++) {
    const c = body[k];
    if (s2) {
      if (c === '\\') { depthAt[k] = d; k++; if (k < body.length) depthAt[k] = d; continue; }
      if (c === s2) s2 = null; depthAt[k] = d; continue;
    }
    if (c === '"' || c === "'" || c === '`') { s2 = c; depthAt[k] = d; continue; }
    if (c === '/' && body[k + 1] === '/') { const nl = body.indexOf('\n', k); const to = nl < 0 ? body.length : nl; for (; k < to; k++) depthAt[k] = d; k--; continue; }
    if (c === '/' && body[k + 1] === '*') { const nl = body.indexOf('*/', k); const to = nl < 0 ? body.length : nl + 1; for (; k < to; k++) depthAt[k] = d; k--; continue; }
    if (c === '{') { d++; depthAt[k] = d; continue; }
    depthAt[k] = d;
    if (c === '}') d--;
  }
  const names = [];
  const re = /(?:async\s+)?([A-Za-z_$][\w$]*)\s*(?=[:(])/g;
  let m;
  while ((m = re.exec(body))) if (depthAt[m.index] === 0) names.push(m[1]);
  return names;
}

// 从「const/let/var VAR = { ... }」提取方法
function methodsFromVarDef(src, varName) {
  const defRe = new RegExp('(?:const|let|var)\\s+' + varName.replace(/[$]/g, '\\$') + '\\s*=\\s*\\{');
  const dm = defRe.exec(src);
  if (!dm) return [];
  return methodsInBrace(src, dm.index + dm[0].length - 1);
}

function extractPageMethods(src) {
  const idx = src.search(/\bPage\(/);
  if (idx < 0) return [];
  let p = idx + 4;
  while (p < src.length && (src[p] === ' ' || src[p] === '\n' || src[p] === '\t' || src[p] === '\r' || src[p] === '(')) p++;
  const SKIP = { Extras: 1, enhance: 1, Page: 1, require: 1 };
  let names = [];
  if (src[p] === '{') {
    // 直接 Page({ ... })：方法就在花括号内
    names = names.concat(methodsInBrace(src, p));
  } else {
    // 形如 Page(Extras.enhance(PAGE, {...})) / Page(PAGE)：解出被传入的页面对象变量
    const close = findMatchParen(src, idx + 4);
    if (close > 0) {
      const arg = src.slice(p, close);
      const idRe = /[A-Za-z_$][\w$]*/g;
      let m;
      while ((m = idRe.exec(arg))) {
        const v = m[0];
        if (SKIP[v]) continue;
        const got = methodsFromVarDef(src, v);
        if (got.length) { names = names.concat(got); break; }
      }
    }
  }
  // page-extras 的 enhance() 会向每个增强页注入这些通用方法
  ['goHome', 'fillDemoExample', 'onShareAppMessage', 'onShareTimeline'].forEach(function (n) {
    if (names.indexOf(n) < 0) names.push(n);
  });
  return names;
}

/**
 * 在对象字面量（openIdx 指向 '{'）的**顶层**查找 key: { 中 '{' 的位置。
 * 用 sticky 正则保证只从当前下标开始匹配，避免命中 'xxxmethods' 这类后缀。
 */
function findTopKeyBrace(src, openIdx, key) {
  // depth 从 1 起算：openIdx 自身的 '{' 记为第 1 层，
  // 这样成员对象（properties / data …）的闭合 '}' 只会回到 1，
  // 而对象**自身**的闭合 '}' 才会回到 0 —— 只有后者才该终止扫描。
  // （若从 0 起算，第一个成员对象的 '}' 就会误判为结束，methods 永远扫不到。）
  var depth = 1, inStr = null;
  var re = new RegExp(key + '\\s*:\\s*\\{', 'y');
  for (var k = openIdx + 1; k < src.length; k++) {
    var c = src[k];
    if (inStr) {
      if (c === '\\') { k++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '/' && src[k + 1] === '/') { var nl = src.indexOf('\n', k); k = nl < 0 ? src.length : nl; continue; }
    if (c === '/' && src[k + 1] === '*') { var nl2 = src.indexOf('*/', k); k = nl2 < 0 ? src.length : nl2 + 1; continue; }
    if (c === '{') { depth++; continue; }
    if (c === '}') { depth--; if (depth === 0) break; continue; }
    // depth === 1 表示位于该对象字面量的顶层成员位置
    if (depth === 1 && c === key.charAt(0)) {
      var prev = src[k - 1];
      if (prev === '{' || prev === ',' || /\s/.test(prev)) {
        re.lastIndex = k;
        var mm = re.exec(src);
        if (mm) return k + mm[0].length - 1;
      }
    }
  }
  return -1;
}

/**
 * 从 Component({ ... methods: { ... } }) 提取方法名。
 * 为什么需要它：原提取器只认 Page({...}) / Page(Extras.enhance(...))，
 * 自定义组件的事件处理器都挂在 methods 上，导致组件里每个 bindtap 都被误报"方法不存在"。
 */
function extractComponentMethods(src) {
  var idx = src.search(/\bComponent\(/);
  if (idx < 0) return [];
  var p = idx + 9; // 'Component'.length
  while (p < src.length && /[\s(\n\r\t]/.test(src[p])) p++;
  if (src[p] !== '{') return [];
  var mIdx = findTopKeyBrace(src, p, 'methods');
  if (mIdx < 0) return [];
  return methodsInBrace(src, mIdx);
}

function normKey(k) {
  return CFG.KEY_PREFIX ? k.replace(new RegExp('^' + CFG.KEY_PREFIX), '') : k;
}

function main() {
  const JS = walk(ROOT, [], ['.js']);
  const WXML = walk(ROOT, [], ['.wxml']);
  const { pages: PAGES, pageSet: PAGE_SET, tabSet: TAB_SET } = collectPages();

  // 1. 导航闭环
  const navApiAlt = CFG.NAV_APIS.join('|');
  const NAV_RE = new RegExp('(' + navApiAlt + ')\\s*\\(\\s*[\'"]([^\'"]+)[\'"]', 'g');
  const navIssues = [], navAll = [];
  JS.forEach(function (f) {
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    let m; NAV_RE.lastIndex = 0;
    while ((m = NAV_RE.exec(src))) {
      const api = m[1], raw = m[2], url = raw.split('?')[0];
      const line = src.slice(0, m.index).split('\n').length;
      navAll.push({ url: url });
      if (url.charAt(0) !== '/') {
        // switchTo 可能是 Store.switchTo 这类非页面操作（如切当前项目），非页面跳转，跳过
        if (api === 'switchTo') continue;
        navIssues.push({ lvl: '阻断', rel: rel, line: line, msg: '非绝对路径导航：' + api + "('" + raw + "')" }); continue;
      }
      if (!PAGE_SET[url]) { navIssues.push({ lvl: '阻断', rel: rel, line: line, msg: '目标页面不存在：' + api + "('" + url + "')" }); continue; }
      const isTab = !!TAB_SET[url];
      const useTabApi = (api === 'switchTab' || api === 'switchTo');
      const isPushApi = (api === 'navigateTo' || api === 'navTo' || api === 'redirectTo');
      if (isTab && isPushApi) navIssues.push({ lvl: '阻断', rel: rel, line: line, msg: 'TabBar 页必须用 switchTab/switchTo/reLaunch，当前用 ' + api + ' → ' + url });
      else if (!isTab && useTabApi) navIssues.push({ lvl: '阻断', rel: rel, line: line, msg: '非 TabBar 页不能用 ' + api + ' → ' + url });
    }
  });

  // 2. 事件闭环
  const EVT_RE = /\b(?:bind|catch)[:\-]?([a-zA-Z]+)\s*=\s*"([^"]*)"/g;
  const evtIssues = []; let evtTotal = 0;
  WXML.forEach(function (w) {
    const rel = path.relative(ROOT, w).replace(/\\/g, '/');
    const jsPath = w.replace(/\.wxml$/, '.js');
    if (!fs.existsSync(jsPath)) return;
    const jsSrc = fs.readFileSync(jsPath, 'utf8');
    // 页面走 Page({...})，自定义组件走 Component({ methods:{...} })——两处的方法都要算，
    // 否则组件里的事件会被整片误报。
    const methods = extractPageMethods(jsSrc).concat(extractComponentMethods(jsSrc));
    if (!methods.length) return;
    const ms = {}; methods.forEach(function (n) { ms[n] = true; });
    const wsrc = fs.readFileSync(w, 'utf8');
    let m; EVT_RE.lastIndex = 0;
    while ((m = EVT_RE.exec(wsrc))) {
      const handler = m[2].trim();
      if (!handler || handler.indexOf('{') >= 0) continue;
      evtTotal++;
      if (!ms[handler]) {
        const line = wsrc.slice(0, m.index).split('\n').length;
        evtIssues.push({ rel: rel, line: line, evt: m[1], handler: handler });
      }
    }
  });

  // 3. 数据闭环
  const WRITE = {}, READ = {};
  JS.forEach(function (f) {
    const src = stripComments(fs.readFileSync(f, 'utf8'));
    CFG.STORAGE_WRITES.forEach(function (re) { re.lastIndex = 0; let m; while ((m = re.exec(src))) WRITE[normKey(m[1])] = true; });
    CFG.STORAGE_READS.forEach(function (re) { re.lastIndex = 0; let m; while ((m = re.exec(src))) READ[normKey(m[1])] = true; });
  });
  const writeOnly = Object.keys(WRITE).filter(function (k) { return !READ[k]; }).sort();
  const readOnly = Object.keys(READ).filter(function (k) { return !WRITE[k]; }).sort();

  // 4. 孤儿页
  const NAV_TARGET = {};
  navAll.forEach(function (n) { NAV_TARGET[n.url] = true; });
  const LIT_RE = /['"](\/(?:pages|package[A-Za-z][\w]*)\/[^'"?]+)/g;
  JS.forEach(function (f) {
    const src = fs.readFileSync(f, 'utf8');
    let m; LIT_RE.lastIndex = 0;
    while ((m = LIT_RE.exec(src))) NAV_TARGET[m[1]] = true;
  });
  // wxml 内的 <navigator url="..."> 也是静态入口（此前未识别，会误报孤儿页）
  const NAV_WXML = /<navigator\b[^>]*?\burl\s*=\s*["']([^"']+)["']/g;
  WXML.forEach(function (w) {
    const src = fs.readFileSync(w, 'utf8');
    let m; NAV_WXML.lastIndex = 0;
    while ((m = NAV_WXML.exec(src))) {
      const u = m[1].split('?')[0];
      if (u.charAt(0) === '/') NAV_TARGET[u] = true;
    }
  });
  const orphans = PAGES.filter(function (p) { const u = '/' + p; return !NAV_TARGET[u] && !TAB_SET[u]; });

  // ---- 输出 ----
  console.log('=== 交互闭环审计 ===');
  console.log('页面 ' + PAGES.length + '（TabBar ' + Object.keys(TAB_SET).length + '），JS ' + JS.length + '，WXML ' + WXML.length + '，导航调用 ' + navAll.length);

  console.log('\n[1] 导航闭环');
  if (!navIssues.length) console.log('  ✅ ' + navAll.length + ' 处导航路径均存在且 API 正确');
  else navIssues.forEach(function (i) { console.log('  [' + i.lvl + '] ' + i.rel + ':' + i.line + ' ' + i.msg); });

  console.log('\n[2] 事件闭环（绑定点 ' + evtTotal + '）');
  if (!evtIssues.length) console.log('  ✅ 所有绑定方法都能在对应页面 JS 中找到');
  else evtIssues.forEach(function (i) { console.log('  [阻断] ' + i.rel + ':' + i.line + ' bind' + i.evt + '="' + i.handler + '" 在 JS 中不存在'); });

  console.log('\n[3] 数据闭环（写 ' + Object.keys(WRITE).length + ' / 读 ' + Object.keys(READ).length + '）');
  if (writeOnly.length) { console.log('  [建议] 只写未读（潜在死键）：'); writeOnly.forEach(function (k) { console.log('    ' + k); }); }
  else console.log('  ✅ 写入的键都有对应读取');
  if (readOnly.length) { console.log('  [信息] 只读未写（云端/外部注入，需人工确认）：'); readOnly.forEach(function (k) { console.log('    ' + k); }); }
  else console.log('  ✅ 读取的键都有对应写入');

  console.log('\n[4] 孤儿页');
  if (!orphans.length) console.log('  ✅ 全部页面均有页面内入口');
  else orphans.forEach(function (p) { console.log('  [建议] /' + p); });

  const fail = navIssues.length + evtIssues.length;
  console.log('\n-----------------------------');
  console.log(fail ? ('阻断问题 ' + fail + ' 项') : '阻断问题 0 项');
  process.exit(fail ? 1 : 0);
}

main();
