const fs = require("node:fs");
const path = require("node:path");
const { safeStorage } = require("electron");
const { advanceCompanion, createCompanionState } = require("../shared/companion");
const { buyItem, careAction, createCareState, refreshCare } = require("../shared/care");
const { applyEmotionEvent, createEmotionState, refreshEmotion } = require("../shared/emotion");
const { createAchievementState, recordAchievement } = require("../shared/achievements");

const DEFAULTS = {
  session: null,
  ai: {
    provider: "api",
    baseUrl: "https://api.openai.com/v1",
    model: "",
    imageModel: "",
    encryptedApiKey: ""
  },
  pet: {
    petId: "xiaonuo",
    name: "小诺",
    personality: "温暖、活泼、简洁，使用用户正在使用的语言回答。",
    avatarUrl: "",
    renderMode: "sprite",
    modelUrl: "",
    voiceName: "",
    language: "auto",
    speechRate: 1
  },
  memory: [],
  companion: createCompanionState(),
  runtime: { sttProvider: "system", ttsProvider: "system", whisperExe: "", whisperModel: "", pythonCommand: "python", wakeWordEnabled: false, wakeWord: "小诺", roamEnabled: false },
  care: createCareState(),
  emotion: createEmotionState(),
  achievements: createAchievementState(),
  productivity: { todos: [], focusMinutes: 25, reminderMinutes: 60 }
};

