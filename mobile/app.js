const $ = (selector) => document.querySelector(selector);
function readLocalJson(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key) || "null"); return value && typeof value === "object" ? value : fallback; }
  catch { localStorage.removeItem(key); return fallback; }
}
function normalizeBaseUrl(value) {
  const text = String(value || "").trim().replace(/\/$/, "");
  if (!text) return "";
  let url; try { url = new URL(text); } catch { throw new Error("API 地址格式不正确"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("API 地址不安全");
  return url.href.replace(/\/$/, "");
}
const ui = {
  stage: $("#petStage"),
  bubble: $("#speechBubble"),
  state: $("#stateLabel"),
  homeStage: $("#mobileHomeStage"), homeMood: $("#mobileHomeMood"), homeMemories: $("#mobileHomeMemories"), chatPetName: $("#mobileChatPetName"),
  careLevel: $("#mobileCareLevel"), careCoins: $("#mobileCareCoins"), careHunger: $("#mobileCareHunger"), careEnergy: $("#mobileCareEnergy"), careHappiness: $("#mobileCareHappiness"), careCleanliness: $("#mobileCareCleanliness"), foodCount: $("#mobileFoodCount"), snackCount: $("#mobileSnackCount"), soapCount: $("#mobileSoapCount"),
  pet: $("#defaultPet"),
  custom: $("#customPet"),
  petModel: $("#petModel"),
  messages: $("#messages"),
  form: $("#chatForm"),
  input: $("#messageInput"),
  mic: $("#micButton"),
  touch: $("#touchButton"),
  wave: $("#waveButton"),
  settings: $("#settingsButton"),
  dialog: $("#settingsDialog"),
  install: $("#installButton"),
  overlay: $("#overlayButton"),
  petPicker: $("#petPicker"),
  name: $("#petName"),
  nameInput: $("#nameInput"),
  personality: $("#personalityInput"),
  baseUrl: $("#baseUrlInput"),
  model: $("#modelInput"),
  apiKey: $("#apiKeyInput"),
  language: $("#languageInput"),
  avatar: $("#avatarInput"),
  modelUrl: $("#modelUrlInput"),
  modelFile: $("#modelFileInput"),
  save: $("#saveSettingsButton"),
  restore: $("#restorePetButton"),
  relationshipStage: $("#mobileRelationshipStage"), relationshipStats: $("#mobileRelationshipStats"), bondProgress: $("#mobileBondProgress"),
  proactive: $("#mobileProactiveEnabled"), facts: $("#mobileMemoryFacts"), diary: $("#mobileCompanionDiary"), exportData: $("#mobileExportButton"), importData: $("#mobileImportInput"), clearCompanion: $("#mobileClearCompanion"),
  todoInput: $("#mobileTodoInput"), todoAdd: $("#mobileTodoAdd"), todoList: $("#mobileTodoList"), focusMinutes: $("#mobileFocusMinutes"), focus: $("#mobileFocusButton"), focusStatus: $("#mobileFocusStatus"), weatherCity: $("#mobileWeatherCity"), weather: $("#mobileWeatherButton"), weatherResult: $("#mobileWeatherResult"),
  updateStatus: $("#mobileUpdateStatus"), checkUpdate: $("#mobileCheckUpdate"), openUpdate: $("#mobileOpenUpdate"),
  status: $("#settingsStatus"),
};
const defaults = {
  petId: "xiaonuo",
  name: "小诺",
  personality: "温柔、机灵、简洁，会根据回答选择自然动作。",
  baseUrl: "https://api.openai.com/v1",
  model: "",
  language: "auto",
  avatar: "",
  renderMode: "sprite",
  modelUrl: "",
};
let config = {
  ...defaults,
  ...readLocalJson("neopet-mobile-config", {}),
};
const companionDefaults = { trust: 0, xp: 0, stage: "初识", mood: "平静", streakDays: 0, lastInteractionAt: "", facts: [], diary: [], proactiveEnabled: true };
let companion = { ...companionDefaults, ...readLocalJson("neopet-mobile-companion", {}) };
const careDefaults = { hunger: 82, energy: 86, happiness: 88, cleanliness: 90, level: 1, xp: 0, coins: 120, inventory: { food: 3, snack: 1, soap: 2 } };
let care = { ...careDefaults, ...readLocalJson("neopet-mobile-care", {}) }; care.inventory = { ...careDefaults.inventory, ...(care.inventory || {}) };
let conversation = [];
let recognition;
let idleTimer;
let idleMotionTimer;
let installPrompt;
let spriteTimer;
let lookResetTimer;
let currentPetState = "idle";
let localModelObjectUrl = "";
const APP_VERSION = "0.6.3";
let latestReleaseUrl = "";
let mobileFocusTimer;
let todos = readLocalJson("neopet-mobile-todos", []); if (!Array.isArray(todos)) todos = [];
function renderTodos(){ui.todoList.replaceChildren(...todos.map((todo,index)=>{const row=document.createElement("div");row.className=`todo-row${todo.done?" done":""}`;const check=document.createElement("input");check.type="checkbox";check.checked=todo.done;const span=document.createElement("span");span.textContent=todo.text;const del=document.createElement("button");del.type="button";del.textContent="删除";del.className="text-button";check.onchange=()=>{todo.done=check.checked;localStorage.setItem("neopet-mobile-todos",JSON.stringify(todos));renderTodos()};del.onclick=()=>{todos.splice(index,1);localStorage.setItem("neopet-mobile-todos",JSON.stringify(todos));renderTodos()};row.append(check,span,del);return row}))}

function saveCompanion() { localStorage.setItem("neopet-mobile-companion", JSON.stringify(companion)); }
function saveCare() { localStorage.setItem("neopet-mobile-care", JSON.stringify(care)); }
function renderCare() { ui.careLevel.textContent=care.level; ui.careCoins.textContent=care.coins; [[ui.careHunger,care.hunger],[ui.careEnergy,care.energy],[ui.careHappiness,care.happiness],[ui.careCleanliness,care.cleanliness]].forEach(([el,value])=>el.style.width=`${value}%`); ui.foodCount.textContent=care.inventory.food; ui.snackCount.textContent=care.inventory.snack; ui.soapCount.textContent=care.inventory.soap; }
function performCare(action) { if(action==="feed"){if(!care.inventory.food)return showBubble("食物不够，请先购买。",2500);care.inventory.food--;care.hunger=Math.min(100,care.hunger+28)} if(action==="rest")care.energy=Math.min(100,care.energy+35); if(action==="play"){care.happiness=Math.min(100,care.happiness+20);care.energy=Math.max(0,care.energy-8)} if(action==="bath"){if(!care.inventory.soap)return showBubble("清洁用品不够。",2500);care.inventory.soap--;care.cleanliness=100} care.xp+=8;care.coins+=2;if(care.xp>=care.level*60){care.xp=0;care.level++;care.coins+=30}saveCare();renderCare();setState(action==="rest"?"sleep":"happy","happy");showBubble({feed:"好吃！",rest:"我休息一会儿。",play:"一起玩真开心！",bath:"干干净净啦！"}[action],2200); }
function relationshipStage(xp) { return xp >= 500 ? "灵魂伙伴" : xp >= 250 ? "挚友" : xp >= 100 ? "亲密" : xp >= 30 ? "熟悉" : "初识"; }
function extractFacts(text) {
  const patterns = [/(?:我叫|叫我|my name is)\s*([^，。,.!?！?\n]{1,24})/i, /(?:我喜欢|我爱|i like|i love)\s*([^，。,.!?！?\n]{1,40})/i, /(?:我不喜欢|我讨厌|i dislike|i hate)\s*([^，。,.!?！?\n]{1,40})/i, /(?:我住在|我来自|i live in|i am from)\s*([^，。,.!?！?\n]{1,32})/i];
  return patterns.map((pattern) => text.match(pattern)?.[0]?.trim()).filter(Boolean);
}
function advanceCompanion(userText, reply, emotion) {
  const now = new Date();
  const previous = companion.lastInteractionAt ? new Date(companion.lastInteractionAt) : null;
  const day = 86400000;
  if (!previous) companion.streakDays = 1;
  else { const gap = Math.floor((new Date(now.toDateString()) - new Date(previous.toDateString())) / day); companion.streakDays = gap === 1 ? companion.streakDays + 1 : gap > 1 ? 1 : Math.max(1, companion.streakDays); }
  companion.xp += 10; companion.trust = Math.min(100, companion.trust + 2); companion.stage = relationshipStage(companion.xp); companion.mood = emotion === "sad" ? "担心" : emotion === "happy" ? "开心" : emotion === "excited" ? "兴奋" : "平静";
  for (const fact of extractFacts(userText)) if (!companion.facts.some((item) => item.text === fact)) companion.facts.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, text: fact, at: now.toISOString() });
  companion.facts = companion.facts.slice(-100);
  if (!previous || now - previous >= 4 * 60 * 60 * 1000) companion.diary.push({ at: now.toISOString(), text: `今天我们聊到：“${userText.slice(0, 48)}”。${config.name}回答：“${reply.slice(0, 56)}”` });
  companion.diary = companion.diary.slice(-90); companion.lastInteractionAt = now.toISOString(); saveCompanion(); renderCompanion();
}
function memoryContext() { return companion.facts.length ? `你长期记得用户这些信息：${companion.facts.slice(-12).map((item) => item.text).join("；")}。当前关系：${companion.stage}，信任${companion.trust}。` : `当前关系：${companion.stage}，信任${companion.trust}。`; }
function renderCompanion() {
  ui.homeStage.textContent = companion.stage; ui.homeMood.textContent = companion.mood; ui.homeMemories.textContent = `${companion.facts.length} 条记忆`;
  ui.relationshipStage.textContent = companion.stage; ui.relationshipStats.textContent = `信任 ${companion.trust} · 连续 ${companion.streakDays} 天 · ${companion.mood}`; ui.bondProgress.style.width = `${Math.min(100, companion.xp % 100)}%`; ui.proactive.checked = companion.proactiveEnabled !== false;
  ui.facts.replaceChildren(...(companion.facts.length ? companion.facts.slice().reverse().map((fact) => { const row = document.createElement("div"); row.className = "memory-row"; const span = document.createElement("span"); span.textContent = fact.text; const button = document.createElement("button"); button.type = "button"; button.textContent = "忘记"; button.onclick = () => { companion.facts = companion.facts.filter((item) => item.id !== fact.id); saveCompanion(); renderCompanion(); }; row.append(span, button); return row; }) : [Object.assign(document.createElement("p"), { className: "hint", textContent: "还没有长期记忆" })]));
  ui.diary.replaceChildren(...(companion.diary.length ? companion.diary.slice(-5).reverse().map((entry) => Object.assign(document.createElement("div"), { className: "diary-row", textContent: `${new Date(entry.at).toLocaleDateString()} · ${entry.text}` })) : [Object.assign(document.createElement("p"), { className: "hint", textContent: "日记会随着相处逐渐出现" })]));
}

