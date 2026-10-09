#!/usr/bin/env node
/**
 * 微信小程序页面四件套完整性 + app.json 注册校验（通用、可跨项目复用）
 *
 * 用法:  node audit-paths.js <miniprogram根目录>
 *
 * 检查:
 *   1. app.json 的 pages 与 subPackages 里每个页面，.js/.json/.wxml/.wxss 四件齐全
 *   2. 目录里存在 .wxml 但没在 app.json 注册的"漏注册"页面（孤儿文件）
 *
 * 返回码: 0 = 全齐; 1 = 有缺失/漏注册。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || '.');
const PIECES = ['js', 'json', 'wxml', 'wxss'];

function readAppJson() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  } catch (_e) {
    console.log('[阻断] 找不到或未找到合法 app.json');
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

function main() {
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
  const seen = new Set();
  (function walk(dir, rel) {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (_e) { return; }
    for (const e of ents) {
      if (e.isSymbolicLink()) continue;
      const full = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (['node_modules', 'miniprogram_npm', '_lib', 'cloudfunctions', '.git'].includes(e.name)) continue;
        walk(full, r);
      } else if (e.name.endsWith('.wxml')) {
        const page = r.replace(/\.wxml$/, '');
        // 组件（components/）由 usingComponents 引入，无需在 app.json 的 pages 注册，跳过孤儿判定
        if (!r.split('/').includes('components')) seen.add(page);
      }
    }
  })(ROOT, '');

  for (const page of seen) {
    if (!registered.has(page)) {
      problems++;
      console.log(`[建议] 存在 .wxml 但未在 app.json 注册（孤儿页面）: ${page}`);
    }
  }

  if (problems === 0) console.log(`OK: ${registered.size} 个注册页面四件套齐全，无漏注册。`);
  else console.log(`\n共 ${problems} 处问题。`);
  process.exit(problems ? 1 : 0);
}

main();
