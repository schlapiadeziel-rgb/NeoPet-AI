const $ = (selector) => document.querySelector(selector);
const ui = {
  stage: $("#petStage"),
  bubble: $("#speechBubble"),
  state: $("#stateLabel"),
  pet: $("#defaultPet"),
  custom: $("#customPet"),
  messages: $("#messages"),
  form: $("#chatForm"),
  input: $("#messageInput"),
  mic: $("#micButton"),
  touch: $("#touchButton"),
  wave: $("#waveButton"),
  settings: $("#settingsButton"),
  dialog: $("#settingsDialog"),
  install: $("#installButton"),
  name: $("#petName"),
  nameInput: $("#nameInput"),
  personality: $("#personalityInput"),
  baseUrl: $("#baseUrlInput"),
  model: $("#modelInput"),
  apiKey: $("#apiKeyInput"),
  language: $("#languageInput"),
  avatar: $("#avatarInput"),
  save: $("#saveSettingsButton"),
  restore: $("#restorePetButton"),
  status: $("#settingsStatus"),
};
const defaults = {
  name: "小诺",
  personality: "温柔、机灵、简洁，会根据回答选择自然动作。",
  baseUrl: "https://api.openai.com/v1",
  model: "",
  language: "auto",
  avatar: "",
};
let config = {
  ...defaults,
  ...JSON.parse(localStorage.getItem("neopet-mobile-config") || "{}"),
};
let conversation = [];
let recognition;
let idleTimer;
let installPrompt;
let spriteTimer;

const spriteStates = {
  idle: { row: 0, frames: 6, interval: 480 },
  wave: { row: 3, frames: 4, interval: 170 },
  happy: { row: 4, frames: 5, interval: 135 },
  dance: { row: 4, frames: 5, interval: 115 },
  sleep: { row: 5, frames: 8, interval: 310 },
  listening: { row: 6, frames: 6, interval: 235 },
  thinking: { row: 7, frames: 6, interval: 145 },
  speaking: { row: 8, frames: 6, interval: 125 },
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
    "dance",
    "sleep",
  ].includes(action)
    ? action
    : "idle";
  ui.stage.classList.add(`state-${normalized}`);
  ui.stage.dataset.emotion = emotion;
  ui.state.textContent =
    label ||
    {
      idle: "空闲",
      listening: "正在听",
      thinking: "正在思考",
      speaking: "正在回答",
      wave: "向你挥手",
      happy: "开心",
      dance: "跳舞",
      sleep: "睡觉",
    }[normalized];
  animateSprite(normalized);
}
function showBubble(text, duration = 0) {
  ui.bubble.textContent = text;
  ui.bubble.classList.remove("hidden");
  if (duration) setTimeout(() => ui.bubble.classList.add("hidden"), duration);
}
function scheduleIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(
    () => {
      const actions = ["wave", "happy", "dance"];
      const action = actions[Math.floor(Math.random() * actions.length)];
      setState(action, "happy");
      setTimeout(() => setState("idle"), 3000);
      scheduleIdle();
    },
    14000 + Math.random() * 12000,
  );
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
    const system = `你是名为${config.name}的AI桌面宠物。性格：${config.personality}。回复用户使用与用户相同的语言，并只输出JSON：{"reply":"回答","emotion":"neutral|happy|sad|curious|excited","action":"speaking|wave|happy|dance|sleep"}。`;
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
    speak(result.reply, result.action, result.emotion);
  } catch (error) {
    const message = `连接失败：${error.message}`;
    appendMessage("assistant", message);
    showBubble(message, 5000);
    setState("idle", "sad");
  }
}
function applyConfig() {
  ui.name.textContent = config.name;
  ui.nameInput.value = config.name;
  ui.personality.value = config.personality;
  ui.baseUrl.value = config.baseUrl;
  ui.model.value = config.model;
  ui.language.value = config.language;
  ui.custom.classList.toggle("hidden", !config.avatar);
  ui.pet.classList.toggle("hidden", Boolean(config.avatar));
  if (config.avatar) ui.custom.src = config.avatar;
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
ui.settings.addEventListener("click", () => ui.dialog.showModal());
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
    applyConfig();
  };
  reader.readAsDataURL(file);
});
ui.save.addEventListener("click", () => {
  config = {
    ...config,
    name: ui.nameInput.value.trim() || defaults.name,
    personality: ui.personality.value.trim() || defaults.personality,
    baseUrl: ui.baseUrl.value.trim(),
    model: ui.model.value.trim(),
    language: ui.language.value,
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
  localStorage.setItem("neopet-mobile-config", JSON.stringify(config));
  applyConfig();
  ui.dialog.close();
});
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
applyConfig();
setupRecognition();
setState("idle");
scheduleIdle();
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol))
  navigator.serviceWorker.register("sw.js");
