const test = require("node:test");
const assert = require("node:assert/strict");
const { parseAssistantEnvelope } = require("../src/shared/response");

test("parses a valid action envelope", () => {
  assert.deepEqual(
    parseAssistantEnvelope('{"reply":"你好","emotion":"happy","action":"wave"}'),
    { reply: "你好", emotion: "happy", action: "wave" }
  );
});

test("removes markdown fences", () => {
  assert.equal(parseAssistantEnvelope('```json\n{"reply":"收到","emotion":"neutral","action":"nod"}\n```').action, "nod");
});

test("falls back to a safe action for plain text", () => {
  const value = parseAssistantEnvelope("太好了，我很开心！");
  assert.equal(value.reply, "太好了，我很开心！");
  assert.equal(value.emotion, "happy");
});
