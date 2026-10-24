---
slug: mr0752-doc-scan-ocr
displayName: 扫描件/图片转表格（零安装）
version: 1.0.0
summary: Windows 自带 OCR 做扫描件与图片的表格抽取，输出 md/json/csv，不用装 Python/Paddle/MinerU。
license: MIT
name: doc-scan-ocr
description: Turn scanned PDFs, photos, screenshots, docx and xlsx into structured md/json/csv tables using only the Windows built-in OCR engine — zero installs, no Python, no PaddleOCR, no MinerU. Use this skill when the user says "扫描件", "PDF 拖不出文字", "图片转表格", "OCR", "提取表格", "转 Excel/CSV", or needs to convert any document (scanned or text-layer PDF, jpg/png/bmp/tif/webp, docx, xlsx) into machine-readable tables. It includes the input→tool decision table, three run modes (double-click / CLI / unattended scheduled task), exit-code contract, and the two hard Windows PowerShell traps (UTF-8 BOM required; PS 5.1 cannot use `if` as an expression).
---

# 扫描件 / 图片 → 表格抽取（零安装）

## Purpose
下次遇到**扫描件**（PDF 拖不出文字 / 拍照 / 截图）时，不再临时折腾 OCR 环境。本 skill 指向的 `D:\tools\doc-convert\` 开箱即用，把任意扫描件或文档转成可编辑的 md / json / csv。

## 通用性结论（已确认）
**具有通用性，但边界明确：**
- ✅ **通用**：工具本身**不含任何建筑/业务领域逻辑**。输入是通用格式（PDF/图片/docx/xlsx），输出是通用格式（md/json/csv），领域知识只是被喂进去的**数据**而非工具的一部分。自带 `ooxml.js` 与 `inbox/outbox/logs` 目录及双击启动器，**不依赖任何项目的 `node_modules`**（pdfjs 仅用于抽 PDF 文本层，缺失时自动回落 OCR，只是精度降低）。
- ⚠️ **边界**：① 仅 Windows（依赖系统 `Windows.Media.Ocr` / `Windows.Data.Pdf`）；② OCR 精度有限，**数字/表格必须人工回原文档核对**；③ `.doc`/`.xls`/`.wps` 需先另存为 `.docx`/`.xlsx`，`.dwg` 不适用。
- 📌 **定位**：`扫描件初筛/抽取 + 人工复核`，**不能当权威数据源**直接用于收费/定额/结算。

## 输入 → 用哪个（决策表）

| 手上的东西 | 走哪条路 | 结果里 `converter` 字段 |
|---|---|---|
| `.docx` / `.xlsx` | 直接解析 OOXML，**不经 OCR，精确可信** | 原生解析 |
| 有文本层的 PDF | 直接抽文本层，精确 | `pdf-text` |
| **扫描版 PDF**（选不中文字） | 自动回落 OCR | `windows-ocr(zh-Hans-CN)/300dpi` |
| 图片（jpg/png/bmp/tif/webp） | 自动 OCR；小图自动放大到 2500px | `windows-ocr(...)` |

> 拿到结果**先看 JSON 的 `converter` 字段**，就知道走了哪条路、结果该信几分。

## 三种用法

### ① 双击（最简单）
1. 待转换文件放进 `D:\tools\doc-convert\inbox\`
2. 双击 `run-doc-convert.bat`
3. 结果在 `outbox\`，日志在 `logs\`

### ② 命令行
```powershell
node "D:\tools\doc-convert\index.js" ".\扫描件.pdf" -o ".\out"
node "D:\tools\doc-convert\index.js" ".\doc\04_检测与报告" -o ".\out"   # 整个目录递归
node "D:\tools\doc-convert\index.js" ".\扫描件.pdf" -o ".\out" --only csv
```

### ③ 无人值守（计划任务）
```powershell
.\run-doc-convert.ps1 -Path "D:\扫描件" -InstallSchedule -ScheduleTime 02:00
.\run-doc-convert.ps1 -UninstallSchedule
```

## 输出格式

| 格式 | 给谁 | 内容 |
|---|---|---|
| `.md` | 人看 | 结论先行、分页标题、表格转 Markdown、末尾附**复核提示** |
| `.json` | 程序调 | 原文 + 每行 `x/y/w/h` 坐标 + `pages[].blocks[]` + `warnings[]` |
| `.csv` | Excel | 每个识别出的表格一个文件（`.表1.csv`…） |

## ⚠️ 五个必须知道的限制

1. **数字会被误读。** Windows OCR 常把小数点读成 `·` 或 `，`（`0.5`→`0 · 5`）。涉及收费、定额、工程量的数字**一律回原文档核对**。
2. **表格重建是启发式的。** 列位置靠坐标聚类推断，**合并单元格识别不了**；多行单元格、跨页表格、无框线表格都可能对不齐。
3. **低分辨率图必须先放大。** 720×707 的图直接识别是乱码，放大到 2500px 后可正确识别（工具已自动处理，但源头越清晰越好）。
4. **扩展名可能撒谎。** 曾实测 `xxx.jpg` 魔数实为 `RIFF` = **WebP 被改后缀**。判断格式**以魔数为准**。
5. **仅 Windows。** Mac/Linux 需换 OCR 引擎。

## 改 `.ps1` 的两个硬坑（踩过）

1. **`.ps1` 必须存成带 BOM 的 UTF-8。** PowerShell 5.1 在中文系统按 GBK 解码无 BOM 文件 → 中文乱码 → 破坏字符串字面量 → 成片 `Unexpected token`。
2. **PS 5.1 不允许把 `if` 当表达式嵌进括号。** `("x" + (if ($a) {1} else {2}))` 报错；必须先赋值 `$v = if ($a) {1} else {2}` 再拼接（PS 7 才支持前者）。

## 详细参考
`references/usage.md`
