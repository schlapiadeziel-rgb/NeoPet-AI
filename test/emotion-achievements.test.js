const test = require("node:test");
const assert = require("node:assert/strict");
const { applyEmotionEvent, createEmotionState, refreshEmotion } = require("../src/shared/emotion");
const { createAchievementState, recordAchievement } = require("../src/shared/achievements");

test("emotion reacts to care state and interaction events", () => {
  const morning = new Date("2026-09-05T08:00:00+08:00");
  const hungry = refreshEmotion(createEmotionState(new Date(morning - 3600000)), { hunger: 10, energy: 70, happiness: 60 }, morning);
  assert.equal(hungry.mood, "饥饿");
  const played = applyEmotionEvent(hungry, "play", { hunger: 80, energy: 70, happiness: 90 }, morning);
  assert.ok(played.valence > hungry.valence);
  assert.ok(played.arousal > hungry.arousal);
});

test("achievements unlock once at their threshold", () => {
  let state = createAchievementState();
  for (let i = 0; i < 9; i++) state = recordAchievement(state, "feed").state;
  const tenth = recordAchievement(state, "feed");
  assert.deepEqual(tenth.newlyUnlocked.map((item) => item.id), ["feed_10"]);
  assert.equal(recordAchievement(tenth.state, "feed").newlyUnlocked.length, 0);
});
