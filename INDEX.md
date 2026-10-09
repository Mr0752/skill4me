# Skill 仓库索引（微信小程序开发套件）

本仓库 `D:\GitHub\Skill` 汇总微信小程序开发相关的 CodeBuddy skill。

## 一、全家桶整包（推荐：直接装这一个）
`wx-miniprogram-suite/` —— 从零到可上架的脚手架编排 + 6 个配套 skill，共 7 个（**均为用户要求创作**）：

| Skill | 角色 |
|---|---|
| `wx-miniprogram-scaffold` | 编排层（agent 工作流：需求→骨架→合规→云调用→支付→红线审计→提审） |
| `wx-miniprogram-blueprint` | 合规三件套 + 云调用封装 + 提审清单 |
| `wx-virtual-payment` | 微信虚拟支付双签名 + 发货回调幂等 |
| `miniprogram-redline-audit` | 红线自动审计（3 个零依赖脚本） |
| `miniprogram-guardrails` | 防踩坑护栏 |
| `miniprogram-docx` | 纯前端 DOCX 导出 |
| `cloudbase-ai-textgen` | 云开发 AI 文本生成 |

## 二、红线审计说明
红线审计的**权威最新版**在 `wx-miniprogram-suite/miniprogram-redline-audit/`（SKILL.md + scripts + references 完整）。
配套文档：`小程序开发红线与避坑指南.md`、`上架文案.md`（仓库根）。

## 三、发布到 SkillHub
- 全家桶：`cd wx-miniprogram-suite && powershell -ExecutionPolicy Bypass -File publish.ps1`
- 全部 7 个（仓库根执行）：`powershell -ExecutionPolicy Bypass -File publish-all.ps1`
- 前置：`skillhub login`
- 注：本仓库早期曾并列 3 个独立工具目录（`wechat-devtools-cli` / `miniprogram-automator-boost` / `wxapp-paywall-smoke`），**当前已不在该仓库**；它们非本会话创作、权属待定，不纳入发布。

## 约定
- 每个 skill 自带 `SKILL.md`（YAML frontmatter: `name` / `description`）、`scripts/`、`references/`。
- 脚本一律零依赖 node，纯本地、不联网；退出码统一：0=通过，1=有问题，2=环境/用法错误。
- 启发式检查的结果一律标注「需人工复核」，不把建议项说成硬性问题。
