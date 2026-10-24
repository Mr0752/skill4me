# 合规与基础配置（app.json 必带开关 + 三件套参数化）

## app.json 必带开关（两个上架项目都验证过）
```json
{
  "darkmode": true,
  "themeLocation": "theme.json",
  "lazyCodeLoading": "requiredComponents",   // 首屏懒加载，必须
  "__usePrivacyCheck__": true                // 隐私协议合规必须，缺了隐私弹窗不弹
}
```
- `__usePrivacyCheck__: true` 是微信隐私合规硬性开关；配套 `components/privacy-popup` 组件用官方 `wx.requirePrivacyAuthorize` 拉起，不要注册 `onNeedPrivacyAuthorization`（真机会和官方弹窗打架）。
- tabBar 图标放独立目录（如 `icons/`）；`window.navigationBarTitleText` 写小程序名。

## 合规三件套位置约定
- **隐私政策 / 用户协议**：独立静态页（`packageA/pages/privacy`、`packageA/pages/terms`），放分包避免占主包体积。
- **关于我们**：不要独立页（双份维护会文案漂移）——做成「我的」页底部区块（`references/about-block.md`（使用时复制其 WXML 代码块为 `.wxml`））。

## 参数化占位表（模板里用 `{{...}}`，js 从 env.js setData）
| 占位 | 含义 | 两个参考项目现状 |
|---|---|---|
| `{{APP_NAME}}` | 小程序名称 | 散落在 wxml 多处 |
| `{{CONTACT_EMAIL}}` | 联系邮箱 | 有，但散落 |
| `{{DEVELOPER}}` / `{{LEGAL_ENTITY}}` | 开发者/主体全称 | ⚠️ **两个项目都缺主体全称**，仅写"团队" |
| `{{ICP_NO}}` | ICP 备案号（可选） | 小程序备案号由微信系统在「更多资料页」**自动展示**，开发者无需手动填/公示；仅在隐私政策确要备注时填，否则留空 |
| `{{JURISDICTION}}` | 管辖法院所在地 | Merchant 有（广东省惠州市） |
| `{{POLICY_DATE}}` | 隐私/协议生效日期 | 有，但写死需改为动态 |
| `{{VERSION}}` | 版本号 | ⚠️ AA 两处不一致（settings v1.0.5 vs 协议 V1.0.0），统一用 `wx.getAccountInfoSync().miniProgram.version` 动态取 |

## 关于我们区块必要字段
版本号、联系邮箱、主体名称、版权声明。说明：小程序备案号由系统在「更多资料页」自动展示，**不要**像网站那样手动在页面悬挂（这是常见误区）；主体名称（LEGAL_ENTITY）必填且须与备案主体真实一致。
