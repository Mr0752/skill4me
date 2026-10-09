# lint_redlines.ps1 — 小程序红线静态审计
# 用法:  powershell -ExecutionPolicy Bypass -File lint_redlines.ps1 <miniprogram-src-dir>
# 扫描通用小程序红线，输出按严重度分组的问题清单。
# 纯文本正则扫描，不依赖 node/python；跨项目通用。

param(
    [Parameter(Mandatory=$true)][string]$SrcDir
)

if (-not (Test-Path $SrcDir)) {
    Write-Error "源目录不存在: $SrcDir"
    exit 1
}

# 只扫小程序源码
$files = Get-ChildItem -Path $SrcDir -Recurse -Include *.js,*.ts,*.wxml,*.wxss,*.json
Write-Host "扫描文件数: $($files.Count)`n" -ForegroundColor Cyan

# 规则: 名称, 严重度, 正则, 说明
# 注意: 单引号字符串内用 '' 表示单引号；.NET 正则中文区间用 \u4e00-\u9fff
$rules = @(
    @{ name='真机语法 ?.';     sev='[A类/真机崩]'; pat='\?\.';                 tip='真机 Babel 不转换 ?. → SyntaxError 白屏；模拟器/lint 测不出' }
    @{ name='真机语法 ??';     sev='[A类/真机崩]'; pat='\?\?';                 tip='?? 真机不转换' }
    @{ name='真机语法 ||=';    sev='[A类/真机崩]'; pat='\|\|=';                tip='||= 真机不转换' }
    @{ name='真机语法 &&=';    sev='[A类/真机崩]'; pat='&&=';                  tip='&&= 真机不转换' }
    @{ name='wx:key="index"'; sev='[编译/静默]'; pat='wx:key\s*=\s*[''"]index[''"]'; tip='被当属性名 → 等于没 key，列表错乱' }
    @{ name='动态 bindtap';    sev='[编译/静默]'; pat='bind(tap|catch\w+)\s*=\s*\{\{'; tip='{{}} 内不支持动态绑定处理函数名' }
    @{ name='{{}} 中文属性名'; sev='[编译/报错]'; pat='\{\{[^{}]*[\u4e00-\u9fff]\w*\.[\u4e00-\u9fff]'; tip='{{}} 内禁止中文属性名，编译直接报错' }
    @{ name='flex 简写含 calc';sev='[真机/失效]'; pat='flex\s*:\s*\d+\s+\d+\s+calc\('; tip='flex 简写里用 calc() 真机整条声明失效' }
    @{ name='navigateTo(待核)';sev='[平台/待核]'; pat='wx\.navigateTo';        tip='跳 tabBar 页面会静默失败，请确认目标不是 tabBar' }
)

$totalHits = 0
foreach ($r in $rules) {
    $hits = @()
    foreach ($f in $files) {
        $lines = [System.IO.File]::ReadAllLines($f.FullName)
        for ($i=0; $i -lt $lines.Length; $i++) {
            if ($lines[$i] -match $r.pat) {
                $hits += "   $($f.Name):$($i+1): $($lines[$i].Trim())"
            }
        }
    }
    if ($hits.Count -gt 0) {
        $totalHits += $hits.Count
        Write-Host "$($r.sev) $($r.name)  ($($hits.Count))" -ForegroundColor Yellow
        Write-Host "     说明: $($r.tip)" -ForegroundColor DarkGray
        $hits | ForEach-Object { Write-Host $_ }
        Write-Host ''
    }
}

if ($totalHits -eq 0) {
    Write-Host '✅ 未发现脚本可识别的红线模式。' -ForegroundColor Green
} else {
    Write-Host "⚠️ 共命中 $totalHits 处，请逐条核对（navigateTo 需手动确认是否跳 tabBar）。" -ForegroundColor Red
}
