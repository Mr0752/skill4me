# doc-scan-ocr 使用详解

工具位置：**`D:\tools\doc-convert\`**
（D 盘为 PARA 结构，`tools` 专放通用工具。项目目录里若有副本，以 `D:\tools` 这份为准，防版本分叉。）

---

## 一、目录构成

```
doc-convert/
├─ index.js              主入口：格式路由（docx / xlsx / pdf / 图片）→ 输出 md / json / csv
├─ winocr.ps1            Windows 自带 OCR 封装（PDF 光栅化 + 图片放大 + 识别 + 输出 JSON）
├─ layout.js             版面重组：中文空格合并 / 行聚合 / 表格列聚类
├─ emit.js               输出发射（md / json / csv）
├─ ooxml.js              OOXML 解析（docx / xlsx）
├─ xlsx2data.js          表格数据提取
├─ run-doc-convert.ps1   无人值守入口（日志 / 权限自检 / 错误不中断 / 计划任务）
├─ run-doc-convert.bat   双击启动器
└─ inbox/ outbox/ logs/  默认工作目录
```

---

## 二、标准工作流

### 步骤 1 · 放文件
把待转换文件复制进 **`inbox/`**。支持：
- `.docx` / `.xlsx`（直接解析，**不经 OCR，最准**）
- 有文本层的 `.pdf`（直接抽文本层，准）
- 扫描版 `.pdf`、`.jpg / .png / .bmp / .tif / .webp`（走 OCR）

> 老格式 `.doc` / `.xls` / `.wps`：先另存为 `.docx` / `.xlsx`（工具会给转化指引）。
> `.dwg`：不适用（CAD 需专用解析栈）。

### 步骤 2 · 跑
双击 `run-doc-convert.bat`（最省事），或命令行：
```powershell
node "D:\tools\doc-convert\index.js" ".\inbox" -o ".\outbox"
```

### 步骤 3 · 取结果
结果在 **`outbox/`**：
- `.md` —— 给人看（结论先行、分页、表格转 Markdown、末尾复核提示）
- `.json` —— 给程序（原文 + 坐标 + 结构化 blocks + warnings）
- `.csv` —— 给 Excel（每个表格一个文件）

### 步骤 4 · 复核（必做）
1. 看 JSON 的 **`converter`** 字段，确认走了哪条路：
   - `pdf-text` = 抽文本层，**可信度高**
   - `windows-ocr(...)` = OCR，**必须人工核数字**
2. 看 **`warnings[]`**：凡是被标疑似数字误读的行，逐条回原文档核对。
3. **涉及收费、定额、工程量、金额的数字，一律不直接采信 OCR 结果。**

---

## 三、退出码（脚本/自动化用）

| 码 | 含义 |
|---|---|
| 0 | 全成功 |
| 1 | 部分失败 |
| 2 | 前置检查未过 |
| 3 | 无文件 |
| 4 | 权限不足 |
| 5 | 内部异常 |

---

## 四、为什么不装 PaddleOCR / MinerU

- **PaddleOCR / MinerU**：精度更高（尤其复杂表格），但要装 Python + 数百 MB 模型。
- **本工具**：零安装、开箱即用，用 Windows 10/11 **系统自带**的 `Windows.Media.Ocr` + `Windows.Data.Pdf`，中文识别包通常已随中文版系统装好。
- **判断标准**：要精度、能接受装环境 → 上 Paddle/MinerU；**要立刻能用、不折腾 → 用本工具**，再把标注的风险项（尤其数字）人工回原文档核对。

---

## 五、常见故障速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 识别结果一片乱码 | 源图分辨率太低 | 工具已自动放大到 2500px；仍差则从源头取更清晰件 |
| 数字 `0 · 5`、`3，5` | OCR 把小数点误读 | 看 `warnings`，回原文档核对数字 |
| 表格列对不齐 | 启发式列聚类局限 | CSV 仅供参考，复杂表用 Paddle/MinerU 或人工整理 |
| 报图片格式错 | **扩展名撒谎**（实为 WebP） | 以魔数为准：`node .codebuddy/tools/tmp/check-img.js <文件>` |
| 改完 `.ps1` 报成片 `Unexpected token` | **无 BOM** 被 PS5.1 按 GBK 解码 | `node .codebuddy/tools/tmp/add-bom.js <文件.ps1>` |
| `The term 'if' is not recognized` | PS 5.1 不支持 `if` 当表达式 | 先 `$v = if (...){...}else{...}` 再拼接 |

---

## 六、与其他 skill 的配合

- 抽取出的表格若要**入库查询**（如规范/定额库），走 `miniprogram-data-pipeline` 的清洗入库流程。
- 生成的 `.md/.csv` 若要**导出成 Word**，走 `miniprogram-docx`。
- 若内容将进入 AI 知识库，务必先人工校对（OCR 误读会污染知识库 → 模型输出错误数字）。
