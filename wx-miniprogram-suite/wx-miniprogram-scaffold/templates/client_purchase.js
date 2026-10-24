/**
 * 端上虚拟支付购买 helper（通用范式，复制即用）。
 * 依赖：你的云函数调用封装 Cloud.call(name, data) 返回 { ok, params, ... }
 *       以及 wx.requestVirtualPayment 已存在（开通虚拟支付 + 基础库足够）
 * sku: { type:'goods'|'plan'|'addon', id, price, productId }
 */

// 端上登录拿 code（换 session_key 用）。code 一次性，下单时实时获取
function wxLogin() {
  return new Promise(function (resolve, reject) {
    if (typeof wx.login !== 'function') { reject({ reason: 'no-login', message: '当前环境不支持登录' }); return }
    wx.login({
      success: function (r) { r.code ? resolve(r.code) : reject({ reason: 'no-code', message: '获取登录 code 失败' }) },
      fail: function (e) { reject({ reason: 'login-failed', message: (e && e.errMsg) || '登录失败' }) }
    })
  })
}

// 端上实际运行版本，须与签名时 envVersion 一致
function currentEnvVersion() {
  try {
    const info = (wx.getAccountInfoSync && wx.getAccountInfoSync()) || {}
    const v = info.miniProgram && info.miniProgram.envVersion
    return v || 'release'
  } catch (e) { return 'release' }
}

function requestVirtualPay(params) {
  return new Promise(function (resolve, reject) {
    if (typeof wx.requestVirtualPayment !== 'function') {
      reject({ reason: 'unavailable', message: '当前环境未提供 wx.requestVirtualPayment' })
      return
    }
    wx.requestVirtualPayment(Object.assign({}, params, {
      success: function (r) { resolve(r) },
      fail: function (e) { reject(e || { errMsg: 'requestVirtualPayment fail' }) }
    }))
  })
}

function purchase(sku, Cloud) {
  const amount = Number(sku && sku.price) || 0
  return new Promise(function (resolve, reject) {
    if (!sku || !sku.id || amount <= 0) { reject({ reason: 'invalid', message: '商品无需付费或定价异常' }); return }
    if (typeof wx.requestVirtualPayment !== 'function') {
      reject({ reason: 'unavailable', message: '需在 MP 开通虚拟支付并通过类目审核' })
      return
    }
    wxLogin().then(function (code) {
      return Cloud.call('entitlement', { // 改为你的下单云函数名
        action: 'xpay_order',
        sku: { type: sku.type, id: sku.id, price: amount, productId: sku.productId || '' },
        code: code,
        envVersion: currentEnvVersion()
      })
    }).then(function (res) {
      if (!res || !res.ok || !res.params) {
        return Promise.reject({
          reason: (res && res.reason) || 'not-configured',
          message: (res && res.message) || '虚拟支付尚未配置：MP 开通 → 配置商品 → 云函数完成签名'
        })
      }
      return requestVirtualPay(res.params)
    }).then(function (r) {
      resolve({ ok: true, pending: true, result: r }) // 权益以发货推送为准，端上不写账本
    }).catch(function (err) {
      reject(err)
    })
  })
}

module.exports = { purchase: purchase, wxLogin: wxLogin, currentEnvVersion: currentEnvVersion }
