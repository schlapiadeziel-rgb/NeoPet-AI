function createCareState(now = new Date()) {
  return { hunger: 82, energy: 86, happiness: 88, cleanliness: 90, level: 1, xp: 0, coins: 120, inventory: { food: 3, snack: 1, soap: 2 }, lastUpdatedAt: now.toISOString() };
}

function refreshCare(state, now = new Date()) {
  const next = { ...createCareState(now), ...(state || {}), inventory: { ...createCareState(now).inventory, ...(state?.inventory || {}) } };
  const elapsedHours = Math.max(0, Math.min(72, (now - new Date(next.lastUpdatedAt || now)) / 3600000));
  next.hunger = Math.max(0, next.hunger - elapsedHours * 2.2);
  next.energy = Math.max(0, next.energy - elapsedHours * 1.4);
  next.happiness = Math.max(0, next.happiness - elapsedHours * 0.8);
  next.cleanliness = Math.max(0, next.cleanliness - elapsedHours * 1.1);
  next.lastUpdatedAt = now.toISOString();
  return next;
}

function careAction(state, action, now = new Date()) {
  const next = refreshCare(state, now);
  const reward = () => { next.xp += 8; next.coins += 2; while (next.xp >= next.level * 60) { next.xp -= next.level * 60; next.level += 1; next.coins += 30; } };
  if (action === "feed") { if (next.inventory.food < 1) throw new Error("食物不够，请先去商店购买"); next.inventory.food -= 1; next.hunger = Math.min(100, next.hunger + 28); next.happiness = Math.min(100, next.happiness + 5); reward(); }
  else if (action === "play") { next.happiness = Math.min(100, next.happiness + 20); next.energy = Math.max(0, next.energy - 8); reward(); }
  else if (action === "bath") { if (next.inventory.soap < 1) throw new Error("清洁用品不够，请先购买"); next.inventory.soap -= 1; next.cleanliness = 100; next.happiness = Math.min(100, next.happiness + 3); reward(); }
  else if (action === "rest") { next.energy = Math.min(100, next.energy + 35); next.hunger = Math.max(0, next.hunger - 4); reward(); }
  else throw new Error("未知养成动作");
  return next;
}

const SHOP = { food: { price: 15, amount: 3 }, snack: { price: 12, amount: 2 }, soap: { price: 10, amount: 2 } };
function buyItem(state, item, now = new Date()) {
  const next = refreshCare(state, now); const offer = SHOP[item]; if (!offer) throw new Error("商品不存在"); if (next.coins < offer.price) throw new Error("金币不够"); next.coins -= offer.price; next.inventory[item] = (next.inventory[item] || 0) + offer.amount; return next;
}

module.exports = { SHOP, buyItem, careAction, createCareState, refreshCare };
