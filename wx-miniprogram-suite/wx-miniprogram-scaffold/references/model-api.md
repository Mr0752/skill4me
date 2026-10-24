# 云开发 AI 文本生成 API（官方，@cloudbase/node-sdk）
来源：docs.cloudbase.net/ai/model/nodejs-access

## 依赖与前置
- 已创建云开发环境（旧套餐可升级）。
- 控制台**启用模型开关**（接入大模型 / AI 功能）。未启用会调用失败。
- 云函数依赖：`@cloudbase/node-sdk >= 3.18.3`，`@cloudbase/ai >= 2.30.0`。

## 初始化（云函数内）
```js
const tcb = require('@cloudbase/node-sdk');
const app = tcb.init({ env: '环境ID', timeout: 60000 });
// 独立 Node 服务需额外 secretId / secretKey
```

## 模型对象
```js
const ai = app.ai();
const model = ai.createModel('cloudbase'); // 文本生成统一入口
```

## 非流式 generateText
```js
const res = await model.generateText({ model: 'hy3', messages: [{ role:'user', content:'...' }] });
```
返回：`{ text, messages, usage, rawResponses, error }`
- 文本经 `messages[].content` 传，**不是**顶层 `prompt`（`prompt` 是图片生成参数）。
- `usage` = Token 用量。

## 流式 streamText
```js
const res = await model.streamText({ model:'hy3', messages });
for await (const piece of res.textStream) { /* 增量文本 */ }
const usage = await res.usage;
```
返回：`{ textStream (async iterable<string>), dataStream, messages(Promise), usage(Promise) }`

## 计费
本页未给具体价格；以 CloudBase 官方价格文档为准。上线前需核算单次生成成本与变现定价是否匹配。
