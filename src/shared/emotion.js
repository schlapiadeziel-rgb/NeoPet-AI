const clamp = (value) => Math.max(-1, Math.min(1, Number(value) || 0));

function createEmotionState(now = new Date()) {
  return { valence: 0.35, arousal: 0.05, mood: "平静", intensity: 0.35, lastUpdatedAt: now.toISOString() };
}

function moodFromAxes(valence, arousal, care = {}) {
  if ((care.hunger ?? 100) < 24) return "饥饿";
  if ((care.energy ?? 100) < 22) return "困倦";
  if (valence > 0.58 && arousal > 0.38) return "兴奋";
  if (valence > 0.48 && arousal <= 0.38) return "开心";
  if (valence < -0.32 && arousal > 0.25) return "烦躁";
  if (valence < -0.18) return "低落";
  if (arousal < -0.42) return "困倦";
  if (arousal > 0.42) return "好奇";
  return "平静";
}

function refreshEmotion(state, care = {}, now = new Date()) {
  const current = { ...createEmotionState(now), ...(state || {}) };
  const elapsedMinutes = Math.max(0, Math.min(24 * 60, (now - new Date(current.lastUpdatedAt || now)) / 60000));
  const hour = now.getHours();
  const night = hour >= 23 || hour < 6;
  const targetValence = clamp(0.18 + ((care.happiness ?? 70) - 50) / 125 + ((care.hunger ?? 70) - 50) / 220);
  const targetArousal = clamp((night ? -0.52 : 0.08) + ((care.energy ?? 70) - 50) / 105);
  const blend = Math.min(0.82, elapsedMinutes / 90);
  current.valence = clamp(current.valence + (targetValence - current.valence) * blend);
  current.arousal = clamp(current.arousal + (targetArousal - current.arousal) * blend);
  current.mood = moodFromAxes(current.valence, current.arousal, care);
  current.intensity = Math.min(1, Math.hypot(current.valence, current.arousal));
  current.lastUpdatedAt = now.toISOString();
  return current;
}

function applyEmotionEvent(state, event, care = {}, now = new Date()) {
  const next = refreshEmotion(state, care, now);
  const pushes = { feed: [0.28, 0.16], play: [0.2, 0.35], bath: [0.12, 0.04], rest: [0.12, -0.42], touch: [0.2, -0.08], chat: [0.14, 0.16], wake: [0.06, 0.38] };
  const [v, a] = pushes[event] || [0, 0];
  next.valence = clamp(next.valence + v); next.arousal = clamp(next.arousal + a);
  next.mood = moodFromAxes(next.valence, next.arousal, care); next.intensity = Math.min(1, Math.hypot(next.valence, next.arousal));
  return next;
}

module.exports = { applyEmotionEvent, createEmotionState, moodFromAxes, refreshEmotion };
