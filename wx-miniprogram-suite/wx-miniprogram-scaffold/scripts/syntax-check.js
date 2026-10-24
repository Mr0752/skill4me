#!/usr/bin/env node
// tools/syntax-check.js —— 真机兼容闸门（上架前必跑）
// 检测客户端 JS 中真机编译通道【不转换】的语法：可选链?.、空值合并??、逻辑赋值 ||= &&= ??=
// 这些在模拟器/lint 不报错，但真机构建会 SyntaxError 白屏。用法：node syntax-check.js <miniprogramRoot>
const fs = require('fs')
const path = require('path')

const ROOT = process.argv[2] || 'miniprogram'
const PATTERNS = [
  { re: /\?\./, label: '可选链 ?.' },
  { re: /\?\?/, label: '空值合并 ??' },
  { re: /\|\|=/, label: '逻辑或赋值 ||=' },
  { re: /&&=/, label: '逻辑与赋值 &&=' },
  { re: /\?\?=/, label: '空值赋值 ??=' }
]
const EXT = ['.js']

let errors = 0
function walk(dir) {
  let list = []
  try { list = fs.readdirSync(dir) } catch (e) { return }
  list.forEach(function (name) {
    const p = path.join(dir, name)
    let st
    try { st = fs.statSync(p) } catch (e) { return }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'miniprogram_npm') return
      walk(p)
    } else if (EXT.includes(path.extname(p))) {
      const code = fs.readFileSync(p, 'utf8')
      PATTERNS.forEach(function (pat) {
        if (pat.re.test(code)) {
          errors++
          console.error('[真机不兼容] ' + p + ' 含 ' + pat.label)
        }
      })
    }
  })
}
walk(ROOT)
if (errors) {
  console.error('\n发现 ' + errors + ' 处真机不兼容语法，真机会白屏，请改为 ES2018 等价写法后再提交。')
  process.exit(1)
} else {
  console.log('OK: 未发现真机不兼容语法（?. ?? ||= &&= ??=）。')
}
