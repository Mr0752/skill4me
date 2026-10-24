#!/usr/bin/env node
/**
 * 微信小程序页面四件套完整性 + app.json 注册校验（通用、可跨项目复用）
 *
 * 用法:  node audit-paths.js <miniprogram根目录> [--ignore=dir1,dir2]
 *
 * 检查:
 *   1. app.json 的 pages 与 subPackages 里每个页面，.js/.json/.wxml/.wxss 四件齐全
 *   2. 目录里存在 .wxml 但没在 app.json 注册的"漏注册"页面（孤儿文件）
 *
 * 排除机制（避免把非页面文件误报成孤儿页，导致闸门常年飘红、真问题被淹没）：
 *   1) 内建忽略目录：node_modules / miniprogram_npm / _lib / cloudfunctions / .git / dist / .codebuddy ...
 *   2) 项目根 .redlineignore：每行一条（# 注释），支持「目录名」「相对路径前缀」「foo* 通配」
 *   3) 命令行 --ignore=a,b,c：与 .redlineignore 同语义，临时覆盖用
 *   4) 片段自动识别：被其它 wxml 的 <include src> / <import src> 引用的 .wxml 是模板片段，
 *      本就不是页面（如各页共用的免责声明），不参与孤儿判定
 *
 * 返回码: 0 = 全齐; 1 = 有缺失/漏注册; 2 = 环境/用法错误。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ARGS = process.argv.slice(2);
if (ARGS.includes('-h') || ARGS.includes('--help') || ARGS.length === 0) {
  console.log('用法: node audit-paths.js <miniprogram根目录> [--ignore=dir1,dir2]');
  console.log('排除规则也可写在项目根的 .redlineignore（每行一条，# 注释）');
  process.exit(2);
}
const ROOT = path.resolve(ARGS[0]);
const PIECES = ['js', 'json', 'wxml', 'wxss'];

// 内建忽略：依赖/构建产物/工具脚本/IDE 工程目录，永远不会是小程序页面
const BUILTIN_IGNORE = [
  'node_modules', 'miniprogram_npm', '_lib', 'cloudfunctions',
  '.git', '.svn', '.hg', 'dist', '.codebuddy'
];

function norm(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function loadIgnoreFile() {
  const f = path.join(ROOT, '.redlineignore');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s && s.charAt(0) !== '#');
}

function cliIgnore() {
  const out = [];
  ARGS.forEach(a => {
    if (a.indexOf('--ignore=') === 0) {
      a.slice(9).split(',').forEach(x => { const s = x.trim(); if (s) out.push(s); });
    }
  });
  return out;
}

const IGNORE_FILE_PATS = loadIgnoreFile();
const IGNORE_CLI_PATS = cliIgnore();
const IGNORE_PATS = BUILTIN_IGNORE.concat(IGNORE_FILE_PATS, IGNORE_CLI_PATS);

/**
 * 是否忽略：
 *   - 纯名字（无 /）：任意层级的同名目录都忽略（.codebuddy、node_modules 这类）
 *   - 含 /：按相对路径前缀匹配（doc/_removed）
 *   - 结尾 *：前缀通配（bak-*）
 */
function isIgnored(rel) {
  const p = norm(rel);
  const parts = p.split('/');
  for (let i = 0; i < IGNORE_PATS.length; i++) {
    const q = norm(IGNORE_PATS[i]);
    if (!q) continue;
    if (q.charAt(q.length - 1) === '*') {
      if (p.indexOf(q.slice(0, -1)) === 0) return true;
      continue;
    }
    if (q.indexOf('/') < 0) {
      // 路径中任意一段同名即忽略
      if (parts.indexOf(q) >= 0) return true;
      continue;
    }
    if (p === q || p.indexOf(q + '/') === 0) return true;
  }
  return false;
}

function readAppJson() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  } catch (_e) {
    console.log('[阻断] 找不到或未找到合法 app.json：' + path.join(ROOT, 'app.json'));
    process.exit(1);
  }
}

function collectRegistered(cfg) {
  const set = new Set();
  (cfg.pages || []).forEach(p => set.add(p));
  (cfg.subPackages || cfg.subpackages || []).forEach(sp => {
    const base = (sp.root || '').replace(/\/+$/, '');
    (sp.pages || []).forEach(p => set.add(base ? `${base}/${p}` : p));
  });
  return set;
}

function exists(page, ext) {
  return fs.existsSync(path.join(ROOT, `${page}.${ext}`));
}

function walkWxml() {
  const out = [];
  (function rec(dir, rel) {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (_e) { return; }
    ents.forEach(e => {
      if (e.isSymbolicLink()) return;
      const full = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!isIgnored(r)) rec(full, r); return; }
      if (e.name.endsWith('.wxml') && !isIgnored(r)) out.push(full);
    });
  })(ROOT, '');
  return out;
}

// <include src="./frag-disclaimer.wxml" /> / <import src="..." /> 引用的都是片段，不是页面
const INC_RE = /<(?:include|import)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/g;

function collectFragments(wxmlFiles) {
  const frags = new Set();
  wxmlFiles.forEach(f => {
    const src = fs.readFileSync(f, 'utf8');
    let m; INC_RE.lastIndex = 0;
    while ((m = INC_RE.exec(src))) {
      const u = m[1].split('?')[0];
      if (!u) continue;
      const abs = (u.charAt(0) === '/') ? path.join(ROOT, u) : path.resolve(path.dirname(f), u);
      frags.add(norm(path.relative(ROOT, abs)));
    }
  });
  return frags;
}

function main() {
  if (!fs.existsSync(ROOT) || !fs.statSync(ROOT).isDirectory()) {
    console.log('[错误] 目录不存在：' + ROOT);
    process.exit(2);
  }

  const cfg = readAppJson();
  const registered = collectRegistered(cfg);
  let problems = 0;

  // 1) 已注册页面四件套是否齐全
  for (const page of registered) {
    for (const ext of PIECES) {
      if (!exists(page, ext)) {
        problems++;
        console.log(`[阻断] 页面缺 ${ext.toUpperCase()} 件: ${page}.${ext}`);
      }
    }
  }

  // 2) 目录里存在 .wxml 但没注册的孤儿页面
  const wxmlFiles = walkWxml();
  const fragments = collectFragments(wxmlFiles);
  const seen = new Set();
  wxmlFiles.forEach(f => {
    const r = norm(path.relative(ROOT, f));
    // 组件（components/）由 usingComponents 引入，无需在 app.json 的 pages 注册
    if (r.split('/').indexOf('components') >= 0) return;
    // 被 <include>/<import> 引用的模板片段不是页面
    if (fragments.has(r)) return;
    seen.add(r.replace(/\.wxml$/, ''));
  });

  for (const page of seen) {
    if (!registered.has(page)) {
      problems++;
      console.log(`[阻断] 存在 .wxml 但未在 app.json 注册（孤儿页面）: ${page}`);
    }
  }

  console.log(
    `\n扫描：${registered.size} 个注册页面、${wxmlFiles.length} 个 .wxml；` +
    `排除规则 ${IGNORE_PATS.length} 条（内建 ${BUILTIN_IGNORE.length}` +
    ` + .redlineignore ${IGNORE_FILE_PATS.length} + --ignore ${IGNORE_CLI_PATS.length}），` +
    `片段 ${fragments.size} 个`
  );

  if (problems === 0) console.log(`OK: ${registered.size} 个注册页面四件套齐全，无漏注册。`);
  else console.log(`\n共 ${problems} 处问题。`);
  process.exit(problems ? 1 : 0);
}

main();
