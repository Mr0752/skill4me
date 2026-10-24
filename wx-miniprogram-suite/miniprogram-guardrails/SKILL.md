---
name: miniprogram-guardrails
display_name: 小程序防踩坑护栏
display_name_en: Mini Program Guardrails
description: 开发/改小程序前提供点击锁、存储封装、演示数据等防踩坑护栏（触发词：防踩坑 / 护栏 / 存储封装）。
description_zh: 点击锁、存储封装、演示数据、幂等等高频踩坑护栏原则与落地示例。
description_en: 'Guardrails against common mini program pitfalls: click-lock, storage wrappers, demo data, idempotency.'
category: 开发
version: 1.0.0
author: Mr0752
---

# 小程序开发红线与避坑指南

## Purpose
Provide universally-applicable red lines and pitfall guardrails for WeChat mini-program development, focused on the mistakes that **local emulators, IDE, and linters cannot catch** — silent, expensive, or real-device-only failures. Generic入门知识 (lifecycle, basic wxml) is intentionally omitted; consult official docs.

> **Scope note:** Sections below are **universal** (any mini-program). Concrete code symbols from one specific project (e.g. `xwv14_` storage prefix, `app.lockClick`, `monthProfit`) appear ONLY as illustrative examples in `references/guide.md` appendix — do NOT assume they exist in a new project; apply the underlying principle.

## When to use
- Starting or modifying a WeChat mini-program.
- Before adding any background task / `setInterval` / polling / cloud sync — **#1 silent quota burner**.
- Before a real-device build/release.
- Before 提审 (review submission).
- When writing WXML bindings, `Storage` reads/writes, navigation, modals, canvas, or importing/exporting files.
- When the user mentions 同步 / 云开发 / 真机 / 提审 / 虚拟支付 / 演示数据 / 付费墙.
- **Run the bundled audit**: `scripts/lint_redlines.ps1 <miniprogram-src-dir>` after writing/refactoring code to auto-catch several of the patterns below.

## Core red lines (universal — memorize before writing code)

### 1. WXML compile-time traps (silent failure or compile error)
- **No method calls inside `{{}}`** and **no dynamically-bound handler names** (`bindtap="{{item.fn}}"` fails). Pre-compute all derived values (class maps, sums, progress) into fields in JS; route dynamic actions through one `onMainAction` switch via `data-action`.
- **No Chinese property names inside `{{}}`** (`{{counts.待派单}}` → `unexpected ❖` compile error). Pre-compute to ASCII fields (`counts.pending`).
- **`wx:key` must NOT be `"index"`** — treated as a property name (item has no `index`) → effectively no key, list updates break. Generate `_k` (e.g. `'sku'+idx`) when no unique field; never persist `_k` to storage.
- **No `<b>` component in WXML** — use `<text class="b">…</text>` (`.b{font-weight:800}`). Only official components allowed.
- **`sitemap.json` deprecated** — drop `sitemapLocation` from `app.json` and `checkSiteMap` from `project.config.json`.

### 2. Real-device compatibility (A-class, emulator-invisible)
- **Ban `?.` / `??` / `||=` / `&&=`.** Real-device base library Babel does NOT transpile them → real-device `SyntaxError` white screen; emulator/lint/IDE never report. Object spread `{...x}` is safe.
- **Compression switches must be `true` in BOTH `project.config.json` and `project.private.config.json`.** JS compression only happens at upload. Never hand-"compress" source.

### 3. Navigation / platform capability
- **Jumping to a tabBar page MUST use `wx.switchTab`** — `navigateTo` silently fails (no error, page does nothing). Check `app.json` tabBar list before choosing the API. Centralize jumps in a `goPage` helper; forbid hand-written `wx.navigateTo/switchTab` (only `wx.reLaunch` for cache-clear restart).
- **File import/export platform boundary**: mobile cannot write to system Download dir (files live in sandbox); generate → `wx.openDocument()` preview → user forwards/saves via helper. PC mini-program has `wx.saveFileToDisk`. Import via `wx.chooseMessageFile` + `getFileSystemManager`; parse sheets with `xlsx.mini` client-side. (iOS can only read docs shared from the Files app.)
- **Native `input`/`textarea`: no vertical padding** (clips text) — use fixed `height` + horizontal padding. Pages with a fixed bottom nav must include a safe-area placeholder view or the last content is unreachable.
- **No `calc()` inside `flex` shorthand** (`flex: 1 1 calc(50% - 8rpx)` fails entirely on real devices). Use `display:flex;flex-wrap:wrap;justify-content:space-between` + child `width:48.5%;flex:none`. `width:calc(...)` alone is fine; avoid `gap` on old WebViews.

