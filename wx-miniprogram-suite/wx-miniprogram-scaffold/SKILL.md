---
slug: mr0752-wx-mp-scaffold
displayName: 微信小程序脚手架工作流
version: 1.0.0
summary: 从零到可上架的微信小程序 agent 工作流，编排合规三件套、云调用封装、虚拟支付、红线审计与提审清单。
license: MIT
name: wx-miniprogram-scaffold
description: End-to-end WeChat Mini Program scaffolding workflow (agent-style). Orchestrates the wx-miniprogram-blueprint and wx-virtual-payment skills to take a new mini program from zero to a real-device-runnable, compliant, optionally-monetized baseline. Use when the user says "开新小程序", "搭个小程序", "脚手架", "从零做一个小程序", or wants a full new mini program project bootstrapped automatically step by step with the compliance trio, cloud-call wrapper, and optional virtual payment.
---

# WeChat Mini Program Scaffold Workflow (agent-style)

## Purpose
A reusable, step-by-step workflow that bootstraps a new WeChat Mini Program to a shippable baseline: project skeleton + compliance trio + cloud-call wrapper + optional virtual payment + pre-submission checks. It orchestrates assets from `wx-miniprogram-blueprint` and `wx-virtual-payment` so the user gets a vetted starting point instead of assembling pieces manually.

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
- 是否需要 DOCX 导出 / 云开发 AI 文本生成（对应待建 skill）
- 目标路径（空目录 or 已有壳）

### Phase 1 — Project skeleton
- `app.json`: `__usePrivacyCheck__: true`, `darkmode: true`, `lazyCodeLoading: requiredComponents`, `themeLocation: theme.json`; add `tabBar` + `pages`.
- `project.config.json`: `appid`, `cloudfunctionRoot`, `miniprogramRoot`, minify switches (set `minified/minifyWXSS/minifyWXML: true` in BOTH this file and `project.private.config.json`).
- `app.js`: guarded cloud init reading `CLOUD_ENV_ID` from `utils/env.js`; empty → silent local (avoid `-601034`).

### Phase 2 — Compliance trio (from wx-miniprogram-blueprint)
- Copy `assets/env.js` → `utils/env.js`; fill the `{{...}}` placeholders. **LEGAL_ENTITY (主体名称) is mandatory and must match the filing entity exactly.** Do NOT require ICP_NO — the mini-program filing number is auto-displayed by WeChat on the "更多资料页"; developers never manually fill or display it (unlike website ICP filing). CloudBase has no separate filing number for you to fill.
- Copy `privacy-policy.wxml`, `user-agreement.wxml`, `about-block.wxml`; wire into `app.json` pages + "我的" page bottom block (do NOT make an independent about page).
- Add `components/privacy-popup` using official `wx.requirePrivacyAuthorize` — **never register `onNeedPrivacyAuthorization`** (real-device popup clash).

### Phase 3 — Cloud-call & storage (from blueprint)
- Copy `assets/cloud.js` → `utils/cloud.js`; route ALL `wx.cloud.callFunction` through it (timeout + silent fail + auto-degrade).
- Provide a storage wrapper with unified key prefix + tombstone pattern (see Merchant `S/L/D` in blueprint pitfalls).
- Keep db writes server-side only; file uploads go through cloud functions, not the client.

### Phase 4 — Monetization (optional, from wx-virtual-payment)
- Load `wx-virtual-payment`. Copy `assets/vp.js`, `payNotify.js`, `client_purchase.js` into the order/delivery cloud functions and client.
- Configure env vars `VP_OFFER_ID / VP_APPKEY / VP_ENV / WX_APPID / WX_APPSECRET` in the cloud function.
- Enforce three-price consistency (consts ↔ cloud fn ↔ MP backend, in 分) and `DEMO_MODE=false` before submission.

### Phase 4.5 — DOCX export / AI text (optional, from their skills)
- DOCX: load `miniprogram-docx`; copy `assets/zip.js` + `assets/docx.js`; use `buildDocx({ title, blocks })` for Word deliverables (supports embedded images so "photo + form" files actually contain the photos).
- AI text: load `cloudbase-ai-textgen`; copy `assets/ai_textgen.js`; ensure the **model switch is enabled** in console and deps (`@cloudbase/node-sdk>=3.18.3`, `@cloudbase/ai>=2.30.0`) are installed. Always attach a "仅供参考，以人工复核为准" disclaimer to AI output (liability).

### Phase 5 — Pre-submission gates
- Load the `miniprogram-redline-audit` skill and run its scanners against the mini-program root (zero-dep, local):
  - `node <skills>/miniprogram-redline-audit/scripts/audit-redlines.js <root>` → 硬性红线必须清零（可选链/空值合并/tabBar 跳法/wx:key 等真机白屏/静默失败）；退出码从 1 变 0 才算过。
  - `node <skills>/miniprogram-redline-audit/scripts/audit-paths.js <root>` → 页面四件套完整性 + app.json 注册校验。
  - `node <skills>/miniprogram-redline-audit/scripts/audit-closure.js <root>` → 四层交互闭环（导航/事件/数据/孤儿页）。
  - （`<skills>` = 用户级 skills 目录，如 `~/.codebuddy/skills`（macOS/Linux）或 `C:/Users/<用户名>/.codebuddy/skills`（Windows）；`--strict` 可加扫实验性 WXML 规则。）
- Walk `references/pitfalls.md` 提审清单 with the user; confirm 测试账号留空、隐私指引单独审核、版本描述具体。

### Phase 6 — Verify & hand off
- Deploy cloud functions; sandbox virtual-payment real-device test (if Phase 4); real-device preview.
- Report what is done vs what needs manual action (MP 后台建商品 / 类目审核 / 备案号公示).

## Hard constraints to enforce (from blueprint pitfalls)
- 真机兼容: NO `?.` `??` `||=` `&&=` in client JS (real-device build fails to transpile, invisible in simulator/lint).
- 隐私: official `wx.requirePrivacyAuthorize`; never `onNeedPrivacyAuthorization`.
- 文案=承诺: no "导出PDF / 打印 / 云端模型处理" unless the capability truly exists.
- 术语: membership = "体验版/体验额度", never "免费版/VIP/Pro/月".
- 虚拟支付: 个人主体 cannot enable; DEMO_MODE false before submit; three prices match in 分.
- 模拟器判定: `sys.brand === 'devtools'`, never `envVersion === 'develop'` (remote real-device debug also returns develop).
