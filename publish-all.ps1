# 微信小程序开发套件 - 全部 skill 批量发布到 SkillHub
# 前置：已完成 `skillhub login`
# 用法（仓库根目录执行）：powershell -ExecutionPolicy Bypass -File publish-all.ps1

$repo  = Split-Path -Parent $MyInvocation.MyCommand.Path
$suite = Join-Path $repo 'wx-miniprogram-suite'

$list = @(
  # 全家桶（目录在 suite 内）
  (Join-Path $suite 'wx-miniprogram-scaffold'),
  (Join-Path $suite 'wx-miniprogram-blueprint'),
  (Join-Path $suite 'wx-virtual-payment'),
  (Join-Path $suite 'miniprogram-redline-audit'),
  (Join-Path $suite 'miniprogram-guardrails'),
  (Join-Path $suite 'miniprogram-docx'),
  (Join-Path $suite 'cloudbase-ai-textgen'),
  # 注：仓库根另有 3 个独立工具目录（wechat-devtools-cli / miniprogram-automator-boost / wxapp-paywall-smoke），
  # 非本次发布的原创 skill，未确认权属前不纳入发布脚本。
)

foreach ($p in $list) {
  Write-Host "==> Publishing $p"
  skillhub publish $p --changelog "微信小程序开发套件 v1.0.0"
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "发布 $p 失败（见上），已停止。可先 skillhub publish $p --dry-run 排查。"
    break
  }
}
Write-Host "全部发布请求已提交（status=pending_review）。"
