---
slug: mr0752-wx-mp-cloudbase-ai-textgen
displayName: 云开发 AI 文本生成
version: 1.0.0
summary: 基于云函数 @cloudbase/node-sdk 调用混元等模型的服务器端文本生成范式。
license: MIT
name: cloudbase-ai-textgen
description: WeChat CloudBase (云开发) AI text generation from a cloud function using @cloudbase/node-sdk — init, createModel("cloudbase"), generateText/streamText with model hy3, messages array, token usage, and the enable-model-switch prerequisite. Use when a mini program needs server-side LLM text generation (draft content, summaries, document text) via CloudBase AI rather than a third-party API. Trigger on "云开发AI", "CloudBase AI", "混元", "AI生成文本", "大模型生成", or integrating an LLM into a cloud function.
---

# CloudBase AI Text Generation (云开发 AI)

## Purpose
Call a large model (e.g. 混元 hy3) from a mini-program cloud function via `@cloudbase/node-sdk`, with no separate API-key management beyond the cloud environment. Use for generating document text, summaries, drafts.

## When to use
- User wants LLM-generated text inside a cloud function (not client-side — keep prompts/keys server-side).
- "云开发AI / CloudBase AI / 混元 / AI生成文本 / 大模型".

## Prerequisites (verify with the user before coding)
- CloudBase environment exists; **model switch enabled** in console ("接入大模型" / AI 功能开关). Without it, calls fail.
- Cloud-function dependencies: `@cloudbase/node-sdk >= 3.18.3`, `@cloudbase/ai >= 2.30.0` (`npm install`).

## How to use (see assets/ai_textgen.js + references/model-api.md)
```js
const tcb = require('@cloudbase/node-sdk');
const app = tcb.init({ env: process.env.CLOUD_ENV_ID || '你的环境ID', timeout: 60000 });
exports.main = async (event) => {
  const ai = app.ai();
  const model = ai.createModel('cloudbase');
  const res = await model.generateText({
    model: 'hy3',
    messages: [{ role: 'user', content: event.prompt }]
  });
  return { text: res.text, usage: res.usage };
};
```
- `streamText({ model, messages })` returns `textStream` (async iterable) for real-time output.
- Text uses `messages[].content`; **not** a top-level `prompt` (that is for image generation).
- Set `timeout: 60000` — AI can be slow.

## Pitfalls (must tell the user)
- **Cost**: every generation costs tokens; price from CloudBase pricing docs — verify it fits the monetization math before shipping.
- **Accuracy / liability**: AI-generated professional content (e.g. acceptance records) is a DRAFT only — must carry "仅供参考，以人工复核签字为准" and never be presented as authoritative.
- **Model switch**: must be enabled in console first; a disabled switch = silent failure.
- **Server-side only**: keep model calls in the cloud function; do not put the SDK/keys on the client.
- **Quota**: check concurrency/quota limits for your plan.
