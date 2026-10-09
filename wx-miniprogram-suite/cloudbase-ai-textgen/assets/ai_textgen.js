// 云开发 AI 文本生成云函数模板（@cloudbase/node-sdk）
// 依赖：npm install @cloudbase/node-sdk@>=3.18.3 @cloudbase/ai@>=2.30.0
// 前置：控制台启用「模型开关 / 接入大模型」
// 调用：cloud.callFunction({ name:'aiText', data:{ prompt, history?, mode? } })
const tcb = require('@cloudbase/node-sdk');
const app = tcb.init({
  env: process.env.CLOUD_ENV_ID || '你的环境ID',
  timeout: 60000 // AI 生成可能耗时较长
});

// 非流式：生成一段文本
async function generate(prompt, history) {
  const ai = app.ai();
  const model = ai.createModel('cloudbase');
  const messages = (history && history.length ? history : [])
    .concat([{ role: 'user', content: prompt }]);
  const res = await model.generateText({ model: 'hy3', messages });
  return { text: res.text || '', usage: res.usage || null };
}

// 流式：逐段返回（用于实时显示）
async function stream(prompt) {
  const ai = app.ai();
  const model = ai.createModel('cloudbase');
  const res = await model.streamText({
    model: 'hy3',
    messages: [{ role: 'user', content: prompt }]
  });
  let full = '';
  for await (const piece of res.textStream) { full += piece; /* 此处可推送到端上 */ }
  const usage = await res.usage;
  return { text: full, usage };
}

exports.main = async (event) => {
  try {
    const mode = event && event.mode;
    if (mode === 'stream') return { ok: true, ...(await stream(event.prompt)) };
    return { ok: true, ...(await generate(event.prompt, event.history)) };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'AI 调用失败' };
  }
};
