/**
 * 小程序红线自动审计器（工具型 skill 主程序，零依赖，可扫任意小程序目录）
 *
 * 用法：
 *   node audit-redlines.js                 # 审计当前目录
 *   node audit-redlines.js path/to/mini    # 审计指定目录（可多个，空格分隔）
 *
 * 退出码：1 = 发现硬性红线（必须修）；0 = 硬红线清零（建议项仍需人工复核）。
 *
 * 检测项（默认，高精度）：
 *   硬性（必修）：JS 语法错误、真机不兼容语法（可选链/空值合并/逻辑赋值/数字分隔符）、
 *                navigateTo / redirectTo 跳 tabBar 页面、wx:key="index"
 *   建议（人工复核）：setInterval 盲轮询嫌疑、手写 storage key、
 *                reLaunch 误用/两段式导航（红线4-6）、定时器未清理（红线10-2）、
 *                setData 大对象/整页（红线10-1）、直接赋值 this.data（红线10-3）
 * 加 --strict（或 -w）额外启用实验性 WXML 启发式（{{}} 方法调用/中文键、<b> 组件），易误报，仅参考。
 * 每条发现标注违反的红线 id（对应 references/redlines.md）。
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SKIP = new Set(['node_modules', '.git', 'miniprogram_npm', '.codebuddy', '.vscode']);
// 审计器自身源码里含红线样例（如 /&&=/ 这类匹配用正则字面量），自扫时跳过，避免误报
const SELF = 'audit-redlines.js';

// —— JS 真机不兼容语法（硬性）——
const RISKY = [
  { re: /\?\.(?![0-9])/, id: '红线2-1', name: '可选链 ?.', fix: 'a?.b → (a||{}).b' },
  { re: /\?\?/, id: '红线2-1', name: '空值合并 ??', fix: 'a ?? b → (a==null?b:a)' },
  { re: /\|\|=/, id: '红线2-1', name: '逻辑赋值 ||=', fix: 'a ||= b → a = a || b' },
  { re: /&&=/, id: '红线2-1', name: '逻辑赋值 &&=', fix: 'a &&= b → a = a && b' },
  { re: /(?<![\w$)\]])\d[\d_]*_\d/, id: '红线2-1', name: '数字分隔符 1_000', fix: '去掉下划线' },
];

const hard = [];
const soft = [];
function addHard(loc, id, msg, fix) { hard.push({ loc, id, msg, fix }); }
function addSoft(loc, id, msg, fix) { soft.push({ loc, id, msg, fix }); }
function lineOf(code, idx) { return code.slice(0, idx).split('\n').length; }

/** 从 code[i]（应为 '{' '[' '('）找到匹配的右括号下标（不含），用于安全截取对象/数组字面量 */
function matchBrace(code, i) {
  const open = code[i];
  const close = open === '{' ? '}' : open === '[' ? ']' : open === '(' ? ')' : null;
  if (!close) return code.length;
  let depth = 0, inStr = null, j = i;
  while (j < code.length) {
    const c = code[j];
    if (inStr) { if (c === '\\') { j += 2; continue; } if (c === inStr) inStr = null; j++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; j++; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return j; }
    j++;
  }
  return code.length;
}

/** 估算对象字面量顶层键数（嵌套不计入），非 '{' 开头返回 0 */
function countTopKeys(obj) {
  const t = obj.trim();
  if (t[0] !== '{') return 0;
  let depth = 0, inStr = null, keys = 1, i = 0;
  while (i < t.length) {
    const c = t[i];
    if (inStr) { if (c === '\\') { i += 2; continue; } if (c === inStr) inStr = null; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; i++; continue; }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
    else if (c === ',' && depth === 0) keys++;
    i++;
  }
  return keys;
}

/** 剥离注释与字符串（保留换行，保证行号不变） */
function strip(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; }
      i += 2; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '\n' && q === '`') out += '\n';
        if (src[i] === q) { i++; break; }
        i++;
      }
      out += '""'; continue;
    }
    out += c; i++;
  }
  return out;
}

