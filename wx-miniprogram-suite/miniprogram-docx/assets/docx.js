// 纯前端 DOCX 生成器（OOXML = zip + xml），无需服务端 / 第三方库。
// 云端（Node）与端上（小程序）通用：buildDocx 返回 ArrayBuffer；端上用 deliver() 写本地+打开，云函数侧改用 cloud.uploadFile 上传。
// 依赖 ./zip.js（极简 ZIP 打包器，零依赖）。
// 块类型：h / p / table / page / image（image.data 支持 Buffer/Uint8Array/ArrayBuffer/base64 字符串或 data URI，自动识别 PNG/JPEG 并按比例缩放真实嵌入，可选 caption）
const zip = require('./zip.js');

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function xml(str) { return zip.utf8Bytes(XML_HEAD + str); }
function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
// 移除 XML 1.0 不允许的控制字符（剪贴板/外部数据可能带入）
function clean(s) {
  return String(s === undefined || s === null ? '' : s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

// doc: { title, subtitle, blocks, header, footer }
// block: { type:'h'|'p'|'table'|'page'|'image', text, rows, size, bold, color, align, data, caption }
//   image: data = Buffer（PNG/JPEG 二进制），caption 可选图注
// 将多种来源归一为「可按字节读取的缓冲区」：Node Buffer / Uint8Array / ArrayBuffer / base64 字符串 / data URI
function u32(buf, off) {
  if (typeof buf.readUInt32BE === 'function') return buf.readUInt32BE(off);
  return ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
}
function u16(buf, off) {
  if (typeof buf.readUInt16BE === 'function') return buf.readUInt16BE(off);
  return ((buf[off] << 8) | buf[off + 1]) >>> 0;
}
function toBuffer(data) {
  if (!data) return null;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) return data;
  if (typeof data === 'object') {
    if (data instanceof Uint8Array) return (typeof Buffer !== 'undefined') ? Buffer.from(data) : data;
    if (typeof data.byteLength === 'number') {
      const u8 = new Uint8Array(data);
      return (typeof Buffer !== 'undefined') ? Buffer.from(u8) : u8;
    }
    return null;
  }
  if (typeof data === 'string') {
    let s = data.trim();
    if (s.indexOf('data:') === 0) {
      const c = s.indexOf(',');
      if (c >= 0) s = s.slice(c + 1);
    }
    s = s.replace(/[\r\n\t ]/g, '');
    if (typeof Buffer !== 'undefined') {
      try { return Buffer.from(s, 'base64'); } catch (e) {}
    }
    if (typeof wx !== 'undefined' && wx.base64ToArrayBuffer) {
      try { return new Uint8Array(wx.base64ToArrayBuffer(s)); } catch (e) {}
    }
    if (typeof atob !== 'undefined') {
      try {
        const bin = atob(s);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return u8;
      } catch (e) {}
    }
    return null;
  }
  return null;
}
function imageType(buf) {
  if (buf && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E) return { ext: 'png', ct: 'image/png' };
  if (buf && buf[0] === 0xFF && buf[1] === 0xD8) return { ext: 'jpeg', ct: 'image/jpeg' };
  return null;
}
function imageSize(buf) {
  try {
    if (buf[0] === 0x89 && buf[1] === 0x50) { // PNG：IHDR 的宽/高位于字节 16/20
      return { w: u32(buf, 16), h: u32(buf, 20) };
    }
    if (buf[0] === 0xFF && buf[1] === 0xD8) { // JPEG：扫描 SOF 段取宽高
      let off = 2;
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xFF) { off++; continue; }
        const marker = buf[off + 1];
        if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          return { w: u16(buf, off + 7), h: u16(buf, off + 5) };
        }
        const len = u16(buf, off + 2);
        off += 2 + len;
      }
    }
  } catch (e) {}
  return null;
}
const EMU = 9525;        // 1px = 9525 EMU
const IMG_MAX_W = 550;    // 单图最大宽度（px），超出按比例缩放
const IMG_MAX_H = 720;    // 单图最大高度（px），超出按比例缩放（防细长图撑破页面）

