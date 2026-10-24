---
name: wx-miniprogram-scaffold
display_name: 微信小程序脚手架工作流
display_name_en: WeChat Mini Program Scaffold Workflow
description: 从零搭建可上架微信小程序的 agent 工作流（触发词：开新小程序 / 脚手架 / 从零做小程序）。
description_zh: 从零到可上架的微信小程序 agent 工作流，内置合规三件套、云调用封装、虚拟支付、DOCX 导出与红线审计脚本。
description_en: 'End-to-end WeChat Mini Program scaffolding workflow with built-in compliance pages, cloud-call wrapper, virtual payment, DOCX export and red-line audit scripts.'
category: 开发
version: 1.0.1
author: Mr0752
---

# WeChat Mini Program Scaffold Workflow (agent-style)

## Purpose
A reusable, step-by-step workflow that bootstraps a new WeChat Mini Program to a shippable baseline: project skeleton + compliance trio + cloud-call wrapper + optional virtual payment / DOCX export / AI text + pre-submission gates. Every asset and script referenced below is shipped **inside this package**, so the workflow runs standalone without installing anything else.

## When to use
- User wants to start a brand-new mini program and says "开新小程序 / 搭个小程序 / 脚手架 / 从零做".
- User wants an automated, multi-step bootstrap rather than piecemeal help.

## How to run (workflow)
Execute these phases in order. Phases that touch independent files may be parallelized with the `task` (code-explorer) subagent when building into an existing partial repo.

### Phase 0 — Clarify (never skip)
Ask the user (batch in one message, multiSelect where useful):
- 小程序名称 / 主体类型（个人 or 企业·个体工商户）/ 服务类目
- 是否云开发（本 workflow 默认基于云开发 wx-server-sdk）
- 是否需要虚拟支付变现（订阅/道具）；若需 → 主体必须企业/个体户且类目支持
- 是否需要 DOCX 导出 / 云开发 AI 文本生成
- 目标路径（空目录 or 已有壳）

### Phase 1 — Project skeleton
- `app.json`: `__usePrivacyCheck__: true`, `darkmode: true`, `lazyCodeLoading: requiredComponents`, `themeLocation: theme.json`; add `tabBar` + `pages`.
- `project.config.json`: `appid`, `cloudfunctionRoot`, `miniprogramRoot`, minify switches (set `minified/minifyWXSS/minifyWXML: true` in BOTH this file and `project.private.config.json`).
- `app.js`: guarded cloud init reading `CLOUD_ENV_ID` from `utils/env.js`; empty → silent local (avoid `-601034`).

### Phase 2 — Compliance trio
- Copy `assets/env.js` → `utils/env.js`; fill the `{{...}}` placeholders. **LEGAL_ENTITY (主体名称) is mandatory and must match the filing entity exactly.** Do NOT require ICP_NO — the mini-program filing number is auto-displayed by WeChat on the "更多资料页"; developers never manually fill or display it (unlike website ICP filing). CloudBase has no separate filing number for you to fill.
- Open `assets/privacy-policy.md`, `assets/user-agreement.md`, `assets/about-block.md`; copy each WXML code-block contents and save as `.wxml` files; wire into `app.json` pages + "我的" page bottom block (do NOT make an independent about page).
- Add `components/privacy-popup` using official `wx.requirePrivacyAuthorize` — **never register `onNeedPrivacyAuthorization`** (real-device popup clash).

### Phase 3 — Cloud-call & storage
- Copy `assets/cloud.js` → `utils/cloud.js`; route ALL `wx.cloud.callFunction` through it (timeout + silent fail + auto-degrade).
- Provide a storage wrapper with unified key prefix + tombstone pattern (see `references/pitfalls.md` 存储章节).
- Keep db writes server-side only; file uploads go through cloud functions, not the client.

### Phase 4 — Monetization (optional)
- Copy `assets/vp.js` into the ordering cloud function, `assets/payNotify.js` as the delivery-callback cloud function, and `assets/client_purchase.js` into the client as the `purchase(sku)` helper. Signature algorithms: `references/signing.md`.
- Configure env vars `VP_OFFER_ID / VP_APPKEY / VP_ENV / WX_APPID / WX_APPSECRET` in the cloud function.
- Enforce three-price consistency (consts ↔ cloud fn ↔ MP backend, in 分) and `DEMO_MODE=false` before submission.

### Phase 4.5 — DOCX export / AI text (optional)
- DOCX: copy `assets/zip.js` + `assets/docx.js`; use `buildDocx({ title, blocks })` for Word deliverables (supports embedded images so "photo + form" files actually contain the photos). Block reference: `references/blocks.md`.
- AI text: copy `assets/ai_textgen.js`; ensure the **model switch is enabled** in console and deps (`@cloudbase/node-sdk>=3.18.3`, `@cloudbase/ai>=2.30.0`) are installed. Model API reference: `references/model-api.md`. Always attach a "仅供参考，以人工复核为准" disclaimer to AI output (liability).

### Phase 5 — Pre-submission gates
Run the bundled scanners against the mini-program root (zero-dep Node, read-only, no code execution):
- `node scripts/audit-redlines.js <root>` → 硬性红线必须清零（可选链/空值合并/tabBar 跳法/wx:key 等真机白屏/静默失败）；退出码从 1 变 0 才算过。
- `node scripts/audit-paths.js <root>` → 页面四件套完整性 + app.json 注册校验。
- `node scripts/audit-closure.js <root>` → 四层交互闭环（导航/事件/数据/孤儿页）。
- `node assets/tools/syntax-check.js <root>` → 轻量真机兼容闸门（`?.` `??` `||=` `&&=`）。
- （脚本路径相对本 skill 目录；`--strict` 可加扫实验性 WXML 规则。）
- Walk `references/pitfalls.md` 提审清单 with the user; confirm 测试账号留空、隐私指引单独审核、版本描述具体。

### Phase 6 — Verify & hand off
- Deploy cloud functions; sandbox virtual-payment real-device test (if Phase 4); real-device preview.
- Report what is done vs what needs manual action (MP 后台建商品 / 类目审核 / 备案号公示).

## Hard constraints to enforce
- 真机兼容: NO `?.` `??` `||=` `&&=` in client JS (real-device build fails to transpile, invisible in simulator/lint).
- 隐私: official `wx.requirePrivacyAuthorize`; never `onNeedPrivacyAuthorization`.
- 文案=承诺: no "导出PDF / 打印 / 云端模型处理" unless the capability truly exists.
- 术语: membership = "体验版/体验额度", never "免费版/VIP/Pro/月".
- 虚拟支付: 个人主体 cannot enable; DEMO_MODE false before submit; three prices match in 分.
- 模拟器判定: `sys.brand === 'devtools'`, never `envVersion === 'develop'` (remote real-device debug also returns develop).

## Package layout
- `assets/` — drop-in project files (env.js, cloud.js, privacy/user-agreement/about templates, vp.js, payNotify.js, client_purchase.js, zip.js, docx.js, ai_textgen.js, tools/syntax-check.js)
- `scripts/` — 三支零依赖审计脚本（红线 / 四件套 / 交互闭环）
- `references/` — 提审清单（pitfalls.md）、红线知识库（redlines.md / fix-examples.md / faq.md）、签名算法（signing.md）、DOCX 块规范（blocks.md）、模型 API（model-api.md）
