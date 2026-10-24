# 微信小程序开发套件（wx-miniprogram-suite）

一套经过 3 个已上架小程序（AA Expense Split Assistant、Merchant Assistant、Whole-Process Construction Assistant）验证、**参数化、可跨项目复用**的 CodeBuddy / SkillHub skills，覆盖「从零搭建 → 合规 → 云开发 → 虚拟支付 → 红线审计 → 提审上架」的完整链路。

## 包含 9 个 skill

| 目录 | slug | 作用 |
|---|---|---|
| `wx-miniprogram-scaffold` | `mr0752-wx-mp-scaffold` | 编排层（agent 工作流）：从零到可上架基线 |
| `wx-miniprogram-blueprint` | `mr0752-wx-mp-blueprint` | 合规三件套 + 云调用封装 + 提审清单 |
| `wx-virtual-payment` | `mr0752-wx-mp-virtual-payment` | 微信虚拟支付双签名 + 发货回调幂等 |
| `miniprogram-redline-audit` | `mr0752-wx-mp-redline-audit` | 红线自动审计（3 个零依赖脚本） |
| `miniprogram-guardrails` | `mr0752-wx-mp-guardrails` | 点击锁 / 存储封装 / 演示数据等护栏 |
| `miniprogram-docx` | `mr0752-wx-mp-docx` | 纯前端 DOCX 导出（零依赖 OOXML） |
| `cloudbase-ai-textgen` | `mr0752-wx-mp-cloudbase-ai-textgen` | 云开发 AI 文本生成 |
| `doc-scan-ocr` | `mr0752-doc-scan-ocr` | 扫描件/图片 → 表格抽取（零安装 Windows OCR） |
| `wx-miniprogram-publish` | `mr0752-wx-mp-publish` | 上架控制台 + 提审 SOP（小白分步指引） |

**依赖关系**：`scaffold` 在运行时会按名字加载其余 skill，请一并安装，不要只装单个。

## 作为本地 skill 使用

把本目录下 9 个子目录**整体复制**到 CodeBuddy 的 user-level skills 目录：

- macOS / Linux：`~/.codebuddy/skills/`
- Windows：`C:/Users/<你的用户名>/.codebuddy/skills/`

## 发布到 SkillHub（整包）

SkillHub 的发布单位是**单个 skill**（一个 Slug + 一个显示名称），因此"整包"在 SkillHub 上就是 9 个独立 skill 一起发布。已为你打好 9 个 zip：`zips/*.zip`。

### 方案 A：网页端上传（最简单，无需安装 CLI）

