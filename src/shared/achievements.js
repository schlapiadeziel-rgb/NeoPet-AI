const DEFINITIONS = [
  { id: "first_feed", icon: "🍖", name: "第一顿饭", description: "第一次喂宠物", event: "feed", threshold: 1 },
  { id: "feed_10", icon: "🥣", name: "可靠饲养员", description: "累计喂食 10 次", event: "feed", threshold: 10 },
  { id: "play_10", icon: "🎭", name: "最佳玩伴", description: "累计玩耍 10 次", event: "play", threshold: 10 },
  { id: "chat_10", icon: "💬", name: "无话不谈", description: "完成 10 次对话", event: "chat", threshold: 10 },
  { id: "chat_50", icon: "🫶", name: "默契伙伴", description: "完成 50 次对话", event: "chat", threshold: 50 },
  { id: "touch_20", icon: "💗", name: "摸摸专家", description: "摸摸宠物 20 次", event: "touch", threshold: 20 },
  { id: "settings", icon: "⚙️", name: "认真照顾", description: "打开一次设置中心", event: "settings", threshold: 1 },
  { id: "level_5", icon: "⭐", name: "茁壮成长", description: "宠物达到 5 级", event: "level", threshold: 5 },
  { id: "streak_7", icon: "🔥", name: "一周相伴", description: "连续陪伴 7 天", event: "streak", threshold: 7 }
];

function createAchievementState() { return { counters: {}, unlocked: {} }; }
function recordAchievement(state, event, value, now = new Date()) {
  const next = { ...createAchievementState(), ...(state || {}), counters: { ...(state?.counters || {}) }, unlocked: { ...(state?.unlocked || {}) } };
  next.counters[event] = value == null ? (next.counters[event] || 0) + 1 : Math.max(next.counters[event] || 0, Number(value) || 0);
  const newlyUnlocked = [];
  for (const item of DEFINITIONS) if (item.event === event && next.counters[event] >= item.threshold && !next.unlocked[item.id]) { next.unlocked[item.id] = now.toISOString(); newlyUnlocked.push(item); }
  return { state: next, newlyUnlocked };
}

module.exports = { DEFINITIONS, createAchievementState, recordAchievement };
