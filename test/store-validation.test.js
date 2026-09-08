const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBaseUrl } = require("../src/main/store");

test("normalizes safe API base URLs", () => {
  assert.equal(normalizeBaseUrl("https://example.com/v1/"), "https://example.com/v1");
  assert.equal(normalizeBaseUrl("http://127.0.0.1:11434/v1"), "http://127.0.0.1:11434/v1");
});

test("rejects unsafe API URL schemes and embedded credentials", () => {
  assert.throws(() => normalizeBaseUrl("file:///tmp/key"), /HTTP/);
  assert.throws(() => normalizeBaseUrl("https://user:secret@example.com/v1"), /账号或密码/);
});
