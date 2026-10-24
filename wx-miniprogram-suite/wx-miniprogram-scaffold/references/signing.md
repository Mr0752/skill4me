# 微信虚拟支付签名算法（官方「虚拟支付：企业、个体户」2.5 / 2.6 节）

## 参与签名的密钥
- **appKey**：MP「虚拟支付 → 基本配置」获取。env=0 用现网 AppKey，env=1 用沙箱 AppKey。
- **session_key**：当前用户有效 session_key，由 `wx.login()` 的 code 调 `auth.code2Session` 获取。

## paySig（商户态签名）
```
paySig = hex( HMAC-SHA256( appKey, uri + '&' + signData ) )
```
- uri 固定字符串 `'requestVirtualPayment'`
- signData 是最终真实发出的 JSON 字符串（逐字节一致，JSON key 顺序稳定）

## signature（用户态签名）
```
signature = hex( HMAC-SHA256( session_key, signData ) )
```
- 直接对 signData 签名，无 uri 拼接

## signData 字段（须与最终请求体一致）
`offerId`, `buyQuantity`, `productId`, `outTradeNo`, `envVersion`,
`currencyType`(`'CNY'`), `openid`, `timestamp`(秒), `nonceStr`, `env`(0/1)

## wx.requestVirtualPayment 入参
`{ offerId, buyQuantity, productId, outTradeNo, envVersion, currencyType, signData, paySig, signature }`

## 发货推送 xpay_goods_deliver_notify
- 走云开发事件订阅，来源由平台保证（来自微信），无需 HMAC 验签（与公开 HTTP 回调不同）。
- 推送参数含 `OutTradeNo` / `OpenId` / `GoodsInfo` / `WeChatPayInfo` 等；字段大小写因通道而异，需容错解析。
- 响应返回 `{ ErrCode: 0 }`；异常也返回 0 避免无限重推，靠持久化订单 `status` 幂等防重发货。
- 微信失败会重推，最多 15 次。

## 常见 sign 失败原因
- signData 的 JSON 在签名时和最终发起时不完全一致（多了空格、key 顺序变、时间戳漂移）。
- session_key 失效（code 重复使用或超过 5 分钟）→ 重新 `wx.login()` 取新 code。
- envVersion 与端上实际运行版本不符 → 用 `wx.getAccountInfoSync().miniProgram.envVersion`。
- 用了沙箱 AppKey 但 VP_ENV=0（或反之）→ 现网/沙箱 AppKey 与 env 必须配对。
