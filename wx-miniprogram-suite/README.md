# 微信小程序开发全家桶（wx-miniprogram-suite）

一套经过 3 个已上架小程序（AA Expense Split Assistant、Merchant Assistant、Whole-Process Construction Assistant）验证、**参数化、可跨项目复用**的 CodeBuddy / SkillHub skills，覆盖「从零搭建 → 合规 → 云开发 → 虚拟支付 → 红线审计 → 提审上架」的完整链路。

## 包含 7 个 skill

| 目录 | slug | 作用 |
|---|---|---|
| `wx-miniprogram-scaffold` | `mr0752-wx-mp-scaffold` | 编排层（agent 工作流）：从零到可上架基线 |
| `wx-miniprogram-blueprint` | `mr0752-wx-mp-blueprint` | 合规三件套 + 云调用封装 + 提审清单 |
| `wx-virtual-payment` | `mr0752-wx-mp-virtual-payment` | 微信虚拟支付双签名 + 发货回调幂等 |
| `miniprogram-redline-audit` | `mr0752-wx-mp-redline-audit` | 红线自动审计（3 个零依赖脚本） |
| `miniprogram-guardrails` | `mr0752-wx-mp-guardrails` | 点击锁 / 存储封装 / 演示数据等护栏 |
| `miniprogram-docx` | `mr0752-wx-mp-docx` | 纯前端 DOCX 导出（零依赖 OOXML） |
| `cloudbase-ai-textgen` | `mr0752-wx-mp-cloudbase-ai-textgen` | 云开发 AI 文本生成 |

**依赖关系**：`scaffold` 在运行时会按名字加载其余 6 个 skill，请一并安装，不要只装单个。

## 作为本地 skill 使用

把本目录下 7 个子目录**整体复制**到 CodeBuddy 的 user-level skills 目录：

- macOS / Linux：`~/.codebuddy/skills/`
- Windows：`C:/Users/<你的用户名>/.codebuddy/skills/`

## 发布到 SkillHub（整包）

SkillHub 的发布单位是**单个 skill**（一个 Slug + 一个显示名称），因此"整包"在 SkillHub 上就是 7 个独立 skill 一起发布。已为你打好 7 个 zip：`zips/*.zip`。

### 方案 A：网页端上传（最简单，无需安装 CLI）

1. 打开目录 `D:\GitHub\Skill\wx-miniprogram-suite\zips\`，里面有 7 个 zip：`wx-miniprogram-scaffold.zip`、`wx-miniprogram-blueprint.zip`、`wx-virtual-payment.zip`、`miniprogram-redline-audit.zip`、`miniprogram-guardrails.zip`、`miniprogram-docx.zip`、`cloudbase-ai-textgen.zip`。
2. 打开 SkillHub 发布页（「发布新技能」界面），逐个拖拽上传 zip。
3. 每张上传页会自动读取 `SKILL.md` 里的 `slug` 和 `displayName`；你只需确认 Slug、显示名称，图标可选，点发布。
4. 7 个全部上传完成，「我的 Skills」里即整套。

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
   # 其余 6 个同理
   ```
6. **一键发布**（在 `D:\GitHub\Skill\wx-miniprogram-suite` 下运行随附脚本，自动遍历 7 个）：
   ```powershell
   powershell -ExecutionPolicy Bypass -File publish.ps1
   ```
   看到 `✓ Published: skillId=xxxxx status=pending_review` 即进入审核。

> 已统一使用 `mr0752-wx-mp-*` 前缀降低冲突概率。若仍报 `409 slug 已被占用`，继续加长前缀即可。

## 合规声明

- 虚拟支付 / 合规三件套类 skill 仅提供**技术范式**，以微信官方文档与平台审核要求为准，**不保证通过审核**。
- 模板内容均为 `{{...}}` 占位符，使用前请填入你自己的主体、备案与联系方式；不要照搬示例项目符号（已在 `miniprogram-guardrails` 中标注为示例）。
- 本套件所有脚本零依赖、纯本地运行，不联网、不收集数据。
