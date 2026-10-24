---
name: wx-miniprogram-blueprint
display_name: 微信小程序云开发起手式
display_name_en: WeChat Mini Program CloudDev Starter
description: 新建微信小程序时提供合规三件套、云调用封装与提审清单（触发词：开小程序 / 隐私政策模板 / 提审清单）。
description_zh: 上架验证过的合规三件套（隐私/协议/关于）+ 云调用封装 + 提审清单模板，开箱即用。
description_en: Drop-in compliance trio (privacy/agreement/about), cloud-call wrappers and pre-submission checklist distilled from shipped mini programs.
category: 开发
version: 1.0.0
author: Mr0752
---

# WeChat Mini Program Blueprint (云开发起手式)

## Purpose
A reusable starter kit distilled from three cloud-development mini programs that were actually shipped. It packages the parts that are identical across projects — compliance pages, centralized config, cloud-call wrappers, red-lines — so a new mini program starts from a vetted baseline instead of from zero, and avoids the exact pitfalls already paid for once.

## When to use
- Scaffolding a new mini program, or the user says "开个小程序 / 新建小程序 / 小程序脚手架".
- User needs privacy-policy / user-agreement / about-us templates.
- User needs the standard app.json compliance switches, `env.js` config, or a cloud-call wrapper.
- Pre-submission review / red-line / 真机兼容 / 提审清单 questions.

## How to use
1. Copy `assets/env.js` → project `utils/env.js`; fill every `{{...}}` placeholder. All compliance pages and copyright headers read from it. **Mandatory: add `ICP_NO` and `LEGAL_ENTITY`** — both shipped reference apps were missing these (compliance gap).
2. Open `assets/privacy-policy.md`, `assets/user-agreement.md`, `assets/about-block.md`; copy the WXML code block contents and save them as `.wxml` files in `packageA/pages/` (or main `pages/`). Wire them into `app.json` `pages`, and place the about block at the bottom of the "我的" page. Replace `{{...}}`.
3. Set app.json switches (see `references/compliance.md`): `__usePrivacyCheck__: true`, `darkmode`, `lazyCodeLoading: requiredComponents`. Add `components/privacy-popup` using the official `wx.requirePrivacyAuthorize` — **do NOT register `onNeedPrivacyAuthorization`** (popup clash on real device).
4. Copy `assets/cloud.js` as the cloud-call wrapper (lazy init + timeout + silent fail + auto-degrade to local on repeated failure). Route ALL `wx.cloud.callFunction` through it. Keep db writes server-side only; upload files via cloud functions, not the client.
5. Before first submission, run `node assets/tools/syntax-check.js <miniprogramRoot>` (轻量真机兼容闸门, detects `?. ?? ||= &&=`) for a quick local check, but the **full red-line audit** (WXML `{{}}` traps, tabBar 跳法, 手写 storage key, 四件套, 四层闭环) is the `miniprogram-redline-audit` skill — load it and run `scripts/audit-redlines.js` / `audit-paths.js` / `audit-closure.js`. Then follow `references/pitfalls.md` review checklist.
6. For monetization, load the installed `wx-virtual-payment` skill: copy its assets for signature/delivery, and follow its three-price-consistency + `DEMO_MODE` rules.

## Key red-lines (tell the user; full list in references/pitfalls.md)
- **真机兼容**: never use `?.` `??` `||=` `&&=` in client JS — real-device build silently fails to transpile, SyntaxError invisible in simulator/lint.
- **隐私**: official `wx.requirePrivacyAuthorize`; `__usePrivacyCheck__: true`; never `onNeedPrivacyAuthorization`.
- **文案=承诺**: do not write "导出PDF / 支持打印 / 云端模型处理" unless the capability truly exists.
- **术语**: membership tiers are "体验版/体验额度", never "免费版/VIP/Pro/月".
- **虚拟支付**: 个人主体 cannot enable virtual payment; `DEMO_MODE` must be false before submission; three prices (consts ↔ cloud fn ↔ MP backend) must match in 分.
- **模拟器判定**: use `sys.brand === 'devtools'`, never `envVersion === 'develop'` (remote real-device debug also returns `develop`).
