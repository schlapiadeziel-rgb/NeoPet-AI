const test = require("node:test");
const assert = require("node:assert/strict");
const { advanceCompanion, createCompanionState, extractFacts, memoryContext, proactiveGreeting, stageFor } = require("../src/shared/companion");

test("relationship stages grow predictably", () => {
  assert.equal(stageFor(0), "初识");
  assert.equal(stageFor(60), "信赖");
  assert.equal(stageFor(300), "灵魂伙伴");
});

test("facts, streak, mood and diary are recorded", () => {
  const first = advanceCompanion(createCompanionState(), { userText: "我叫小明，我喜欢科幻电影", reply: "记住了", emotion: "happy", now: new Date("2026-08-23T10:00:00+08:00") });
  assert.equal(first.streakDays, 1);
  assert.equal(first.mood, "开心");
  assert.ok(first.facts.some((item) => item.text.includes("我叫小明")));
  assert.equal(first.diary.length, 1);
  const second = advanceCompanion(first, { userText: "今天继续聊", reply: "好呀", now: new Date("2026-08-24T10:00:00+08:00") });
  assert.equal(second.streakDays, 2);
  assert.equal(second.diary.length, 2);
});

test("memory context and proactive greeting use companion data", () => {
  const state = { ...createCompanionState(), trust: 8, stage: "熟悉", streakDays: 3, facts: [{ id: "1", text: "我喜欢猫", at: "2026-08-24T00:00:00Z" }] };
  assert.match(memoryContext(state), /我喜欢猫/);
  assert.match(proactiveGreeting(state, "小诺", new Date("2026-08-24T20:00:00+08:00")), /连续见面 3 天/);
  assert.deepEqual(extractFacts("普通的一句话"), []);
});
