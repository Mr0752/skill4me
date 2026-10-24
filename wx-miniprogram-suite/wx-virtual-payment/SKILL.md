---
name: wx-virtual-payment
display_name: 微信小程序虚拟支付
display_name_en: WeChat Mini Program Virtual Payment
description: 集成微信虚拟支付双签名、发货回调幂等与端上购买（触发词：虚拟支付 / 发货回调 / 双签名）。
description_zh: 微信虚拟支付双签名、发货回调幂等、端上购买范式，含官方算法与必踩坑位。
description_en: 'WeChat virtual payment end-to-end: dual signing, idempotent delivery callback and entitlement grant on cloud functions.'
category: 开发
version: 1.0.0
author: Mr0752
---

# WeChat Mini Program Virtual Payment

## Purpose
Provide a drop-in, correct implementation of WeChat Mini Program **virtual payment** for digital goods (unlock features, paid functions, subscriptions, in-app items). Virtual goods MUST go through `wx.requestVirtualPayment` — ordinary WeChat Pay is forbidden for digital goods and is being cut off on Android/Harmony/Windows for tool-type mini programs.

The flow is: client calls cloud function `xpay_order` → server signs (paySig + signature) and persists a pending order → returns params → client calls `wx.requestVirtualPayment` → WeChat routes Android/Harmony/Windows to WeChat Pay, iOS to Apple Pay → WeChat pushes `xpay_goods_deliver_notify` → server grants entitlement (idempotent) → returns success.

**Never rely on the client `success` callback to grant entitlements** — it can be lost. Grant only on the delivery push.

## When to use
- User needs to monetize a mini program with subscriptions, one-time items, add-ons, or any digital good.
- User mentions `wx.requestVirtualPayment`, 虚拟支付, 道具, 订阅, 发货推送, paySig, signature.
- Setting up the order signing, delivery callback, or entitlement grant on cloud functions.

## How to use
1. Read `references/signing.md` for the exact `paySig` / `signature` algorithms and required env vars.
2. Copy `templates/vp.js` into the ordering cloud function. It needs env vars `VP_OFFER_ID`, `VP_APPKEY`, `VP_ENV` (0 prod / 1 sandbox), `WX_APPID`, `WX_APPSECRET`.
3. Implement the `xpay_order` action: persist a pending order keyed by `outTradeNo`, then call `vp.buildOrderParams({ openid, productId, code, outTradeNo, envVersion })`. The `code` is the client's fresh `wx.login()` result.
4. Copy `templates/payNotify.js` as the delivery-callback cloud function (configure it in MP "虚拟支付 → 发货回调"). It looks up the pending order by `outTradeNo`, grants entitlement, and marks delivered (idempotent — WeChat retries up to 15×).
5. Copy `templates/client_purchase.js` into the client as the `purchase(sku)` helper: it does `wx.login()` for the code, calls the order cloud function, then `wx.requestVirtualPayment(params)`.
6. Map each MP-configured `productId` to your own entitlement (plan / item count / seats) inside the grant step.

## Key pitfalls (must tell the user)
- **Sandbox first**: set `VP_ENV=1` with sandbox AppKey, run a small-amount real-device test of the full pay → deliver → grant loop before switching to prod. A wrong signature = "paid but not granted".
- **session_key**: `signature` needs `session_key` from `code2Session`; the client must pass a fresh login `code` to `xpay_order`. Configuring `WX_APPID`/`WX_APPSECRET` is mandatory.
- **envVersion**: must match the client's running version (`release`/`trial`/`develop`) in both signing and `wx.requestVirtualPayment`.
- **iOS**: routed to Apple Pay automatically; Apple takes 30% and may reject "consulting/service" categories. Virtual payment on iOS still follows WeChat's subscription/item config.
- **idempotency**: the delivery push may arrive duplicated or late; gate grants on the persisted order `status`.
- **Secrets**: `VP_OFFER_ID`/`VP_APPKEY`/`VP_CALLBACK_SECRET`/`WX_APPSECRET` live ONLY in cloud-function env vars, never in code or the client.
