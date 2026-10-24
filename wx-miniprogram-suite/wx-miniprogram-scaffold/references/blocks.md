# DOCX 块类型（buildDocx 的 blocks 字段）
每个 block 是对象，`type` 决定渲染：

- **h** 标题：`{ type:'h', text }`，加粗、size 26（半磅单位 size*2）。
- **p** 段落：`{ type:'p', text, size?, bold?, color?, align? }`
  - size 默认 21（≈10.5pt），bold 布尔，color 十六进制如 `'666666'`，align `'center'|'right'`。
  - text 内 `\n` 自动换行（`<w:br/>`）。
- **table** 表格：`{ type:'table', rows: [[...],[...]] }`，rows[0] 为表头（加粗）。列数取首行。
- **page** 分页符：`{ type:'page' }`。
- **image** 图片：`{ type:'image', data: Buffer, caption? }`，data 须为 PNG/JPEG 二进制；自动识别尺寸，单图最大宽 550px 等比缩放；caption 可选图注（居中灰字）。**这是"带照片文书"真实嵌入照片的关键块。**

doc 顶层：`{ title, subtitle?, header?, footer?, blocks }`
- title 必填（居中加粗 36）。subtitle 可选（居中灰字）。
- header/footer 可选（页眉页脚，footer 含 `PAGE` 域自动页码）。
