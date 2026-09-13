const test = require("node:test");
const assert = require("node:assert/strict");
const ai = require("../src/main/ai");

test("local OpenAI-compatible endpoint works without an API key", async () => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: '{"reply":"你好","emotion":"happy","action":"wave"}' } }] }) };
  };
  try {
    const result = await ai.chat({ config: { baseUrl: "http://127.0.0.1:11434/v1", model: "qwen2.5:3b" }, apiKey: "", pet: { name: "小诺", personality: "友好" }, companion: { trust: 5, stage: "熟悉", facts: [{ text: "我喜欢猫" }] }, messages: [{ role: "user", content: "你好" }] });
    assert.equal(request.url, "http://127.0.0.1:11434/v1/chat/completions");
    assert.equal(request.options.headers.Authorization, undefined);
    assert.equal(result.reply, "你好");
    assert.equal(result.action, "wave");
    assert.match(JSON.parse(request.options.body).messages[0].content, /我喜欢猫/);
  } finally {
    global.fetch = originalFetch;
  }
});