/** 只剥离注释、保留字符串内容（用于需要读 URL / storage key 字面量的规则） */
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2; out += '  ';
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += (src[i] === '\n' ? '\n' : ' '); i++; }
      i += 2; out += '  '; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out += c; i++;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        out += src[i];
        if (src[i] === q) { i++; break; }
        if (src[i] === '\n' && q !== '`') break;
        i++;
      }
      continue;
    }
    out += c; i++;
  }
  return out;
}

/** 找 app.json（用于 tabBar 交叉核查） */
function findAppJson(root) {
  const direct = path.join(root, 'app.json');
  if (fs.existsSync(direct)) return direct;
  let found = null;
  (function w(d) {
    if (found) return;
    let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of es) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { if (SKIP.has(e.name)) continue; w(f); }
      else if (e.name === 'app.json' && !found) { found = f; }
    }
  })(root);
  return found;
}

const ARGS = process.argv.slice(2);
const STRICT = ARGS.includes('--strict') || ARGS.includes('-w'); // 实验性 WXML 启发式（易误报）
if (ARGS.includes('-h') || ARGS.includes('--help')) {
  console.log([
    '小程序红线自动审计器（零依赖）',
    '',
    '用法：',
    '  node audit-redlines.js <小程序根目录...> [--strict]',
    '',
    '  <小程序根目录>  含 app.json 的目录，可传多个（如 miniprogram cloudfunctions）；不传默认当前目录',
    '  --strict / -w   额外启用实验性 WXML 启发式（{{}} 方法调用/中文键、<b> 组件），易误报，仅参考',
    '',
    '退出码：0 = 硬性红线清零；1 = 存在硬性红线（必须修）；2 = 参数/目录错误。',
  ].join('\n'));
  process.exit(0);
}
const ROOTS = ARGS.filter(a => !a.startsWith('-'));
if (ROOTS.length === 0) ROOTS.push('.');
const BAD_ROOTS = ROOTS.filter(r => !fs.existsSync(r));
if (BAD_ROOTS.length) {
  console.error('错误：目录不存在 -> ' + BAD_ROOTS.join(' , ') + '\n请传入含 app.json 的小程序根目录；用法：node audit-redlines.js --help');
  process.exit(2);
}

