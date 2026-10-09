# 避坑红线与提审清单（来自两个已上架项目的踩坑记录）

## 一、真机兼容（最高频、模拟器测不出）
- 客户端 JS **禁用** `?.` `??` `||=` `&&=`（可选链/空值合并/逻辑赋值）。真机编译通道不转换 → 真机 SyntaxError，模拟器和 lint 都查不出。用 `assets/tools/syntax-check.js` 做上架前闸门。
- 模拟器判定用 `sys.brand === 'devtools'`，**不能**用 `envVersion === 'develop'`（真机远程调试也返回 `develop`）。

## 二、导航与组件
- tabBar 跳转必须用 `wx.switchTab`，用 `navigateTo` 会静默失败。
- 组件 wxss **只能用类选择器**；标签名/ID/属性选择器被静默丢弃。
- `requirePlugin` 是**全局函数**，没有 `wx.requirePlugin`（曾导致插件永远不初始化）。
- 禁用 `setInterval` 无退避轮询 → 递归 `setTimeout` + 退避。

## 三、存储与云调用
- Storage key 统一走封装前缀，禁手写散落前缀（如 `aa_`）。
- 所有 `wx.cloud.callFunction` 走 `assets/cloud.js` 封装（超时+静默失败+连续失败降级本地）；箭头函数写法保证 `this` 正确。
- db 集合操作只在云函数侧（`wx-server-sdk`），端上不直连；文件/图片上传走云函数处理，不走端上 `uploadFile`（规避端上传兼容坑）。

## 四、文案 = 承诺（审核红线）
- 没有真 PDF 导出 / 打印 API → 禁止写「导出 PDF」「支持打印」。
- 云能力仅在 `cloudReady` 为真时承诺；AI 文案若是本地模板，不得写「云端模型处理」。
- 会员档位一律「体验版/体验额度/体验 N 天」，禁「免费版/免费试用/VIP/Pro/月」（价格写 `/30天` 禁 `/月`，易被误解自动续费）。

## 五、虚拟支付审核坑（详见 wx-virtual-payment skill）
- 个人主体无法开通虚拟支付（需企业/个体工商户 + 类目支持）。
- `DEMO_MODE` 上架前务必 `false`：审核员点「立即开通」却没调支付就"开通成功"= 绕开虚拟支付 = **拒审**。
- 三处价格必须一致（consts ↔ 云函数 PLANS ↔ 后台道具价，单位**分**）；道具 ID 改名会让历史订单发货失败。
- 折算系数方向：季÷3、年÷12（曾写成 ×3×12，反向放大 144 倍）。
- errCode 速查：15011(env 必须为 0) / 15013(goodsPrice 不符) / 15014(道具发布约 10 分钟生效)。

## 六、提审清单（提审前逐项确认）
- 进入即收集头像/昵称会被拒 → 仅用户主动编辑时获取，头像仅存本机。
- 「测试账号」**留空**（无账号密码登录，填邮箱反而审核登不进）。
- 《用户隐私保护指引》单独审核，需等回「已更新」再提审。
- 版本描述别写"修复若干问题/优化体验"（审核据此决定测什么）。
- 服务类目核心页面不得隐藏/多次跳转。
- `project.config.json` 的压缩开关（`minified/minifyWXSS/minifyWXML`）与 `project.private.config.json` **两处都要 true**。
- `packOptions.ignore` 排除 docs/README/PRD 等非运行文件，避免冗余进包。
- README 页面地图须与 app.json 实际页面同步（曾列了已删除的 about 页误导照搬）。
