// utils/env.js —— 全局配置单一来源（新项目上线只需改这一处）
// 复制本文件到新项目 utils/env.js，填好所有 {{...}} 占位。
// 协议页、关于我们、版权头统一从本模块取值，避免散落与版本号漂移。
module.exports = {
  // ===== 合规与主体（必填，缺 ICP_NO/LEGAL_ENTITY 是合规缺口）=====
  APP_NAME: '{{小程序名称}}',
  DEVELOPER: '{{开发者/团队名}}',
  CONTACT_EMAIL: '{{联系邮箱}}',
  CONTACT_WECHAT: '{{客服微信号，可选}}',
  // 小程序备案号由微信系统在「更多资料页」自动展示，开发者无需手动填写或公示（区别于网站备案的强制悬挂）。
  // 仅在隐私政策确有需要备注时才填，否则留空即可。云开发也没有需要你填的独立备案号。
  ICP_NO: '',
  LEGAL_ENTITY: '{{主体全称，个人主体填开发者姓名，必填（协议/关于页须真实一致）}}',
  JURISDICTION: '{{管辖法院所在地，如 广东省惠州市}}',
  POLICY_DATE: '{{隐私/协议生效日期 YYYY年MM月DD日}}',

  // ===== 版本（用 wx.getAccountInfoSync().miniProgram.version 动态覆盖）=====
  VERSION: '1.0.0',

  // ===== 云开发环境（留空则纯本地，避免 -601034 刷屏）=====
  CLOUD_ENV_ID: '{{云开发环境ID，如 cloud1-xxxxxxxx}}',

  // ===== 广告位等可选 =====
  AD_UNIT_IDS: {}
}
