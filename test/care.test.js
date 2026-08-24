const test = require("node:test");
const assert = require("node:assert/strict");
const { createCareState, careAction, buyItem } = require("../src/shared/care");

test("care actions consume inventory and reward progress", () => {
  const state = { ...createCareState(), hunger: 40, inventory: { food: 1, snack: 0, soap: 0 } };
  const next = careAction(state, "feed");
  assert.equal(next.inventory.food, 0);
  assert.ok(next.hunger > 40);
  assert.ok(next.xp > state.xp);
});

test("shop purchases are bounded by coins", () => {
  assert.throws(() => buyItem({ ...createCareState(), coins: 0 }, "food"), /金币/);
  const next = buyItem({ ...createCareState(), coins: 20, inventory: { food: 0 } }, "food");
  assert.equal(next.coins, 5);
  assert.equal(next.inventory.food, 3);
});
