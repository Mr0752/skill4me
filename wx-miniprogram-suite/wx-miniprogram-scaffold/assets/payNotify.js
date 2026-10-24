/**
 * 虚拟支付发货回调云函数（通用骨架，复制后接你自己的权益账本）。
 * 配置：MP「虚拟支付 → 基本配置 → 发货回调」填写本云函数名。
 * 走云开发事件订阅，来源可信，无需 HMAC 验签。幂等防重推（微信最多 15 次）。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COL_ORDER = 'xpay_orders' // 你下单云函数落库的待支付订单集合

// 容错取字段：微信不同通道字段大小写/命名可能不同
function pick(obj, keys) {
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]
  }
  return ''
}

exports.main = async (event) => {
  try {
    const e = event || {}
    const outTradeNo = String(pick(e, ['OutTradeNo', 'outTradeNo', 'orderId', 'OrderId']) || '')
    const openid = String(pick(e, ['OpenId', 'openid', 'FromUserName', 'fromUserName']) || '')
    if (!outTradeNo) { console.error('[payNotify] 缺 outTradeNo', JSON.stringify(e).slice(0, 600)); return { ErrCode: 0 } }

    const got = await db.collection(COL_ORDER).where({ outTradeNo: outTradeNo }).limit(1).get().catch(() => null)
    const order = got && got.data && got.data[0]
    if (!order) { console.error('[payNotify] 未知订单', outTradeNo); return { ErrCode: 0 } }
    if (order.status === 'delivered') return { ErrCode: 0 } // 幂等

    // ===== 在此接你自己的权益发放 =====
    // 按 order.kind / order.refId / order.quantity 映射到你的权益账本（grant）：
    //   - kind 'plan' → 开通/续费订阅档位 order.refId
    //   - kind 'goods' → 发放按次次数 { [order.refId]: order.quantity }
    //   - kind 'addon' → 增加席位/扩容（按你的映射换算数量）
    // 调用方式示例：await cloud.callFunction({ name: 'entitlement', data: { action: 'grant', secret: process.env.VP_CALLBACK_SECRET, openid: openid || order.openid, ... } })
    // TODO: 替换为你的实际发放逻辑

    await db.collection(COL_ORDER).doc(order._id).update({
      data: { status: 'delivered', deliveredAt: Date.now() }
    }).catch(function () {})
    return { ErrCode: 0 }
  } catch (err) {
    console.error('[payNotify] 异常', err)
    return { ErrCode: 0 } // 返回 0 让微信重推重试发放
  }
}
