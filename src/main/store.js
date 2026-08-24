const fs = require("node:fs");
const path = require("node:path");
const { safeStorage } = require("electron");

const DEFAULTS = {
  session: null,
  ai: {
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
  memory: []
};

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
        memory: Array.isArray(saved.memory) ? saved.memory.slice(-30) : []
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
    return {
      session: this.data.session,
      ai: {
        baseUrl: this.data.ai.baseUrl,
        model: this.data.ai.model,
        imageModel: this.data.ai.imageModel,
        hasApiKey: Boolean(this.data.ai.encryptedApiKey)
      },
      pet: this.data.pet,
      memory: this.data.memory
    };
  }

  saveConfig({ ai = {}, pet = {} }) {
    const nextAi = { ...this.data.ai };
    if (typeof ai.baseUrl === "string") nextAi.baseUrl = ai.baseUrl.trim().replace(/\/$/, "");
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
}

module.exports = { ConfigStore };