const PETS = [
  { id: "xiaonuo", name: "小诺", description: "温暖机敏的像素机器人", personality: "温柔、机灵、简洁，会根据回答选择自然动作。", pixelated: true },
  { id: "yuntuan", name: "云团", description: "柔软治愈的3D云朵猫", personality: "温柔、治愈、好奇，善于安慰和倾听，回答自然亲切。" },
  { id: "yueli", name: "月狸", description: "月光森林里的灵狐伙伴", personality: "安静、灵动、可靠，带一点神秘感，会耐心陪伴并给出清晰回答。" },
];

function petById(id) {
  return PETS.find((pet) => pet.id === id) || PETS[0];
}

function applyBuiltInPet(id) {
  const pet = petById(id);
  ui.pet.style.backgroundImage = `url("assets/pets/${pet.id}/spritesheet.webp")`;
  ui.pet.classList.toggle("smooth-sprite", !pet.pixelated);
  ui.pet.setAttribute("aria-label", `触摸桌面宠物${pet.name}`);
  try { window.NeoPetAndroid?.selectPet?.(pet.id); } catch { }
}

function applyVisualMode(modelSource = "") {
  const source = modelSource || config.modelUrl || "";
  const hasModel = Boolean(source) && config.renderMode === "3d";
  const hasImage = Boolean(config.avatar) && !hasModel;
  ui.petModel.classList.toggle("hidden", !hasModel);
  ui.custom.classList.toggle("hidden", !hasImage);
  ui.pet.classList.toggle("hidden", hasModel || hasImage);
  if (hasModel) ui.petModel.src = source;
  if (hasImage) ui.custom.src = config.avatar;
}

