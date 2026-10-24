// utils/cloud.js —— 云调用封装（提炼自多个上架小程序）
// 延迟初始化 + 超时保护 + 静默失败 + 连续失败自动降级纯本地。
// 用法：const cloud = require('./cloud'); cloud.call('login', {...}).then(r=>...).catch(e=>...)
// 要点：① 所有 wx.cloud.callFunction 都走本封装；② fail 用箭头函数保证 this 正确；
//       ③ CLOUD_ENV_ID 留空则静默纯本地，不刷 -601034 红错。
const ENV = '' // 正式项目改为 require('./env').CLOUD_ENV_ID
const TIMEOUT = 8000
const FAIL_THRESHOLD = 3
let failCount = 0
let degraded = false

function ensureInit() {
  if (typeof wx === 'undefined' || !wx.cloud) return false
  try { wx.cloud.init({ env: ENV || undefined }); return true }
  catch (e) { return false }
}

function call(name, data) {
  return new Promise(function (resolve, reject) {
    if (degraded || !ensureInit()) {
      reject({ __local: true, reason: 'cloud-unavailable', message: '云能力不可用，已降级本地' })
      return
    }
    const timer = setTimeout(function () {
      failCount++
      if (failCount >= FAIL_THRESHOLD) degraded = true
      reject({ __timeout: true, message: name + ' 超时' })
    }, TIMEOUT)
    wx.cloud.callFunction({
      name: name,
      data: data || {},
      success: function (r) { clearTimeout(timer); failCount = 0; resolve(r.result) },
      // 箭头函数：曾因 function() 导致 this 指向配置对象，使降级逻辑 undefined
      fail: (e) => {
        clearTimeout(timer); failCount++
        if (failCount >= FAIL_THRESHOLD) degraded = true
        reject({ __error: true, message: (e && e.errMsg) || '云函数调用失败' })
      }
    })
  })
}

module.exports = { call: call, isDegraded: function () { return degraded } }