// 收集 tabBar 页面（规范化：去前导 /，去 query）
const tabBar = new Set();
for (const root of ROOTS) {
  const ap = findAppJson(root);
  if (!ap) continue;
  try {
    const j = JSON.parse(fs.readFileSync(ap, 'utf8'));
    const tb = j.tabBar && j.tabBar.list;
    if (tb) tb.forEach(it => { if (it.pagePath) tabBar.add(it.pagePath.replace(/^\//, '').split('?')[0]); });
  } catch (e) { /* app.json 解析失败不影响其余检查 */ }
}

let jsFiles = 0, wxmlFiles = 0, selfSkipped = 0;

function walk(dir) {
  let es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of es) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (SKIP.has(e.name)) continue; walk(full); }
    else if (e.name === SELF) { selfSkipped++; }
    else if (e.name.endsWith('.js')) {
      let src;
      try { src = fs.readFileSync(full, 'utf8'); }
      catch (err) { console.warn('（跳过无法读取的文件：' + full + ' -> ' + err.message + '）'); continue; }
      jsFiles++;
      try { new vm.Script(src, { filename: full }); }
      catch (err) { addHard(full, '语法', '语法错误 -> ' + err.message, ''); }
      const code = strip(src);        // 剥离注释+字符串：用于语法类规则
      const raw = stripComments(src); // 只剥注释、保留字符串：用于 URL / key 类规则
      for (const r of RISKY) {
        const m = r.re.exec(code);
        if (m) addHard(full + ':' + lineOf(code, m.index), r.id, r.name, r.fix);
      }
      let mm;
      const reSI = /setInterval\s*\(/g;
      while ((mm = reSI.exec(code))) addSoft(full + ':' + lineOf(code, mm.index), '红线1-1', 'setInterval 盲轮询嫌疑（需确认有无空闲退避）', '改递归 setTimeout + 无变化退避，见 references/cloud-quota-pitfalls.md');
      // 读 URL / storage key 字面量必须在保留字符串内容的源码上跑（raw），不能用剥离字符串的 code
      const reStore = /wx\.(get|set)Storage(?:Sync)?\(\s*['"]([^'"]+)['"]/g;
      while ((mm = reStore.exec(raw))) addSoft(full + ':' + lineOf(raw, mm.index), '务必3-1', '手写 storage key「' + mm[2] + '」（建议走统一封装 S/L）', '读写统一走封装方法，避免手写前缀叠加');
      const reNav = /wx\.(navigateTo|redirectTo)\(\s*\{[^}]*url\s*:\s*['"]([^'"]+)['"]/g;
      while ((mm = reNav.exec(raw))) {
        const u = mm[2].replace(/^\//, '').split('?')[0];
        if (tabBar.has(u)) addHard(full + ':' + lineOf(raw, mm.index), '红线9-1', mm[1] + ' 跳 tabBar 页面「' + u + '」（静默失败，应用 switchTab）', '改用 wx.switchTab 或封装 goPage');
      }

      // —— 新增高价值检测（建议项，人工复核）——
      // 1) reLaunch 误用 / 两段式导航（红线4-6）
      if (!/app\.js$/.test(full)) {
        const reRL = /wx\.reLaunch\s*\(/g;
        while ((mm = reRL.exec(code))) addSoft(full + ':' + lineOf(code, mm.index), '红线4-6', '页面里出现 wx.reLaunch（会刷新导航防抖；除清缓存重启用原生 reLaunch 外，日常跳转应走封装导航 goPage）', '日常跳转改走 app.goPage；仅清缓存重启保留 reLaunch');
        const reNav2 = /wx\.navigateTo\s*\(/g;
        let navCount = 0, navLast = -1;
        while ((mm = reNav2.exec(code))) { navCount++; navLast = mm.index; }
        if (navCount >= 2) addSoft(full + ':' + lineOf(code, navLast), '红线4-6', '同文件出现 ' + navCount + ' 处 navigateTo（疑似两段式导航 / 多次跳转）', '确认是否必须两段跳；能一步到达就一步，避免中间页');
      }

      // 2) 定时器未清理（红线10-2）：有 setInterval 但全文无 clearInterval => 后台持续跑，烧配额/闪退
      const hasInterval = /setInterval\s*\(/.test(code);
      const hasClearInterval = /clearInterval\s*\(/.test(code);
      if (hasInterval && !hasClearInterval) addSoft(full + ':' + lineOf(code, code.search(/setInterval\s*\(/)), '红线10-2', 'setInterval 未清理（有 setInterval 但全文无 clearInterval，页面切后台仍跑，烧云配额/闪退）', '把句柄存到 this 上，在 onHide 与 onUnload 里 clearInterval');

      // 3) setData 大对象 / 整页 setData（红线10-1）
      const reSD = /setData\s*\(/g;
      while ((mm = reSD.exec(code))) {
        let i = mm.index + mm[0].length;
        while (i < code.length && /\s/.test(code[i])) i++;
        if (code.startsWith('this.data', i)) {
          addSoft(full + ':' + lineOf(code, mm.index), '红线10-1', '整页 setData(this.data)（全量序列化，大页/列表必卡）', '只 setData 变化的字段');
        } else if (code[i] === '{') {
          const end = matchBrace(code, i);
          const keys = countTopKeys(code.slice(i, end + 1));
          if (keys >= 12) addSoft(full + ':' + lineOf(code, mm.index), '红线10-1', 'setData 首参疑似大对象（约 ' + keys + ' 个顶层键，可能整页重渲染）', '只传变化字段；列表用 setData(\'list[0].x\', v) 增量更新');
        }
      }

      // 4) 直接赋值 this.data（红线10-3）：改了数据不刷视图、下次 setData 会回滚（排除 == / === 比较）
      const reMut = /this\.data\.[\w$][\w$.]*\s*=(?!=)/g;
      while ((mm = reMut.exec(code))) addSoft(full + ':' + lineOf(code, mm.index), '红线10-3', '直接赋值 this.data.xxx（不改视图、下次 setData 会回滚）', '改用 this.setData({ xxx: val })');
    } else if (e.name.endsWith('.wxml')) {
      let code;
      try { code = fs.readFileSync(full, 'utf8'); }
      catch (err) { console.warn('（跳过无法读取的文件：' + full + ' -> ' + err.message + '）'); continue; }
      wxmlFiles++;
      let mm;
      const reKey = /wx:key\s*=\s*["']index["']/g;
      while ((mm = reKey.exec(code))) addHard(full + ':' + lineOf(code, mm.index), '红线8-3', 'wx:key="index"（列表更新错乱）', '改用唯一字段或预生成 _k');
      // 以下 WXML 启发式精度低、易误报，默认不扫；--strict 才启用，明确标注“实验性”
      if (STRICT) {
        const reCall = /\{\{[^}]*[\w$]\s*\([^}]*\)[^}]*\}\}/g;
        while ((mm = reCall.exec(code))) addSoft(full + ':' + lineOf(code, mm.index), '红线8-1', '{{}} 内疑似方法调用（实验性，可能误报）', '确认非方法调用可忽略；真调用需在 JS 预计算字段');
        const reZh = /\{\{[^}]*\.[\u4e00-\u9fa5]/g;
        while ((mm = reZh.exec(code))) addSoft(full + ':' + lineOf(code, mm.index), '红线8-2', '{{}} 内疑似中文键（实验性，部分基础库可用）', '预计算成 ASCII 字段');
        const blank = (s, re) => s.replace(re, m => ' '.repeat(m.length));
        const tagScan = blank(blank(code, /\{\{[\s\S]*?\}\}/g), /nodes\s*=\s*(["'])[\s\S]*?\1/g);
        const reB = /<b\b[^>]*>/g;
        while ((mm = reB.exec(tagScan))) addSoft(full + ':' + lineOf(tagScan, mm.index), '红线8-4', 'WXML 无 <b> 组件（实验性）', '用 <text class="b"> 加粗');
      }
    }
  }
}

ROOTS.forEach(r => walk(path.resolve(r)));

console.log('审计完成：' + jsFiles + ' 个 JS + ' + wxmlFiles + ' 个 WXML（已交叉核查 app.json 的 tabBar）\n');

if (hard.length) {
  console.log('【硬性红线 ' + hard.length + ' 条 · 必须修】');
  hard.forEach(h => console.log('  [' + h.id + '] ' + h.loc + '  ' + h.msg + (h.fix ? '  → ' + h.fix : '')));
}
if (soft.length) {
  console.log('\n【建议复核 ' + soft.length + ' 条 · 人工确认（可能误报）】');
  soft.forEach(s => console.log('  [' + s.id + '] ' + s.loc + '  ' + s.msg + (s.fix ? '  → ' + s.fix : '')));
}

if (!hard.length && !soft.length) console.log('未发现红线。');
if (jsFiles + wxmlFiles === 0) {
  if (selfSkipped) console.log('\n提示：目录下只有审计器自身脚本（已自动跳过），没有扫到小程序源码。请传入小程序源码目录（含 app.json 的那层）。');
  else console.log('\n提示：没有扫到任何 JS/WXML。请确认传入的是小程序源码目录（含 app.json 的那层），而不是构建产物目录。');
}
console.log('\n修复参考：references/redlines.md 查红线条目；references/fix-examples.md 有逐条修复前后代码对照；references/faq.md 有常见问题。');
process.exit(hard.length ? 1 : 0);
