const ALLOWED_EMOTIONS = new Set(["neutral", "happy", "sad", "excited", "shy", "angry", "curious"]);
const ALLOWED_ACTIONS = new Set(["idle", "wave", "nod", "dance", "sleep", "think", "speak", "happy"]);

function inferEnvelope(text) {
  const lower = text.toLowerCase();
  let emotion = "neutral";
  let action = "speak";
  if (/[开心高兴太好了喜欢爱]|happy|great|love/.test(lower)) {
    emotion = "happy";
    action = "happy";
  } else if (/[好奇为什么怎么]|curious|wonder/.test(lower)) {
    emotion = "curious";
    action = "think";
  } else if (/[晚安睡觉休息]|good night|sleep/.test(lower)) {
    action = "sleep";
  }
  return { reply: text.trim(), emotion, action };
}

function parseAssistantEnvelope(raw) {
  const text = String(raw || "").trim();
  if (!text) return { reply: "我在这里。", emotion: "neutral", action: "idle" };
  const unfenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const firstBrace = unfenced.indexOf("{");
  const lastBrace = unfenced.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return inferEnvelope(text);
  try {
    const parsed = JSON.parse(unfenced.slice(firstBrace, lastBrace + 1));
    const reply = typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : text;
    return {
      reply,
      emotion: ALLOWED_EMOTIONS.has(parsed.emotion) ? parsed.emotion : "neutral",
      action: ALLOWED_ACTIONS.has(parsed.action) ? parsed.action : "speak"
    };
  } catch {
    return inferEnvelope(text);
  }
}

module.exports = { parseAssistantEnvelope, inferEnvelope };
