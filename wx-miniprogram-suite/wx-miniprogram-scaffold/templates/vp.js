/**
 * 微信小程序虚拟支付服务端签名模块（通用，复制即用）。
 * 依赖环境变量：VP_OFFER_ID, VP_APPKEY, VP_ENV(0 现网 / 1 沙箱), WX_APPID, WX_APPSECRET
 * 用法：const vp = require('./vp'); const params = await vp.buildOrderParams({ openid, productId, code, outTradeNo, envVersion });
 * 算法依据微信官方「虚拟支付：企业、个体户」2.5/2.6 节。
 * ⚠️ 上线前：① 配齐环境变量；② VP_ENV=1 沙箱小金额真机跑通 pay→deliver→grant；③ 再切现网。
 */
const crypto = require('crypto')
const https = require('https')

const VP_OFFER_ID = process.env.VP_OFFER_ID || ''
const VP_APPKEY = process.env.VP_APPKEY || ''
const VP_ENV = (process.env.VP_ENV === '1') ? 1 : 0
const WX_APPID = process.env.WX_APPID || ''
const WX_APPSECRET = process.env.WX_APPSECRET || ''

function hmacSha256Hex(key, msg) {
  return crypto.createHmac('sha256', key).update(msg, 'utf8').digest('hex')
}

// paySig = hex(HMAC_SHA256(appKey, 'requestVirtualPayment' + '&' + signData))
function calcPaySig(signData) {
  return hmacSha256Hex(VP_APPKEY, 'requestVirtualPayment' + '&' + signData)
}

// signature = hex(HMAC_SHA256(session_key, signData))
function calcSignature(signData, sessionKey) {
  return hmacSha256Hex(sessionKey, signData)
}

// 用登录 code 换 session_key（微信 jscode2session）。失败抛明确错误，不假装成功
function getSessionKey(code) {
  return new Promise(function (resolve, reject) {
    if (!WX_APPID || !WX_APPSECRET) {
      reject(new Error('未配置 WX_APPID / WX_APPSECRET（虚拟支付用户态签名需要）'))
      return
    }
    const url = 'https://api.weixin.qq.com/sns/jscode2session?appid=' + WX_APPID +
      '&secret=' + WX_APPSECRET + '&js_code=' + encodeURIComponent(code) +
      '&grant_type=authorization_code'
    const req = https.get(url, function (res) {
      let data = ''
      res.on('data', function (c) { data += c })
      res.on('end', function () {
        try {
          const j = JSON.parse(data)
          if (j.errcode) reject(new Error('code2Session ' + j.errcode + ' ' + (j.errmsg || '')))
          else resolve(j.session_key || '')
        } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.setTimeout(8000, function () { req.destroy(new Error('code2Session 超时')) })
  })
}

/**
 * 组装下单参数 + 双签名。
 * @param {object} o { openid, productId, quantity, code, outTradeNo, envVersion }
 *   - code: 端上 wx.login() 的 code（换 session_key 用，必填）
 *   - envVersion: 端上实际运行版本 'release' | 'trial' | 'develop'，须与签名一致
 * @returns 直接传给 wx.requestVirtualPayment 的参数对象
 */
async function buildOrderParams(o) {
  if (!VP_OFFER_ID || !VP_APPKEY) throw new Error('未配置 VP_OFFER_ID / VP_APPKEY')
  const quantity = Number(o.quantity) || 1
  const envVersion = o.envVersion || 'release'
  const ts = Math.floor(Date.now() / 1000)
  const nonce = crypto.randomBytes(8).toString('hex')

  const signDataObj = {
    offerId: VP_OFFER_ID,
    buyQuantity: quantity,
    productId: o.productId,
    outTradeNo: o.outTradeNo,
    envVersion: envVersion,
    currencyType: 'CNY',
    openid: o.openid,
    timestamp: ts,
    nonceStr: nonce,
    env: VP_ENV
  }
  const signData = JSON.stringify(signDataObj)

  const sessionKey = o.code ? (await getSessionKey(o.code).catch(function (e) { throw e })) : ''
  if (!sessionKey) throw new Error('无法获取 session_key（检查 WX_APPID/WX_APPSECRET 与登录 code）')

  return {
    offerId: VP_OFFER_ID,
    buyQuantity: quantity,
    productId: o.productId,
    outTradeNo: o.outTradeNo,
    envVersion: envVersion,
    currencyType: 'CNY',
    signData: signData,
    paySig: calcPaySig(signData),
    signature: calcSignature(signData, sessionKey)
  }
}

module.exports = { calcPaySig, calcSignature, getSessionKey, buildOrderParams }