### 4. Cloud / cloud functions (most expensive, most hidden)
- **No blind fixed-interval polling.** Never `setInterval(15s)` that unconditionally `pull`s. Use recursive `setTimeout` with **idle backoff**: base 60s; if N consecutive rounds (≈10) produce no local change → back off to 5 min. Wake on local write and on `onShow` (immediate pull).
- **Two-layer defense against call storms (client + server).** A TTL cache alone is **NOT** enough: a single page calling with `force` on every `onShow` can still hammer the cloud. Measured incident: one function's `state` action got **20,353 calls in 5h** (≈1/s), burning **2,327 DB resource points, 100k log lines, 1.89GB log index traffic**. Always implement BOTH layers:
  1. **Client module-level**: in-flight de-dup (all callers share one Promise) + **hard minimum-gap throttle** that blocks even `force` calls.
  2. **Server short in-container cache** (e.g. 3s TTL) as the last gate — and **delete that cache on every balance-changing action** (consume / redeem / grant) so a stale balance is never served.
- **Content security needs a working channel, not just code.** `msgSecCheck` can fail infrastructure-side (`-501001` = broken cloud-call token chain). Keep a **deterministic local blocklist as the first line**, and provide an **HTTPS-direct path (AppSecret)** to bypass the broken chain. Log failures; **never** treat "check failed" as "content passed".
- **Free quota reality:** only **调用次数 (20万/月)** can blow out; capacity/storage/traffic ≈0. Compute quota math at design time (interval × 24h × users).
- **Sanitize all egress at one shared出口**: strip empty field names, `undefined`, empty strings. Applies to push, merge, and backup export.
- **Treat cloud-returned values as untrusted:** wrap scalar reads in `Number(x)` + `isFinite` with safe default.
- **Seed/demo data must be idempotent:** fixed ids; clearing cloud and local in the same transaction (push tombstones after clearing).
- **Shared in-memory cache must reset to `{}`, never `null`** (`null` in `key in _c` throws). Guard the store entry.
- **Keep a `CLOUD_DISABLED` kill switch** for debug; must be `false` before launch.

### 5. Storage / data layer
- Always go through one prefixed `S/L` helper; never hand-write the storage prefix (double-prefix = silent miss).
- When iterating key tables, guard each key with `Array.isArray` (tables mix number- and object-typed keys).
- **Helper methods for writes must NOT reference caller-local variables** — outer `try/catch` swallows `ReferenceError` → half-succeeds, half silently fails.
- Single source of truth for money calc functions; pages read, never recompute.

### 6. Interaction / visual traps
- Writes use a click lock; **multiple submit entries of one form share ONE lock key** (two locks = double-submit).
- **Never open a modal synchronously inside another modal's success/complete** — second one silently fails; `setTimeout ≥300ms`.
- **Canvas inside a sheet must NOT share the screen with a fixed bottom button** — native same-layer component floats over the button on some devices. Use stepwise views; redraw in `setData` callback.
- Float/bubble height: **measure with `createSelectorQuery`**, never estimate by text lines. Reserve safe-area for tabbar.
- Single-line `<input>`: give `height` AND equal `line-height` + `text-align:left`.
- Global wxss class: **grep before adding a new class name** to avoid duplicate-definition style pollution.

### 7. Copy / 文案 compliance (承诺 = 实现)
- Don't claim features you lack (no real PDF → no "导出 PDF"/"支持打印"; cloud only when ready; local template ≠ "云端模型处理").
- Unify brand/terminology site-wide; one definition, no per-page copies.

### 8. 提审 / launch
- **Virtual payment needs the mini-program published FIRST** to apply. Pre-review build with payment unconnected must set a "即将开通" state or it's bypassing virtual pay → rejection.
- Enterprise subject CAN open virtual payment (individual too now).
- Price/plan changes must sync across client constant, cloud `pay` config, and MP backend goods.

### 9. AI-collaboration discipline
- **Verify bugs on disk first; do not blame "stale runtime/old code".** Confirm the fix is actually on disk before concluding.
- Compute risk at design time, not after the user finds it in the cloud console.
- Anomalous logs (e.g. per-round "sync complete" spam) are signals — trace root cause.

## Bundled audit
`scripts/lint_redlines.ps1 <src-dir>` scans for: real-device syntax (`?.`/`??`/`||=`/`&&=`), `wx:key="index"`, dynamic `bindtap="{{`, `flex:...calc(`, and `navigateTo` (flag for tabBar review). Run it in CI or before commits.

## Detailed reference
For the full guide with concrete code examples, accident post-mortems, the project-specific appendix (storage prefix / lockClick / demo accounts), and the incident review template, load `references/guide.md`.
