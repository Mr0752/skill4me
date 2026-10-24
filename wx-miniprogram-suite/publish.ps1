# 微信小程序全家桶 - 批量发布到 SkillHub
# 前置：已完成 `skillhub login`
# 用法：powershell -ExecutionPolicy Bypass -File publish.ps1

$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$list = @(
  'wx-miniprogram-scaffold',
  'wx-miniprogram-blueprint',
  'wx-virtual-payment',
  'miniprogram-redline-audit',
  'miniprogram-guardrails',
  'miniprogram-docx',
  'cloudbase-ai-textgen',
  'doc-scan-ocr',
  'wx-miniprogram-publish'
)

foreach ($s in $list) {
  $p = Join-Path $base $s
  Write-Host "==> Publishing $s"
  skillhub publish $p --changelog "微信小程序开发全家桶 v1.1.0（新增 doc-scan-ocr、wx-miniprogram-publish）"
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "发布 $s 失败（见上），已停止。请先 skillhub publish $s --dry-run 排查。"
    break
  }
}
Write-Host "全部发布请求已提交（status=pending_review）。"
