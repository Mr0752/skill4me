---
name: miniprogram-docx
display_name: 小程序纯前端 DOCX 导出
display_name_en: Mini Program Pure-Frontend DOCX Export
description: 小程序端零依赖导出 Word 文档（触发词：导出Word / 生成docx / DOCX导出）。
description_zh: 零依赖 OOXML 生成 Word 文档，支持嵌入图片，适合小程序端导出报告。
description_en: Pure front-end DOCX (Word) generation via zero-dependency OOXML, with image embedding support.
category: 开发
version: 1.0.0
author: Mr0752
---

# Mini Program DOCX Export (纯前端)

## Purpose
Generate real `.docx` files entirely in JS (no npm package, no Office) by assembling OOXML (zip + xml). Works both on the client (mini program) and in a Node cloud function. Supports headings, paragraphs, tables, page breaks, and **embedded images** — so a "photo + form" deliverable actually contains the photos (not a placeholder).

## When to use
- User needs to produce `.docx` deliverables (reports, contracts, acceptance records, exports).
- "导出Word / 生成docx / Word文档".
- Want to avoid a heavy npm dependency or server-side Office.

## How to use
1. Copy `assets/zip.js` → project `utils/zip.js` (minimal store-mode zip packer, no dependency).
2. Copy `assets/docx.js` → project `utils/docx.js` (requires `./zip.js`).
3. Build a document:
   ```js
   const docx = require('./docx');
   const buf = docx.buildDocx({
     title: '检验批质量验收记录',
     subtitle: '工程名称：XX',
     header: 'XX项目', footer: '第 N 页',
     blocks: [
       { type: 'h', text: '一、主控项目' },
       { type: 'p', text: '以下内容...' },
       { type: 'table', rows: [['序号','项目','结论'],['1','xx','合格']] },
       { type: 'page' },
       { type: 'image', data: pngBuffer, caption: '现场照片1' }
     ]
   });
   // buf is an ArrayBuffer
   ```
4. Client side: `docx.deliver('name.docx', buf)` writes to USER_DATA_PATH and opens via `wx.openDocument`.
5. Cloud function side: upload `buf` with `cloud.uploadFile({ cloudPath, fileContent: buf })` and return the temp file URL.

## Block reference (see references/blocks.md)
`h` (heading) / `p` (paragraph, with size/bold/color/align) / `table` (rows of rows) / `page` (page break) / `image` (data = PNG/JPEG Buffer, optional caption).

## Notes / pitfalls
- `buildDocx` is pure JS and runs in Node cloud functions too — but `deliver()` uses `wx.*` and is client-only; in cloud use `cloud.uploadFile`.
- Image data must be a real PNG/JPEG Buffer; size is auto-detected from file headers.
- `esc`/`clean` already handle XML-escaping and strip control chars; pass raw strings.
- Output is a valid OOXML docx openable by Word/WPS.
