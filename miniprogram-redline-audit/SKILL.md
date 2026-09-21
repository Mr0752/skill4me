---
name: miniprogram-redline-audit
description: 自动审计微信小程序（含云开发）是否踩中开发红线。当用户说"审计/检查/扫描我的小程序红线""提审前帮我排查风险""真机白屏/列表错乱排查""检查一下有没有盲轮询、可选链、手写 storage 前缀、tabBar 跳转""页面四件套缺失""导航/事件/数据/孤儿页闭环"等时使用。技能会扫描指定小程序目录，输出按严重度分组的红线审计报告（JS 真机不兼容语法、setInterval 盲轮询、navigateTo 跳 tabBar、手写 storage key、wx:key="index"、{{}} 方法调用/中文键、<b> 组件、页面四件套、四层交互闭环等），每条标注违反的红线条目与修复法，可直接当提审前体检。
---

# 小程序红线自动审计（工具型 Skill）

本 skill 不是文档库，而是**可执行体检**：扫一遍用户的小程序工程，按严重度列出踩中的红线，并给出违反的条目与修法。红线知识见 `references/redlines.md`，每条审计发现都标了对应的红线 id。

## 何时用
- 用户要"审计 / 检查 / 扫描我的小程序红线"。
- 提审 / 上架前想做风险体检。
- 排查真机白屏、`wx:key` 列表错乱、tabBar 跳不动、`Storage` 读不到等典型坑。
- 用户问"有没有盲轮询 / 可选链 / 手写 storage 前缀"等具体项。

## 执行流程（Agent 按此跑）
1. **确认目标目录**：默认当前目录；若用户给了小程序根目录（含 `app.json` 的那层），用它。可一次传多个根（如 `miniprogram cloudfunctions`）。目录传错脚本会以退出码 2 明确报错，见下方「异常处理」。
2. **确认 node 环境**：先跑 `node -v`；没有 node 时如实告知用户"本机缺 Node.js，去 nodejs.org 装一下即可（脚本零依赖，不需要 npm install）"，不要臆造审计结果。
3. **运行审计器**：
   ```
   node scripts/audit-redlines.js <小程序根目录>
   ```
   （零依赖、纯本地、不联网；`--strict` 可加扫实验性 WXML 规则。）
4. **汇总报告给用户**：
   - **硬性红线（必须修）**：JS 真机不兼容语法、navigateTo/redirectTo 跳 tabBar、wx:key="index"、JS 语法错误。这些会导致真机白屏 / 静默失败，必须清零。
   - **建议复核（人工确认）**：setInterval 盲轮询、手写 storage key、`{{}}` 方法调用 / 中文键、`<b>` 组件。多为启发式，可能误报，请结合上下文判断。
5. **对照修复**：每条发现的 `[红线X-Y]` 对应 `references/redlines.md` 的条目；逐条怎么改直接抄 `references/fix-examples.md` 的"修复前 → 修复后"代码对照。
6. **复跑**：修复后再次运行，直到硬性红线为 0（退出码从 1 变 0）。
7. **提审前**：再让用户过一遍 `references/first-submit-checklist.md`。

## 输出示例（真实运行结果）

```
$ node audit-redlines.js miniprogram
审计完成：1 个 JS + 1 个 WXML（已交叉核查 app.json 的 tabBar）

【硬性红线 4 条 · 必须修】
  [红线2-1] miniprogram/pages/index/index.js:3  可选链 ?.  → a?.b → (a||{}).b
  [红线2-1] miniprogram/pages/index/index.js:4  空值合并 ??  → a ?? b → (a==null?b:a)
  [红线9-1] miniprogram/pages/index/index.js:6  navigateTo 跳 tabBar 页面「pages/me/me」（静默失败，应用 switchTab）  → 改用 wx.switchTab 或封装 goPage
  [红线8-3] miniprogram/pages/index/index.wxml:1  wx:key="index"（列表更新错乱）  → 改用唯一字段或预生成 _k

【建议复核 5 条 · 人工确认（可能误报）】
  [红线1-1] miniprogram/pages/index/index.js:4  setInterval 盲轮询嫌疑（需确认有无空闲退避）  → 改递归 setTimeout + 无变化退避，见 references/cloud-quota-pitfalls.md
  [务必3-1] miniprogram/pages/index/index.js:5  手写 storage key「my_key」（建议走统一封装 S/L）  → 读写统一走封装方法，避免手写前缀叠加
  [红线10-2] miniprogram/pages/index/index.js:4  setInterval 未清理（有 setInterval 但全文无 clearInterval，页面切后台仍跑，烧云配额/闪退）  → 把句柄存到 this 上，在 onHide 与 onUnload 里 clearInterval
  [红线10-1] miniprogram/pages/index/index.js:8  整页 setData(this.data)（全量序列化，大页/列表必卡）  → 只 setData 变化的字段
  [红线10-3] miniprogram/pages/index/index.js:7  直接赋值 this.data.xxx（不改视图、下次 setData 会回滚）  → 改用 this.setData({ xxx: val })

修复参考：references/redlines.md 查红线条目；references/fix-examples.md 有逐条修复前后代码对照；references/faq.md 有常见问题。
```

解读：硬性红线是语法级精确判定，必须清零；建议复核是启发式，可能误报。退出码 `1` = 有硬性红线，`0` = 清零，`2` = 目录/参数错误。

