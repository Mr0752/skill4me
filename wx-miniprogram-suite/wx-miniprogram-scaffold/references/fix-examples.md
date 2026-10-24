# 修复示例（按审计报告 id 对照改）

> 每条给出「❌ 修复前 → ✅ 修复后」的最小改动对照，照抄再把变量名换成你自己的即可。
> 报告里 `[红线X-Y]` 与本文标题一一对应；通用知识见 `redlines.md`。

---

## 红线2-1 真机不兼容语法（`?.` / `??` / `||=` / `&&=` / `1_000`）

```js
// ❌ 修复前：模拟器能跑，真机基础库直接 SyntaxError 白屏
const name = this.data.user?.name;
const page = this.data.currentPage ?? 1;
this.data.total ||= 0;
const big = 1_000_000;

// ✅ 修复后：等价改写
const name = (this.data.user || {}).name;
const page = this.data.currentPage == null ? 1 : this.data.currentPage;
this.data.total = this.data.total || 0;
const big = 1000000;
```

批量改法：全项目搜 `?.`、`??`、`||=`、`&&=`，逐个替换；对象展开 `{...x}` 可放心保留。

---

## 红线9-1 navigateTo / redirectTo 跳 tabBar 页面（静默失败）

```js
// ❌ 修复前：pages/me/me 在 app.json 的 tabBar.list 里，点了没反应也不报错
wx.navigateTo({ url: '/pages/me/me' });
wx.redirectTo({ url: '/pages/me/me' });

// ✅ 修复后：tabBar 页面用 switchTab（注意：switchTab 不能带 query）
wx.switchTab({ url: '/pages/me/me' });
```

建议封装成统一入口，一次修全项目：

```js
// app.js
const TAB_PAGES = ['pages/index/index', 'pages/me/me']; // 与 app.json tabBar 保持一致
function goPage(url) {
  const path = url.replace(/^\//, '').split('?')[0];
  if (TAB_PAGES.indexOf(path) > -1) {
    const query = url.split('?')[1];
    if (query) wx.setStorageSync('__pageQuery', query); // tabBar 不能带 query，参数走 Storage
    wx.switchTab({ url: '/' + path });
  } else {
    wx.navigateTo({ url: url });
  }
}
```

---

## 红线8-3 wx:key="index"

```html
<!-- ❌ 修复前：会被当属性名（item 上没有 index 属性），等于没 key，列表更新错乱 -->
<view wx:for="{{list}}" wx:key="index">{{item.name}}</view>

<!-- ✅ 修复后：用稳定唯一字段 -->
<view wx:for="{{list}}" wx:key="id">{{item.name}}</view>
```

没有唯一字段时在 JS 里预生成 `_k`（不要写进 storage）：

```js
const list = rawList.map(function (it, idx) {
  it._k = 'sku' + idx;
  return it;
});
this.setData({ list: list });
```

---

## 红线8-1 `{{}}` 内方法调用

```html
<!-- ❌ 修复前：编译期静默失效，页面显示空白 -->
<view>{{ formatMoney(item.amount) }}</view>

<!-- ✅ 修复后：JS 预计算成字段，wxml 只绑字段 -->
<view>{{ item.amountText }}</view>
```

```js
// JS：组装列表时算好
this.setData({
  list: rawList.map(function (it) {
    it.amountText = formatMoney(it.amount);
    return it;
  })
});
```

动态事件名同理：

```html
<!-- ❌ --><view bindtap="{{item.fn}}"></view>
<!-- ✅ --><view bindtap="onMainAction" data-action="{{item.action}}"></view>
```

---

## 红线8-2 `{{}}` 内中文键

```html
<!-- ❌ 修复前：部分基础库编译报错或行为异常 -->
<view>{{counts.待派单}}</view>

<!-- ✅ 修复后：预计算成 ASCII 字段 -->
<view>{{counts.pending}}</view>
```

---

## 红线8-4 WXML 无 `<b>` 组件

```html
<!-- ❌ 修复前：WXML 不是 HTML，未知标签静默忽略，文字不加粗 -->
<b>重要</b>

<!-- ✅ 修复后 -->
<text class="b">重要</text>
```

```css
/* wxss */
.b { font-weight: 800; }
```

---

## 红线1-1 setInterval 盲轮询 + 红线10-2 定时器未清理

两个问题通常一起修：

```js
// ❌ 修复前：固定短间隔盲轮询 + 切后台不清 → 烧云配额 / 定时器堆积闪退
Page({
  onLoad() {
    setInterval(function () { pullCloud(); }, 15000);
  }
});

// ✅ 修复后：递归 setTimeout + 空闲退避 + onHide/onUnload 清理
Page({
  onLoad() { this.startSync(); },
  onShow() { this.startSync(); },            // 回前台立即恢复
  onHide() { this.stopSync(); },             // 切后台立即停
  onUnload() { this.stopSync(); },
  startSync() {
    if (this._syncing) return;
    this._syncing = true;
    var self = this, idle = 0;
    (function loop() {
      self._timer = setTimeout(loop, idle >= 10 ? 300000 : 60000); // 连续10轮无变化退避到5分钟
      var changed = pullCloud();
      idle = changed ? 0 : idle + 1;         // 本地有写入/有变更则回快节奏
    })();
  },
  stopSync() {
    this._syncing = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
});
```

额度账（为什么必须修）：`setInterval(15s)` × 24h ≈ 5760 次/天/用户，免费额度 20 万/月只够几个用户开几天。详见 `cloud-quota-pitfalls.md`。

---

## 红线10-1 整页 / 大对象 setData

```js
// ❌ 修复前：全量序列化整个数据树，大页/列表必卡
this.setData(this.data);
this.setData({
  a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10, k: 11, l: 12
});

// ✅ 修复后：只传变化的字段；列表项用路径式增量
this.setData({ 'list[3].status': 'done' });
```

---

## 红线10-3 直接赋值 this.data.xxx

```js
// ❌ 修复前：不刷视图，且下次任意 setData 会用旧数据回滚你的改动（"改了又变回"）
this.data.count = this.data.count + 1;

// ✅ 修复后
this.setData({ count: this.data.count + 1 });
```

---

## 务必3-1 手写 storage key

```js
// ❌ 修复前：与统一封装的自动前缀叠加成 xx_xx_，数据静默读写失败
wx.setStorageSync('bill_list', list);
const list = wx.getStorageSync('bill_list');

// ✅ 修复后：读写统一走项目封装（自动加前缀）
S('bill_list', list);
const list = L('bill_list', []);
```

---

## 红线4-6 两段式导航 / 页面里乱用 reLaunch

```js
// ❌ 修复前：先切中间页再二次跳，导航防抖会被刷新，出现"点了跳两次/跳不动"
wx.reLaunch({ url: '/pages/index/index' });
wx.navigateTo({ url: '/pages/middle/middle' });
wx.navigateTo({ url: '/pages/target/target' });

// ✅ 修复后：日常跳转走封装的 goPage 一步到达；仅"清缓存重启"保留原生 reLaunch
goPage('/pages/target/target');
```

---

## 「语法」审计器报 JS 语法错误

```js
// ❌ 修复前：少个括号/逗号，整个文件加载失败（真机白屏的最常见来源之一）
Page({
  onLoad() {
    this.init(;
  }
});

// ✅ 修复后：按报错行号补齐
Page({
  onLoad() {
    this.init();
  }
});
```

先看报告里的行号定位；改完复跑 `node audit-redlines.js` 直到「语法」清零。