function normalizeBaseUrl(value) {
  const text = String(value || "").trim().replace(/\/$/, "");
  if (!text) return "";
  let url;
  try { url = new URL(text); } catch { throw new Error("API 地址格式不正确"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("API 地址只支持 HTTP 或 HTTPS");
  if (url.username || url.password) throw new Error("API 地址不能包含账号或密码");
  return url.href.replace(/\/$/, "");
}

class ConfigStore {
  constructor(userDataPath) {
    this.file = path.join(userDataPath, "neopet-state.json");
    this.data = structuredClone(DEFAULTS);
    this.load();
  }

  load() {
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, "utf8"));
      this.data = {
        ...structuredClone(DEFAULTS),
        ...saved,
        ai: { ...DEFAULTS.ai, ...saved.ai },
        pet: { ...DEFAULTS.pet, ...saved.pet },
        memory: Array.isArray(saved.memory) ? saved.memory.slice(-30) : [],
        companion: { ...createCompanionState(), ...(saved.companion || {}), facts: Array.isArray(saved.companion?.facts) ? saved.companion.facts.slice(0, 100) : [], diary: Array.isArray(saved.companion?.diary) ? saved.companion.diary.slice(0, 90) : [] },
        runtime: { ...DEFAULTS.runtime, ...(saved.runtime || {}) },
        care: refreshCare(saved.care),
        emotion: refreshEmotion(saved.emotion, saved.care),
        achievements: { ...createAchievementState(), ...(saved.achievements || {}), counters: { ...(saved.achievements?.counters || {}) }, unlocked: { ...(saved.achievements?.unlocked || {}) } },
        productivity: { ...DEFAULTS.productivity, ...(saved.productivity || {}), todos: Array.isArray(saved.productivity?.todos) ? saved.productivity.todos.slice(0, 100) : [] }
      };
    } catch {
      this.persist();
    }
  }

  persist() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), "utf8");
  }

  publicState() {
    const care = refreshCare(this.data.care);
    const emotion = refreshEmotion(this.data.emotion, care);
    return {
      session: this.data.session,
      ai: {
        provider: this.data.ai.provider,
        baseUrl: this.data.ai.baseUrl,
        model: this.data.ai.model,
        imageModel: this.data.ai.imageModel,
        hasApiKey: Boolean(this.data.ai.encryptedApiKey)
      },
      pet: this.data.pet,
      memory: this.data.memory,
      companion: this.data.companion,
      runtime: this.data.runtime,
      care,
      emotion,
      achievements: this.data.achievements,
      productivity: this.data.productivity
    };
  }

  saveConfig({ ai = {}, pet = {}, runtime = {} }) {
    const nextAi = { ...this.data.ai };
    if (typeof ai.baseUrl === "string") nextAi.baseUrl = normalizeBaseUrl(ai.baseUrl);
    if (["api", "ollama", "lmstudio", "llamacpp", "custom"].includes(ai.provider)) nextAi.provider = ai.provider;
    if (typeof ai.model === "string") nextAi.model = ai.model.trim();
    if (typeof ai.imageModel === "string") nextAi.imageModel = ai.imageModel.trim();
    if (typeof ai.apiKey === "string" && ai.apiKey.trim()) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error("系统安全存储不可用，API 密钥未保存");
      nextAi.encryptedApiKey = safeStorage.encryptString(ai.apiKey.trim()).toString("base64");
    }
    this.data.ai = nextAi;
    this.data.pet = {
      ...this.data.pet,
      ...(typeof pet.petId === "string" && /^[a-z0-9-]{1,40}$/.test(pet.petId) ? { petId: pet.petId } : {}),
      ...(typeof pet.name === "string" ? { name: pet.name.trim().slice(0, 30) || "小诺" } : {}),
      ...(typeof pet.personality === "string" ? { personality: pet.personality.trim().slice(0, 1000) } : {}),
      ...(typeof pet.avatarUrl === "string" ? { avatarUrl: pet.avatarUrl } : {}),
      ...(pet.renderMode === "sprite" || pet.renderMode === "image" || pet.renderMode === "3d" ? { renderMode: pet.renderMode } : {}),
      ...(typeof pet.modelUrl === "string" ? { modelUrl: pet.modelUrl.trim().slice(0, 4000) } : {}),
      ...(typeof pet.voiceName === "string" ? { voiceName: pet.voiceName } : {}),
      ...(typeof pet.language === "string" ? { language: pet.language } : {}),
      ...(Number.isFinite(Number(pet.speechRate)) ? { speechRate: Math.min(1.5, Math.max(0.7, Number(pet.speechRate))) } : {})
    };
    this.data.runtime = {
      ...this.data.runtime,
      ...(runtime.sttProvider === "system" || runtime.sttProvider === "whisper" ? { sttProvider: runtime.sttProvider } : {}),
      ...(runtime.ttsProvider === "system" || runtime.ttsProvider === "pyttsx3" || runtime.ttsProvider === "kokoro" ? { ttsProvider: runtime.ttsProvider } : {}),
      ...(typeof runtime.whisperExe === "string" ? { whisperExe: runtime.whisperExe.trim().slice(0, 2000) } : {}),
      ...(typeof runtime.whisperModel === "string" ? { whisperModel: runtime.whisperModel.trim().slice(0, 2000) } : {}),
      ...(typeof runtime.pythonCommand === "string" ? { pythonCommand: runtime.pythonCommand.trim().slice(0, 200) || "python" } : {})
      ,...(typeof runtime.wakeWordEnabled === "boolean" ? { wakeWordEnabled: runtime.wakeWordEnabled } : {})
      ,...(typeof runtime.wakeWord === "string" ? { wakeWord: runtime.wakeWord.trim().slice(0, 20) || "小诺" } : {})
      ,...(typeof runtime.roamEnabled === "boolean" ? { roamEnabled: runtime.roamEnabled } : {})
    };
    this.persist();
    return this.publicState();
  }

  apiKey() {
    if (!this.data.ai.encryptedApiKey || !safeStorage.isEncryptionAvailable()) return "";
    try {
      return safeStorage.decryptString(Buffer.from(this.data.ai.encryptedApiKey, "base64"));
    } catch {
      return "";
    }
  }

  setSession(email) {
    this.data.session = email ? { email, verifiedAt: new Date().toISOString() } : null;
    this.persist();
    return this.data.session;
  }

  setAvatar(avatarUrl) {
    this.data.pet.avatarUrl = avatarUrl;
    this.persist();
    return this.data.pet;
  }

  addMemory(role, content) {
    this.data.memory.push({ role, content: String(content).slice(0, 4000), at: new Date().toISOString() });
    this.data.memory = this.data.memory.slice(-30);
    this.persist();
  }

  clearMemory() {
    this.data.memory = [];
    this.persist();
  }

  recordInteraction(value) {
    this.data.companion = advanceCompanion(this.data.companion, value);
    this.data.emotion = applyEmotionEvent(this.data.emotion, "chat", this.data.care);
    this.applyAchievement("chat");
    this.applyAchievement("streak", this.data.companion.streakDays);
    this.persist();
    return this.publicState();
  }

  forgetFact(id) {
    this.data.companion.facts = this.data.companion.facts.filter((item) => item.id !== id);
    this.persist();
    return this.publicState();
  }

  setProactiveEnabled(enabled) {
    this.data.companion.proactiveEnabled = Boolean(enabled);
    this.persist();
    return this.publicState();
  }

  clearCompanion() {
    this.data.memory = [];
    this.data.companion = createCompanionState();
    this.persist();
    return this.publicState();
  }

  careAction(action) { this.data.care = careAction(this.data.care, action); this.data.emotion = applyEmotionEvent(this.data.emotion, action, this.data.care); this.applyAchievement(action); this.applyAchievement("level", this.data.care.level); this.persist(); return this.publicState(); }
  buyCareItem(item) { this.data.care = buyItem(this.data.care, item); this.persist(); return this.publicState(); }
  addTodo(text) { const value=String(text||"").trim().slice(0,200); if(!value) throw new Error("请输入待办内容"); this.data.productivity.todos.unshift({id:`${Date.now()}`,text:value,done:false,at:new Date().toISOString()}); this.data.productivity.todos=this.data.productivity.todos.slice(0,100); this.persist(); return this.publicState(); }
  toggleTodo(id) { const item=this.data.productivity.todos.find((todo)=>todo.id===id); if(item)item.done=!item.done; this.persist(); return this.publicState(); }
  deleteTodo(id) { this.data.productivity.todos=this.data.productivity.todos.filter((todo)=>todo.id!==id); this.persist(); return this.publicState(); }
  applyAchievement(event, value) { const result = recordAchievement(this.data.achievements, event, value); this.data.achievements = result.state; return result.newlyUnlocked; }
  recordAchievement(event, value) { const allowed = new Set(["feed", "play", "chat", "touch", "settings", "level", "streak"]); if (!allowed.has(event)) return { state: this.publicState(), newlyUnlocked: [] }; const newlyUnlocked = this.applyAchievement(event, value); this.persist(); return { state: this.publicState(), newlyUnlocked }; }

  exportData() {
    return { schemaVersion: 2, exportedAt: new Date().toISOString(), pet: this.data.pet, ai: { provider: this.data.ai.provider, baseUrl: this.data.ai.baseUrl, model: this.data.ai.model, imageModel: this.data.ai.imageModel }, memory: this.data.memory, companion: this.data.companion, care: this.data.care, emotion: this.data.emotion, achievements: this.data.achievements, productivity: this.data.productivity };
  }

  importData(value) {
    if (!value || ![1, 2].includes(value.schemaVersion)) throw new Error("不支持的备份格式");
    if (Array.isArray(value.memory)) this.data.memory = value.memory.slice(-30);
    if (value.companion && typeof value.companion === "object") this.data.companion = { ...createCompanionState(), ...value.companion, facts: Array.isArray(value.companion.facts) ? value.companion.facts.slice(0, 100) : [], diary: Array.isArray(value.companion.diary) ? value.companion.diary.slice(0, 90) : [] };
    if (value.schemaVersion === 2) {
      if (value.care && typeof value.care === "object") this.data.care = refreshCare(value.care);
      if (value.emotion && typeof value.emotion === "object") this.data.emotion = refreshEmotion(value.emotion, this.data.care);
      if (value.achievements && typeof value.achievements === "object") this.data.achievements = { ...createAchievementState(), ...value.achievements, counters: { ...(value.achievements.counters || {}) }, unlocked: { ...(value.achievements.unlocked || {}) } };
      if (value.productivity && typeof value.productivity === "object") this.data.productivity = { ...DEFAULTS.productivity, ...value.productivity, todos: Array.isArray(value.productivity.todos) ? value.productivity.todos.slice(0, 100) : [] };
      if (value.ai && typeof value.ai === "object") this.saveConfig({ ai: value.ai });
    }
    this.persist();
    return this.publicState();
  }
}

module.exports = { ConfigStore, normalizeBaseUrl };
