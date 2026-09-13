const test = require("node:test");
const assert = require("node:assert/strict");
const { PRESETS, listModels } = require("../src/main/providers");

test("provider presets cover cloud and supported local runtimes", () => {
  assert.deepEqual(Object.keys(PRESETS), ["api", "ollama", "lmstudio", "llamacpp", "custom"]);
  assert.equal(PRESETS.ollama.baseUrl, "http://127.0.0.1:11434/v1");
  assert.equal(PRESETS.api.needsKey, true);
});

test("model discovery sends an optional bearer token and limits results", async (context) => {
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ data: Array.from({ length: 205 }, (_, index) => ({ id: `model-${index}` })) }) };
  };
  const models = await listModels("https://models.example/v1/", "secret");
  assert.equal(request.url, "https://models.example/v1/models");
  assert.equal(request.options.headers.Authorization, "Bearer secret");
  assert.equal(models.length, 200);
});
