#!/usr/bin/env node
/**
 * 把共用资产/脚本同步进「自包含」包（scaffold / blueprint）。
 *
 * 背景：WorkBuddy 开放平台的文件质量检测会把 SKILL.md 里出现的
 * references/ scripts/ templates/ assets/ 路径当作「必须随包提供的资源」，
 * 一旦包内没有就驳回（内置文件缺失）。因此每个 zip 必须自包含，
 * 不能靠「运行时再加载另一个 skill 的文件」。
 *
 * 源头（source of truth）保持不变，在本脚本里声明同步关系；
 * 打包前先跑一次，保证副本不漂移。
 *
 * 用法：node sync-shared.js [--check]
 *   --check  只比对不写入，有差异时以退出码 1 结束（可用于打包前门禁）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CHECK_ONLY = process.argv.includes('--check');

// src: 相对 ROOT 的源文件；dest: 相对 ROOT 的目标文件
const MAP = [
  // scaffold: 合规三件套 + 云调用封装（源 = blueprint）
  ['wx-miniprogram-blueprint/assets/env.js', 'wx-miniprogram-scaffold/assets/env.js'],
  ['wx-miniprogram-blueprint/assets/cloud.js', 'wx-miniprogram-scaffold/assets/cloud.js'],
  ['wx-miniprogram-blueprint/assets/privacy-policy.md', 'wx-miniprogram-scaffold/assets/privacy-policy.md'],
  ['wx-miniprogram-blueprint/assets/user-agreement.md', 'wx-miniprogram-scaffold/assets/user-agreement.md'],
  ['wx-miniprogram-blueprint/assets/about-block.md', 'wx-miniprogram-scaffold/assets/about-block.md'],
  ['wx-miniprogram-blueprint/assets/tools/syntax-check.js', 'wx-miniprogram-scaffold/assets/tools/syntax-check.js'],
  // scaffold: 虚拟支付（源 = wx-virtual-payment）
  ['wx-virtual-payment/assets/vp.js', 'wx-miniprogram-scaffold/assets/vp.js'],
  ['wx-virtual-payment/assets/payNotify.js', 'wx-miniprogram-scaffold/assets/payNotify.js'],
  ['wx-virtual-payment/assets/client_purchase.js', 'wx-miniprogram-scaffold/assets/client_purchase.js'],
  ['wx-virtual-payment/references/signing.md', 'wx-miniprogram-scaffold/references/signing.md'],
  // scaffold: DOCX 导出（源 = miniprogram-docx）
  ['miniprogram-docx/assets/zip.js', 'wx-miniprogram-scaffold/assets/zip.js'],
  ['miniprogram-docx/assets/docx.js', 'wx-miniprogram-scaffold/assets/docx.js'],
  ['miniprogram-docx/references/blocks.md', 'wx-miniprogram-scaffold/references/blocks.md'],
  // scaffold: AI 文本生成（源 = cloudbase-ai-textgen）
  ['cloudbase-ai-textgen/assets/ai_textgen.js', 'wx-miniprogram-scaffold/assets/ai_textgen.js'],
  ['cloudbase-ai-textgen/references/model-api.md', 'wx-miniprogram-scaffold/references/model-api.md'],
  // scaffold: 提审清单（源 = blueprint，含虚拟支付审核坑）
  ['wx-miniprogram-blueprint/references/pitfalls.md', 'wx-miniprogram-scaffold/references/pitfalls.md'],
  // scaffold: 红线知识库（审计脚本输出会指引读这几份，必须随包）
  ['miniprogram-redline-audit/references/redlines.md', 'wx-miniprogram-scaffold/references/redlines.md'],
  ['miniprogram-redline-audit/references/fix-examples.md', 'wx-miniprogram-scaffold/references/fix-examples.md'],
  ['miniprogram-redline-audit/references/faq.md', 'wx-miniprogram-scaffold/references/faq.md'],
  // scaffold + blueprint: 三支审计脚本（源 = miniprogram-redline-audit）
  ['miniprogram-redline-audit/scripts/audit-redlines.js', 'wx-miniprogram-scaffold/scripts/audit-redlines.js'],
  ['miniprogram-redline-audit/scripts/audit-paths.js', 'wx-miniprogram-scaffold/scripts/audit-paths.js'],
  ['miniprogram-redline-audit/scripts/audit-closure.js', 'wx-miniprogram-scaffold/scripts/audit-closure.js'],
  ['miniprogram-redline-audit/scripts/audit-redlines.js', 'wx-miniprogram-blueprint/assets/tools/audit-redlines.js'],
  ['miniprogram-redline-audit/scripts/audit-paths.js', 'wx-miniprogram-blueprint/assets/tools/audit-paths.js'],
  ['miniprogram-redline-audit/scripts/audit-closure.js', 'wx-miniprogram-blueprint/assets/tools/audit-closure.js'],
];

function readIfExists(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    return null;
  }
}

let synced = 0;
let same = 0;
const missingSrc = [];
const drifted = [];

for (const [relSrc, relDest] of MAP) {
  const src = path.join(ROOT, relSrc);
  const dest = path.join(ROOT, relDest);
  const srcText = readIfExists(src);
  if (srcText === null) {
    missingSrc.push(relSrc);
    continue;
  }
  const destText = readIfExists(dest);
  if (destText === srcText) {
    same++;
    continue;
  }
  drifted.push(relDest);
  if (CHECK_ONLY) continue;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, srcText, 'utf8');
  synced++;
}

const tag = CHECK_ONLY ? '[check]' : '[sync]';
console.log(tag, 'same=' + same, 'written=' + synced, 'missingSrc=' + missingSrc.length);
if (missingSrc.length) console.log(tag, 'MISSING SOURCE:', missingSrc.join(', '));
if (CHECK_ONLY && drifted.length) {
  console.log(tag, 'DRIFTED:', drifted.join(', '));
  process.exit(1);
}