function renderPetPicker() {
  ui.petPicker.replaceChildren(...PETS.map((pet) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pet-choice${pet.id === config.petId ? " selected" : ""}`;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(pet.id === config.petId));
    button.innerHTML = `<span class="pet-choice-preview${pet.pixelated ? " pixelated" : ""}"></span><strong>${pet.name}</strong><small>${pet.description}</small>`;
    button.querySelector(".pet-choice-preview").style.backgroundImage = `url("assets/pets/${pet.id}/spritesheet.webp")`;
    button.addEventListener("click", () => {
      config = { ...config, petId: pet.id, name: pet.name, personality: pet.personality, avatar: "", modelUrl: "", renderMode: "sprite" };
      localStorage.setItem("neopet-mobile-config", JSON.stringify(config));
      applyConfig();
      ui.status.textContent = `已选择${pet.name}`;
    });
    return button;
  }));
}

function renderOverlayState(state = {}) {
  if (!ui.overlay || !state.available) return;
  ui.overlay.classList.remove("hidden");
  ui.overlay.textContent = state.running ? "关闭悬浮" : state.granted ? "开启悬浮" : "悬浮授权";
  ui.overlay.dataset.running = state.running ? "true" : "false";
}

function setupAndroidOverlay() {
  const bridge = window.NeoPetAndroid;
  if (!bridge) return;
  try {
    renderOverlayState({
      available: bridge.isOverlayAvailable(),
      granted: bridge.isOverlayGranted(),
      running: bridge.isOverlayRunning(),
    });
  } catch {
    ui.overlay.classList.add("hidden");
  }
}

const spriteStates = {
  idle: { row: 0, frames: 6, interval: 480 },
  wave: { row: 3, frames: 4, interval: 170 },
  happy: { row: 4, frames: 5, interval: 135 },
  dance: { row: 4, frames: 5, interval: 115 },
  failed: { row: 5, frames: 8, interval: 180 },
  sleep: { row: 5, frames: 8, interval: 310 },
  listening: { row: 6, frames: 6, interval: 235 },
  thinking: { row: 7, frames: 6, interval: 145 },
  nod: { row: 7, frames: 6, interval: 170 },
  speaking: { row: 8, frames: 6, interval: 125 },
};

const stateLabels = {
  idle: "空闲",
  listening: "正在听",
  thinking: "正在思考",
  speaking: "正在回答",
  wave: "向你挥手",
  happy: "开心",
  nod: "点头",
  dance: "跳舞",
  sleep: "睡觉",
  failed: "需要帮助",
};

function showSpriteFrame(row, column) {
  ui.pet.style.backgroundPosition = `${(column / 7) * 100}% ${(row / 10) * 100}%`;
}
function animateSprite(state) {
  clearInterval(spriteTimer);
  const animation = spriteStates[state] || spriteStates.idle;
  let frame = 0;
  showSpriteFrame(animation.row, frame);
  spriteTimer = setInterval(() => {
    frame = (frame + 1) % animation.frames;
    showSpriteFrame(animation.row, frame);
  }, animation.interval);
}

function setState(action = "idle", emotion = "neutral", label = "") {
  [...ui.stage.classList]
    .filter((name) => name.startsWith("state-"))
    .forEach((name) => ui.stage.classList.remove(name));
  const normalized = [
    "idle",
    "listening",
    "thinking",
    "speaking",
    "wave",
    "happy",
    "nod",
    "dance",
    "sleep",
    "failed",
  ].includes(action)
    ? action
    : "idle";
  ui.stage.classList.add(`state-${normalized}`);
  currentPetState = normalized;
  ui.stage.dataset.emotion = emotion;
  ui.state.textContent = label || stateLabels[normalized] || "陪伴中";
  animateSprite(normalized);
  if (!ui.petModel.classList.contains("hidden")) {
    const names = ui.petModel.availableAnimations || [];
    const token = normalized === "speaking" ? "talk" : normalized;
    const match = names.find((item) => item.toLowerCase().includes(token)) || names[0];
    if (match) { ui.petModel.animationName = match; ui.petModel.play?.(); }
  }
}
function showBubble(text, duration = 0) {
  ui.bubble.textContent = text;
  ui.bubble.classList.remove("hidden");
  if (duration) setTimeout(() => ui.bubble.classList.add("hidden"), duration);
}
function scheduleIdle() {
  clearTimeout(idleTimer);
  clearTimeout(idleMotionTimer);
  const startedAt = Date.now();
  const idleMotions = [
    { action: "wave", emotion: "happy", label: "向你挥手" },
    { action: "nod", emotion: "curious", label: "看看你在做什么" },
    { action: "happy", emotion: "happy", label: "心情不错" },
    { action: "dance", emotion: "excited", label: "偷偷活动一下" },
  ];
  const playIdleMotion = () => {
    if (Date.now() - startedAt >= 55_000) return;
    const motion = idleMotions[Math.floor(Math.random() * idleMotions.length)];
    setState(motion.action, motion.emotion, motion.label);
    setTimeout(() => setState("idle", "neutral"), motion.action === "dance" ? 3800 : 2400);
    idleMotionTimer = setTimeout(playIdleMotion, 12_000 + Math.random() * 10_000);
  };
  idleMotionTimer = setTimeout(playIdleMotion, 10_000 + Math.random() * 8_000);
  idleTimer = setTimeout(() => {
    clearTimeout(idleMotionTimer);
    setState("sleep", "neutral");
    showBubble("呼…我先眯一会儿。", 3500);
  }, 60_000);
}
function appendMessage(role, text) {
  const el = document.createElement("div");
  el.className = `message ${role === "user" ? "user-message" : "pet-message"}`;
  el.textContent = text;
  ui.messages.append(el);
  ui.messages.scrollTop = ui.messages.scrollHeight;
}
function parseEnvelope(text) {
  const clean = String(text || "")
    .replace(/^```(?:json)?\s*|\s*```$/g, "")
    .trim();
  try {
    const value = JSON.parse(clean);
    return {
      reply: String(value.reply || value.text || ""),
      action: String(value.action || "speaking"),
      emotion: String(value.emotion || "neutral"),
    };
  } catch {
    return { reply: clean, action: "speaking", emotion: "neutral" };
  }
}
function speak(reply, action, emotion) {
  speechSynthesis.cancel();
  setState(action === "speak" ? "speaking" : action, emotion);
  showBubble(reply);
  const voice = new SpeechSynthesisUtterance(reply);
  if (config.language !== "auto") voice.lang = config.language;
  voice.onend = () => {
    ui.bubble.classList.add("hidden");
    setState("idle");
    scheduleIdle();
  };
  voice.onerror = voice.onend;
  speechSynthesis.speak(voice);
}
async function sendMessage(text) {
  const content = String(text || "").trim();
  if (!content) return;
  appendMessage("user", content);
  conversation.push({ role: "user", content });
  ui.input.value = "";
  setState("thinking", "curious");
  showBubble("让我想想……");
  try {
    const apiKey = sessionStorage.getItem("neopet-api-key") || "";
    if (!config.baseUrl || !config.model)
      throw new Error("请先在设置中填写 API 地址和聊天模型");
    const system = `你是名为${config.name}的AI桌面宠物。性格：${config.personality}。${memoryContext()}回复用户使用与用户相同的语言，并只输出JSON：{"reply":"回答","emotion":"neutral|happy|sad|curious|excited","action":"speaking|wave|happy|dance|sleep"}。`;
    const response = await fetch(
      `${config.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: system },
            ...conversation.slice(-16),
          ],
          temperature: 0.8,
        }),
      },
    );
    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    const result = parseEnvelope(data.choices?.[0]?.message?.content);
    conversation.push({ role: "assistant", content: result.reply });
    appendMessage("assistant", result.reply);
    advanceCompanion(content, result.reply, result.emotion);
    speak(result.reply, result.action, result.emotion);
  } catch (error) {
    const message = `连接失败：${error.message}`;
    appendMessage("assistant", message);
    showBubble(message, 5000);
    setState("failed", "sad");
    setTimeout(() => setState("idle", "neutral"), 2600);
  }
}
function applyConfig() {
  ui.name.textContent = config.name;
  ui.chatPetName.textContent = config.name;
  ui.nameInput.value = config.name;
  ui.personality.value = config.personality;
  ui.baseUrl.value = config.baseUrl;
  ui.model.value = config.model;
  ui.language.value = config.language;
  ui.modelUrl.value = config.modelUrl || "";
  applyBuiltInPet(config.petId);
  applyVisualMode(localModelObjectUrl);
  renderPetPicker();
  renderCompanion();
  renderCare();
}
function setupRecognition() {
  const Recognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    ui.mic.textContent = "文字";
    return;
  }
  recognition = new Recognition();
  recognition.lang =
    config.language === "auto"
      ? navigator.language || "zh-CN"
      : config.language;
  recognition.interimResults = true;
  recognition.onstart = () => setState("listening", "curious");
  recognition.onresult = (event) => {
    ui.input.value = [...event.results]
      .map((item) => item[0].transcript)
      .join("");
  };
  recognition.onend = () => setState("idle");
  recognition.onerror = () => setState("idle", "sad");
}
ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(ui.input.value);
});
ui.touch.addEventListener("click", () => {
  setState("happy", "happy");
  showBubble("嘿嘿，好舒服！", 1800);
  setTimeout(() => setState("idle"), 1900);
  scheduleIdle();
});
ui.wave.addEventListener("click", () => {
  setState("wave", "happy");
  showBubble("我在这里！", 1800);
  setTimeout(() => setState("idle"), 2100);
  scheduleIdle();
});
ui.mic.addEventListener("click", () =>
  recognition ? recognition.start() : ui.input.focus(),
);
ui.pet.addEventListener("click", () => ui.touch.click());
ui.custom.addEventListener("click", () => ui.touch.click());
ui.stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch" || event.buttons || currentPetState !== "idle" || ui.pet.classList.contains("hidden")) return;
  const rect = ui.pet.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  let angle = Math.atan2(dx, -dy) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  const direction = Math.round(angle / 22.5) % 16;
  clearInterval(spriteTimer);
  showSpriteFrame(direction < 8 ? 9 : 10, direction < 8 ? direction : direction - 8);
  clearTimeout(lookResetTimer);
  lookResetTimer = setTimeout(() => animateSprite("idle"), 850);
});
ui.settings.addEventListener("click", () => ui.dialog.showModal());
ui.overlay.addEventListener("click", () => {
  const bridge = window.NeoPetAndroid;
  if (!bridge) return;
  try {
    if (bridge.isOverlayRunning()) {
      bridge.disableOverlay();
      renderOverlayState({ available: true, granted: bridge.isOverlayGranted(), running: false });
      showBubble("悬浮桌宠已关闭。", 1800);
      return;
    }
    if (!bridge.isOverlayGranted()) {
      const accepted = window.confirm("开启悬浮桌宠后，小诺会显示在其他应用上方，并通过常驻通知让你随时关闭。是否前往系统设置授权？");
      if (!accepted) return;
    }
    ui.overlay.textContent = "正在设置…";
    bridge.enableOverlay();
  } catch {
    showBubble("无法开启悬浮桌宠，请在系统设置中检查权限。", 3500);
  }
});
window.addEventListener("neopet-overlay-state", (event) => renderOverlayState(event.detail));
ui.avatar.addEventListener("change", () => {
  const file = ui.avatar.files?.[0];
  if (!file) return;
  if (file.size > 3_000_000) {
    ui.status.textContent = "图片不能超过 3MB";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    config.avatar = reader.result;
    config.modelUrl = "";
    config.renderMode = "image";
    applyConfig();
  };
  reader.readAsDataURL(file);
});
ui.modelFile.addEventListener("change", () => {
  const file = ui.modelFile.files?.[0];
  if (!file) return;
  if (file.size > 80_000_000) { ui.status.textContent = "3D 模型不能超过 80MB"; return; }
  if (localModelObjectUrl) URL.revokeObjectURL(localModelObjectUrl);
  localModelObjectUrl = URL.createObjectURL(file);
  config = { ...config, avatar: "", modelUrl: "", renderMode: "3d" };
  applyVisualMode(localModelObjectUrl);
  ui.status.textContent = "本地 3D 模型已载入";
});
ui.modelUrl.addEventListener("change", () => {
  const value = ui.modelUrl.value.trim();
  if (!value) return;
  localModelObjectUrl = "";
  config = { ...config, avatar: "", modelUrl: value, renderMode: "3d" };
  applyVisualMode();
});
ui.save.addEventListener("click", () => {
  let baseUrl; try { baseUrl = normalizeBaseUrl(ui.baseUrl.value); } catch (error) { ui.status.textContent = error.message; return; }
  config = {
    ...config,
    name: ui.nameInput.value.trim() || defaults.name,
    personality: ui.personality.value.trim() || defaults.personality,
    baseUrl,
    model: ui.model.value.trim(),
    language: ui.language.value,
    modelUrl: ui.modelUrl.value.trim(),
    renderMode: (ui.modelUrl.value.trim() || localModelObjectUrl) ? "3d" : config.renderMode,
  };
  localStorage.setItem("neopet-mobile-config", JSON.stringify(config));
  if (ui.apiKey.value)
    sessionStorage.setItem("neopet-api-key", ui.apiKey.value);
  ui.status.textContent = "设置已保存";
  applyConfig();
  setupRecognition();
  ui.dialog.close();
});
ui.restore.addEventListener("click", () => {
  config.avatar = "";
  config.modelUrl = "";
  config.renderMode = "sprite";
  localModelObjectUrl = "";
  localStorage.setItem("neopet-mobile-config", JSON.stringify(config));
  applyConfig();
  ui.dialog.close();
});
document.querySelectorAll("[data-care]").forEach((button)=>button.addEventListener("click",()=>performCare(button.dataset.care)));
document.querySelectorAll("[data-buy]").forEach((button)=>button.addEventListener("click",()=>{const offer={food:[15,3],snack:[12,2],soap:[10,2]}[button.dataset.buy];if(care.coins<offer[0]){ui.status.textContent="金币不够";return}care.coins-=offer[0];care.inventory[button.dataset.buy]+=offer[1];saveCare();renderCare();ui.status.textContent="购买成功";}));
ui.proactive.addEventListener("change", () => { companion.proactiveEnabled = ui.proactive.checked; saveCompanion(); });
ui.exportData.addEventListener("click", () => { const blob = new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), config: { ...config }, conversation, companion }, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `neopet-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); });
ui.importData.addEventListener("change", async () => { try { const value = JSON.parse(await ui.importData.files[0].text()); if (value.schemaVersion !== 1) throw new Error("格式不支持"); if (value.config) { config = { ...defaults, ...value.config }; localStorage.setItem("neopet-mobile-config", JSON.stringify(config)); } if (value.companion) { companion = { ...companionDefaults, ...value.companion }; saveCompanion(); } conversation = Array.isArray(value.conversation) ? value.conversation.slice(-30) : []; applyConfig(); ui.status.textContent = "备份已导入"; } catch (error) { ui.status.textContent = `导入失败：${error.message}`; } });
ui.clearCompanion.addEventListener("click", () => { if (!confirm("这会删除对话、长期记忆、关系等级和日记，确定继续吗？")) return; companion = { ...companionDefaults, facts: [], diary: [] }; conversation = []; saveCompanion(); ui.messages.replaceChildren(); renderCompanion(); ui.status.textContent = "陪伴数据已清除"; });
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  ui.install.classList.remove("hidden");
});
ui.install.addEventListener("click", async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = null;
  ui.install.classList.add("hidden");
});
ui.todoAdd.addEventListener("click",()=>{const text=ui.todoInput.value.trim().slice(0,100);if(!text)return;todos.unshift({text,done:false});ui.todoInput.value="";localStorage.setItem("neopet-mobile-todos",JSON.stringify(todos));renderTodos()});
ui.focus.addEventListener("click",()=>{if(mobileFocusTimer){clearInterval(mobileFocusTimer);mobileFocusTimer=null;ui.focus.textContent="开始专注";ui.focusStatus.textContent="已取消";return}const deadline=Date.now()+Math.max(1,Math.min(180,Number(ui.focusMinutes.value)||25))*60000;ui.focus.textContent="取消";const tick=()=>{const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));ui.focusStatus.textContent=`剩余 ${Math.floor(left/60)}:${String(left%60).padStart(2,"0")}`;if(left<=0){clearInterval(mobileFocusTimer);mobileFocusTimer=null;ui.focus.textContent="开始专注";ui.focusStatus.textContent="专注完成";showBubble("专注完成，活动一下吧！",5000)}};tick();mobileFocusTimer=setInterval(tick,1000)});
ui.weather.addEventListener("click",async()=>{ui.weatherResult.textContent="查询中…";try{const city=ui.weatherCity.value.trim();if(!city)throw new Error("请输入城市");const response=await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);if(!response.ok)throw new Error("天气服务暂不可用");const current=(await response.json()).current_condition?.[0];ui.weatherResult.textContent=`${city} · ${current?.weatherDesc?.[0]?.value||""} · ${current?.temp_C}°C`}catch(e){ui.weatherResult.textContent=e.message}});
ui.checkUpdate.addEventListener("click",async()=>{ui.checkUpdate.disabled=true;ui.updateStatus.textContent="正在检查更新…";try{const response=await fetch("https://api.github.com/repos/schlapiadeziel-rgb/NeoPet-AI/releases/latest",{headers:{Accept:"application/vnd.github+json"}});if(!response.ok)throw new Error(`GitHub 返回 ${response.status}`);const release=await response.json();const latest=String(release.tag_name||"").replace(/^v/,"");latestReleaseUrl=release.html_url||"https://github.com/schlapiadeziel-rgb/NeoPet-AI/releases/latest";if(latest&&latest!==APP_VERSION){ui.updateStatus.textContent=`发现新版本 ${latest}`;ui.openUpdate.classList.remove("hidden")}else{ui.updateStatus.textContent=`已是最新版本 ${APP_VERSION}`;ui.openUpdate.classList.add("hidden")}}catch(error){ui.updateStatus.textContent=`检查失败：${error.message}`}finally{ui.checkUpdate.disabled=false}});
ui.openUpdate.addEventListener("click",()=>{location.href=latestReleaseUrl||"https://github.com/schlapiadeziel-rgb/NeoPet-AI/releases/latest"});
applyConfig();
renderTodos();
setupRecognition();
setupAndroidOverlay();
setState("idle");
scheduleIdle();
if (companion.proactiveEnabled !== false && Date.now() - (Date.parse(companion.lastInteractionAt) || 0) > 6 * 60 * 60 * 1000) showBubble(companion.streakDays > 1 ? `欢迎回来！我们已经连续见面 ${companion.streakDays} 天了。` : `你好呀，我是${config.name}。今天想和我聊什么？`, 7000);
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol))
  navigator.serviceWorker.register("sw.js");
