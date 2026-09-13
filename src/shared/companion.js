const RELATIONSHIP_STAGES = [
  { min: 0, name: "初识" },
  { min: 20, name: "熟悉" },
  { min: 60, name: "信赖" },
  { min: 140, name: "挚友" },
  { min: 300, name: "灵魂伙伴" }
];

function createCompanionState() {
  return { trust: 0, xp: 0, stage: "初识", mood: "平静", streakDays: 0, lastInteractionAt: "", facts: [], diary: [], proactiveEnabled: true };
}

function stageFor(xp) {
  return [...RELATIONSHIP_STAGES].reverse().find((item) => xp >= item.min)?.name || "初识";
}

function extractFacts(text) {
  const value = String(text || "").replace(/\s+/g, " ").slice(0, 2000);
  const patterns = [
    /我叫([^，。！？,.!?]{1,24})/g,
    /我喜欢([^，。！？,.!?]{1,40})/g,
    /我不喜欢([^，。！？,.!?]{1,40})/g,
    /我的([^，。！？,.!?]{1,16})是([^，。！？,.!?]{1,40})/g,
    /I(?:'m| am) ([^,.!?]{1,32})/gi,
    /I (?:like|love) ([^,.!?]{1,48})/gi
  ];
  const facts = [];
  for (const pattern of patterns) for (const match of value.matchAll(pattern)) facts.push(match[0].trim());
  return [...new Set(facts)].slice(0, 8);
}

function advanceCompanion(state, { userText = "", reply = "", emotion = "neutral", now = new Date() } = {}) {
  const next = { ...createCompanionState(), ...(state || {}) };
  const previousDate = next.lastInteractionAt ? new Date(next.lastInteractionAt) : null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!previousDate) next.streakDays = 1;
  else {
    const previousDay = new Date(previousDate.getFullYear(), previousDate.getMonth(), previousDate.getDate());
    const days = Math.round((today - previousDay) / 86400000);
    if (days === 1) next.streakDays += 1;
    else if (days > 1) next.streakDays = 1;
  }
  next.xp += 2;
  next.trust = Math.min(100, next.trust + 1);
  next.stage = stageFor(next.xp);
  next.mood = ({ happy: "开心", excited: "兴奋", sad: "担心", shy: "害羞", angry: "不满", curious: "好奇" })[emotion] || "平静";
  next.lastInteractionAt = now.toISOString();
  const known = new Set((next.facts || []).map((item) => item.text));
  for (const fact of extractFacts(userText)) if (!known.has(fact)) next.facts.unshift({ id: `${now.getTime()}-${next.facts.length}`, text: fact, at: now.toISOString() });
  next.facts = next.facts.slice(0, 100);
  if (reply && (next.diary.length === 0 || now.getTime() - new Date(next.diary[0].at).getTime() > 4 * 3600000)) {
    next.diary.unshift({ id: `${now.getTime()}`, at: now.toISOString(), text: `今天和你聊了“${String(userText).slice(0, 42)}”。我当时感到${next.mood}。` });
  }
  next.diary = next.diary.slice(0, 90);
  return next;
}

function memoryContext(state) {
  const value = { ...createCompanionState(), ...(state || {}) };
  const facts = value.facts.slice(0, 12).map((item) => `- ${item.text}`).join("\n") || "- 暂无";
  return `关系阶段：${value.stage}；信任：${value.trust}/100；连续陪伴：${value.streakDays}天；当前心情：${value.mood}\n已知的用户信息：\n${facts}`;
}

function proactiveGreeting(state, petName, now = new Date()) {
  const hour = now.getHours();
  const part = hour < 6 ? "这么晚还没休息" : hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 19 ? "下午好" : "晚上好";
  const streak = state?.streakDays > 1 ? `，我们已经连续见面 ${state.streakDays} 天了` : "";
  return `${part}${streak}。${petName || "我"}会安静陪着你，需要时叫我。`;
}

module.exports = { advanceCompanion, createCompanionState, extractFacts, memoryContext, proactiveGreeting, stageFor };