## 异常处理（遇到这些按此办）
- **node 不存在**：告知用户安装 Node.js（LTS 即可），不要用别的方式"替代审计"，也不要编造结果。
- **目录不存在 / 传了构建产物目录**：脚本报 `错误：目录不存在` 或"0 个 JS + 0 个 WXML"提示；向用户确认小程序源码根目录（含 `app.json` 那层）。
- **app.json 解析失败**：只跳过 tabBar 交叉核查（红线9-1 不再判定），其余检查照常；提醒用户 app.json 可能是坏的。
- **个别文件读不了（非 UTF-8 等）**：脚本输出"跳过无法读取的文件"后继续扫其余文件，不会整次崩掉；提醒用户把该文件另存为 UTF-8。
- **建议项误报**：向用户说明启发式边界（见 `references/faq.md` Q9），不要为了"看起来准"把建议项说成硬性问题。

## 审计覆盖（当前版本）
默认（高精度，优先看这些）：
- 硬性：JS 语法错误；真机不兼容语法（可选链 `?.` / 空值合并 `??` / 逻辑赋值 `||=` `&&=` / 数字分隔符 `1_000`）；`navigateTo` / `redirectTo` 跳 `app.json` 里登记的 tabBar 页面；`wx:key="index"`。
- 建议：`setInterval` 盲轮询嫌疑；直接 `wx.get/setStorage(Sync)('字面量key')` 手写存储键；页面里裸用 `wx.reLaunch` / 同文件多处 `navigateTo`（疑似两段式导航，红线4-6）；定时器未清理（有 `setInterval/setTimeout` 但无 `clearInterval/clearTimeout`，红线10-2）；`setData` 整页/大对象（红线10-1）；直接赋值 `this.data.xxx`（红线10-3）。

加 `--strict`（或 `-w`）额外启用实验性 WXML 启发式（可能误报，仅参考）：`{{}}` 内方法调用、`{{}}` 内中文键、WXML `<b>` 组件。

> 主审计器不覆盖「页面四件套完整性」与「四层交互闭环」，请额外运行「附加独立脚本」一节的两个脚本补齐（见下文）。

## 附加独立脚本（补充主审计器未覆盖项，按需运行）

主 `audit-redlines.js` 不覆盖「四件套完整性」与「四层交互闭环」，需用以下两个独立脚本补齐（`--help` 看用法，零依赖）：

- `node scripts/audit-paths.js <根目录>` — 页面四件套完整性（js/json/wxml/wxss 齐全）+ `app.json` 注册校验；自动排除 `components/` 避免组件被误判为孤儿页面。
- `node scripts/audit-closure.js <根目录>` — 四层交互闭环：
  1. **导航闭环**：目标页存在、API 与页类型匹配（TabBar 页只用 switchTab）、路径为绝对路径；
  2. **事件闭环**：每个 `bindXxx`/`catchXxx` 方法都在对应页面 JS 的 `Page()` 顶层方法中存在；
  3. **数据闭环**：Storage 写入键都有读取（死键 0），只读未写列出供人工确认（云端/外部注入）；
  4. **孤儿页**：每个页面都有入口（被某处 navigate 指向或在 TabBar）。
  - 业务强相关项（导航封装名、Storage 读写正则、键前缀）在脚本顶部 `CFG` 配置，按项目改，不改逻辑。本项目 Storage 封装自动加 `xwv14_` 前缀时，设 `CFG.KEY_PREFIX='xwv14_'` 即可消除数据闭环噪声。

## 文件索引
- `scripts/audit-redlines.js` — 审计主程序（零依赖，扫描任意小程序目录，`--help` 看用法）。
- `scripts/audit-paths.js` — 页面四件套完整性 + app.json 注册校验（排除 components 误报）。
- `scripts/audit-closure.js` — 四层交互闭环（导航/事件/数据/孤儿页），业务项经顶部 CFG 配置。
- `references/redlines.md` — 通用红线知识库（每条审计发现按 id 引用）。
- `references/fix-examples.md` — 逐条修复前后代码对照（改哪条抄哪条）。
- `references/faq.md` — 常见问题：跑不起来、报告解读、误报漏报边界。
- `references/first-submit-checklist.md` — 首次提审分步清单。
- `references/cloud-quota-pitfalls.md` — 云开发额度与同步架构深挖（盲轮询事故来源）。

## 同步维护约定（改动本 Skill 时必读）

本 Skill 以 **`references/redlines.md` 为编号权威源**，改动时需保持两处对外视图一致：

1. `miniprogram-redline-audit/SKILL.md`（本文件：执行流程、审计覆盖、输出示例、异常处理）
2. `miniprogram-redline-audit/上架文案.md`（对外文案：卖点、使用方式、输出示例、包内文件清单）

改完两处后重新打包 `miniprogram-redline-audit.zip`（顶层目录 + 正斜杠路径 + 中文名 UTF-8 标志）。
（可选）若你在自己的仓库里维护了完整版《小程序开发红线与避坑指南.md》，其 `红线 X-Y` 编号须与 `references/redlines.md` 严格一致。

## 已知局限（如实告知用户）
- 建议项基于正则启发式，可能误报（`(a+b)` 分组会被当成方法调用、合法中文键在部分基础库可用）。硬红线精度高、可信。
- 无法替代真机验收：A 类（真机才暴露）里没被语法规则覆盖的部分，仍需真机跑一遍。
- `{{}}` 中文键（红线 8-2）请提醒用户按当前基础库自测确认，部分版本已支持。
- 只静态扫描 JS/WXML 文本，不执行代码；运行期竞态、云端脏数据需对照 `references/redlines.md` 人工检查。