// wp:inline 自包含声明全部所需命名空间，不依赖 document 根节点；id 随图递增，避免多图冲突
function imagePara(info) {
  const cx = info.cx, cy = info.cy, rId = info.rId, id = info.id || 1;
  const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingdrawing';
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return `<w:p><w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="${WP}" xmlns:a="${A}" xmlns:pic="${PIC}" xmlns:r="${R}">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${id}" name="img${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="${PIC}">` +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="img${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function buildDocx(doc) {
  const d = doc || {};
  let body = '';
  body += para(d.title || '文档', { bold: true, size: 36, align: 'center' });
  if (d.subtitle) body += para(d.subtitle, { size: 21, align: 'center', color: '666666' });

  const images = [];
  let imgCnt = 0;
  (d.blocks || []).forEach((b) => {
    if (b.type === 'h') body += para(b.text, { bold: true, size: 26 });
    else if (b.type === 'table') body += table(b.rows || []);
    else if (b.type === 'page') body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    else if (b.type === 'image') {
      const buf = toBuffer(b.data);
      const t = imageType(buf);
      if (t) {
        const sz = imageSize(buf) || { w: IMG_MAX_W, h: IMG_MAX_H };
        const scale = Math.min(IMG_MAX_W / sz.w, IMG_MAX_H / sz.h);
        const cx = Math.round(sz.w * scale * EMU);
        const cy = Math.round(sz.h * scale * EMU);
        const id = ++imgCnt;
        const rId = 'rIdImg' + id;
        const file = rId + '.' + t.ext;
        images.push({ buf: buf, rId: rId, file: file, ct: t.ct });
        body += imagePara({ cx: cx, cy: cy, rId: rId, id: id });
        if (b.caption) body += para(b.caption, { size: 18, color: '666666', align: 'center' });
      } else if (b.caption) {
        body += para(b.caption, { size: 18, color: '666666' });
      }
    }
    else body += para(b.text, { size: b.size || 21, bold: !!b.bold, color: b.color, align: b.align });
  });

  const sectRefs = [];
  const docRels = [`<Relationship Id="rIdSt" Type="${REL_NS}/styles" Target="styles.xml"/>`];
  const overrides = [
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`,
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>`
  ];
  const entries = [
    { name: 'word/document.xml', data: null },
    { name: 'word/styles.xml', data: zip.utf8Bytes(docStyles()) }
  ];

  if (d.header) {
    sectRefs.push('<w:headerReference w:type="default" r:id="rIdHd"/>');
    docRels.push(`<Relationship Id="rIdHd" Type="${REL_NS}/header" Target="header1.xml"/>`);
    overrides.push(`<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>`);
    entries.push({ name: 'word/header1.xml', data: zip.utf8Bytes(headerXml(d.header)) });
  }
  if (d.footer) {
    sectRefs.push('<w:footerReference w:type="default" r:id="rIdFt"/>');
    docRels.push(`<Relationship Id="rIdFt" Type="${REL_NS}/footer" Target="footer1.xml"/>`);
    overrides.push(`<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`);
    entries.push({ name: 'word/footer1.xml', data: zip.utf8Bytes(footerXml(d.footer)) });
  }

  // 图片：media 文件 + relationship + content-type
  images.forEach((im) => {
    docRels.push(`<Relationship Id="${im.rId}" Type="${REL_NS}/image" Target="media/${im.file}"/>`);
    overrides.push(`<Override PartName="/word/media/${im.file}" ContentType="${im.ct}"/>`);
    entries.push({ name: 'word/media/' + im.file, data: im.buf });
  });

  body += `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/>${sectRefs.join('')}</w:sectPr>`;
  const XMLNS = ` xmlns:r="${REL_NS}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingdrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
  const document = `${XML_HEAD}<w:document xmlns:w="${W_NS}"${XMLNS}><w:body>${body}</w:body></w:document>`;
  entries[0].data = zip.utf8Bytes(document);

  entries.push({
    name: '_rels/.rels',
    data: zip.utf8Bytes(`${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="word/document.xml"/></Relationships>`)
  });
  entries.push({
    name: 'word/_rels/document.xml.rels',
    data: zip.utf8Bytes(`${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}">${docRels.join('')}</Relationships>`)
  });
  entries.push({
    name: '[Content_Types].xml',
    data: zip.utf8Bytes(`${XML_HEAD}<Types xmlns="${CT_NS}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
      overrides.join('') + `</Types>`)
  });
  return zip.makeZip(entries);
}

function headerXml(text) {
  return `${XML_HEAD}<w:hdr xmlns:w="${W_NS}"><w:p><w:pPr><w:jc w:val="center"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="BFBFBF"/></w:pBdr></w:pPr>` +
    `<w:r><w:rPr><w:b/><w:color w:val="1F3B73"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(clean(text))}</w:t></w:r></w:p></w:hdr>`;
}

function footerXml(text) {
  return `${XML_HEAD}<w:ftr xmlns:w="${W_NS}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
    `<w:r><w:rPr><w:color w:val="888888"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${esc(clean(text))}</w:t></w:r></w:p>` +
    `<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:color w:val="999999"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">第 </w:t></w:r>` +
    `<w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>` +
    `<w:r><w:rPr><w:color w:val="999999"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve"> 页</w:t></w:r></w:p></w:ftr>`;
}

function para(text, opt) {
  const o = opt || {};
  const rPr = `${o.bold ? '<w:b/>' : ''}${o.size ? `<w:sz w:val="${o.size * 2}"/>` : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}`;
  const lines = String(text === undefined || text === null ? '' : text).split('\n');
  const runs = lines.map((ln, i) => (i === 0 ? '' : '<w:br/>') + `<w:t xml:space="preserve">${esc(clean(ln))}</w:t>`).join('');
  const jc = (o.align === 'center' || o.align === 'right') ? `<w:jc w:val="${o.align}"/>` : '';
  const pPr = jc + (o.size && o.size < 18 ? '<w:spacing w:after="60"/>' : '');
  return `<w:p><w:pPr>${pPr}</w:pPr><w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}${runs}</w:r></w:p>`;
}

function table(rows) {
  const grid = `<w:tblGrid>${(rows[0] || []).map(() => '<w:gridCol w:w="3000"/>').join('')}</w:tblGrid>`;
  const trs = rows.map((row, ri) => {
    const cells = row.map((v) => `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>` +
      `<w:p><w:r>${ri === 0 ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${esc(clean(v))}</w:t></w:r></w:p></w:tc>`).join('');
    return `<w:tr>${cells}</w:tr>`;
  }).join('');
  const borders = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((t) => `<w:${t} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('') + '</w:tblBorders>';
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${borders}</w:tblPr>${grid}${trs}</w:tbl>`;
}

function docStyles() {
  return `${XML_HEAD}<w:styles xmlns:w="${W_NS}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="宋体" w:eastAsia="宋体" w:hAnsi="宋体"/><w:sz w:val="21"/></w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
}

function stamp() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
}

// 以下 deliver / writeFileRobust 仅端上（小程序）使用；云函数侧请用 cloud.uploadFile(uploadFile({cloudPath, fileContent: buf}))
function writeFileRobust(path, buf) {
  const fs = wx.getFileSystemManager();
  return new Promise((resolve, reject) => {
    fs.writeFile({
      filePath: path, data: buf,
      success: () => resolve(path),
      fail: () => {
        try {
          fs.writeFile({
            filePath: path, data: wx.arrayBufferToBase64(buf), encoding: 'base64',
            success: () => resolve(path), fail: reject
          });
        } catch (e) { reject(e); }
      }
    });
  });
}

function deliver(fileName, buf) {
  const path = `${wx.env.USER_DATA_PATH}/${fileName}`;
  return writeFileRobust(path, buf).then((p) => {
    wx.showModal({
      title: '导出成功',
      content: `已生成 ${fileName}\n右上角「···」可转发到微信，电脑上直接打开；也可保存本地。`,
      confirmText: '立即打开', cancelText: '关闭',
      success: (r) => {
        if (!r.confirm) return;
        wx.openDocument({ filePath: p, fileType: 'docx', showMenu: true, fail: (e) => wx.showToast({ title: '打开失败 ' + (e.errMsg || ''), icon: 'none' }) });
      }
    });
    return p;
  }).catch((e) => {
    wx.showToast({ title: '导出失败 ' + (e.errMsg || ''), icon: 'none' });
    return '';
  });
}

module.exports = { buildDocx, deliver, stamp };