1. 打开目录 `D:\GitHub\Skill\wx-miniprogram-suite\zips\`，里面有 9 个 zip：`wx-miniprogram-scaffold.zip`、`wx-miniprogram-blueprint.zip`、`wx-virtual-payment.zip`、`miniprogram-redline-audit.zip`、`miniprogram-guardrails.zip`、`miniprogram-docx.zip`、`cloudbase-ai-textgen.zip`、`doc-scan-ocr.zip`、`wx-miniprogram-publish.zip`。
2. 打开 SkillHub 发布页（「发布新技能」界面），逐个拖拽上传 zip。
3. 每张上传页会自动读取 `SKILL.md` 里的 `slug` 和 `displayName`；你只需确认 Slug、显示名称，图标可选，点发布。
4. 9 个全部上传完成，「我的 Skills」里即整套。

### 方案 B：CLI 批量（适合后续迭代更新）

以下步骤**需你亲自执行**（涉及本地安装 CLI 与公网发布，agent 不代执行）：

1. **实名认证**：浏览器登录 https://skillhub.cn → 个人中心 → 实名认证（人脸核身）。未认证无法创建 Token / 发布。
2. **创建 API Token**：个人中心 → API keys → 创建，复制 `skh_` 开头的完整 Token（仅显示一次）。
3. **安装 CLI**：
   ```bash
   curl -fsSL https://skillhub.cn/install/install.sh | bash -s -- --cli-only
   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
   skillhub --version   # 看到版本号即成功
   ```
4. **登录（填入你的 Token）**：
   ```bash
   skillhub login --key skh_你的Token --host https://api.skillhub.cn
   skillhub auth whoami
   ```
5. **（可选）逐个预检**：
   ```bash
   skillhub publish wx-miniprogram-scaffold --dry-run
   # 其余 8 个同理
   ```
6. **一键发布**（在 `D:\GitHub\Skill\wx-miniprogram-suite` 下运行随附脚本，自动遍历 9 个）：
   ```powershell
   powershell -ExecutionPolicy Bypass -File publish.ps1
   ```
   看到 `✓ Published: skillId=xxxxx status=pending_review` 即进入审核。

> 已统一使用 `mr0752-wx-mp-*` / `mr0752-*` 前缀降低冲突概率。若仍报 `409 slug 已被占用`，继续加长前缀即可。

## 发布到 WorkBuddy 开放平台（open.workbuddy.cn，推荐）

本套件现已采用 **WorkBuddy 开放平台** 的 SKILL.md frontmatter 格式（`name` / `display_name` / `display_name_en` / `description` / `description_zh` / `description_en` / `category` / `version` / `author`），可直接上传。

1. 打开 [open.workbuddy.cn](https://open.workbuddy.cn) → 左侧【专家·技能·连接器】→【技能】→【技能市场】。
2. 右上角【添加技能】→【创建技能】，选择**上传 zip 包**。
3. 逐个上传 `zips/` 下 9 个 zip（`wx-miniprogram-scaffold.zip` … `wx-miniprogram-publish.zip`、`doc-scan-ocr.zip`）。每个 zip 内 `SKILL.md` 已在根目录，平台会自动读取 `display_name` / `description` / `category` 等。
4. 提交后平台解析；若报"解析失败"，对照官方【技能基础结构】排查（或邮件 `openworkbuddy@tencent.com`）。
5. 9 个全部上传完成即整套上线。

> 注意：`scaffold` 运行时按 `name` 加载其余 skill，请一并安装，不要只装单个。
> `category` 取值以平台创建页下拉为准（本仓库示例填 `开发` / `效率`），如平台有固定枚举请按需调整。

### frontmatter 写法红线（平台 YAML 解析很严格）

- **值里出现 `: `（冒号+空格）必须整体加引号**，否则报
  `frontmatter 无法解析 (yaml: line N: mapping values are not allowed in this context)`。
  例：`description_en: 'End-to-end launch & review SOP: code preflight, ...'`
- 值里出现 ` #`（空格+井号）、或以 `- ? : , [ ] { } # & * ! | > ' " % @ `` ` `` 开头时，同样要加引号。
- 中文全角冒号 `：` **不触发**该问题（`description` / `description_zh` 里的「触发词：」属于安全写法）。
- 改完 frontmatter 建议本地用 PyYAML 过一遍再打包：
  `python -c "import yaml;yaml.safe_load(open('SKILL.md',encoding='utf-8').read().split('---')[1])"`

## 发布到 SkillHub（备用，需补回 slug）

`publish.ps1` / `publish-all.ps1` 仍保留，但它们依赖 SkillHub 的 `slug` / `displayName` 字段——本仓库为适配开放平台已**移除**这些字段。若仍需发 SkillHub，请在每个 SKILL.md 的 frontmatter 补回 `slug:` 与 `displayName:`，再 `skillhub login` 后执行脚本。

## 合规声明

- 虚拟支付 / 合规三件套类 skill 仅提供**技术范式**，以微信官方文档与平台审核要求为准，**不保证通过审核**。
- 模板内容均为 `{{...}}` 占位符，使用前请填入你自己的主体、备案与联系方式；不要照搬示例项目符号（已在 `miniprogram-guardrails` 中标注为示例）。
- 本套件所有脚本零依赖、纯本地运行，不联网、不收集数据。
