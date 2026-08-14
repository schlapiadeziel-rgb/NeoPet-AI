const $ = (selector) => document.querySelector(selector);

const elements = {
  loginView: $("#loginView"), petView: $("#petView"), email: $("#emailInput"), code: $("#codeInput"), codeArea: $("#codeArea"),
  sendCode: $("#sendCodeButton"), verifyCode: $("#verifyCodeButton"), authStatus: $("#authStatus"), petStage: $("#petStage"),
  defaultPet: $("#defaultPet"), customPet: $("#customPet"), speechBubble: $("#speechBubble"), petStateLabel: $("#petStateLabel"),
  messages: $("#messages"), chatForm: $("#chatForm"), messageInput: $("#messageInput"), mic: $("#micButton"), chatPanel: $("#chatPanel"),
  compact: $("#compactButton"), settings: $("#settingsButton"), hide: $("#hideButton"), settingsPanel: $("#settingsPanel"),
  closeSettings: $("#closeSettingsButton"), petTitle: $("#petTitle"), petName: $("#petNameInput"), personality: $("#personalityInput"),
  baseUrl: $("#baseUrlInput"), model: $("#modelInput"), imageModel: $("#imageModelInput"), apiKey: $("#apiKeyInput"),
  apiKeyHint: $("#apiKeyHint"), petPrompt: $("#petPromptInput"), generatePet: $("#generatePetButton"), importAvatar: $("#importAvatarButton"),
  restoreAvatar: $("#restoreAvatarButton"), voice: $("#voiceSelect"), speechRate: $("#speechRateInput"), speechRateValue: $("#speechRateValue"),
  saveSettings: $("#saveSettingsButton"), clearMemory: $("#clearMemoryButton"), logout: $("#logoutButton"), settingsStatus: $("#settingsStatus")
};

let appState;
let conversation = [];
let compactMode = false;
let idleTimer;
let recognition;

const stateLabels = {
  idle: "空闲", listening: "正在听", thinking: "正在思考", speaking: "正在回答", happy: "开心",
  wave: "向你挥手", nod: "点头", dance: "跳舞", sleep: "睡觉"
};

function setStatus(element, text, error = false) {
  element.textContent = text || "";
  element.style.color = error ? "#ff9baa" : "";
}

function showAuthenticated(authenticated) {
  elements.loginView.classList.toggle("hidden", authenticated);
  elements.petView.classList.toggle("hidden", !authenticated);
}

function applyPetState(name = "idle", emotion = "neutral") {
  const normalized = name === "speak" ? "speaking" : name === "think" ? "thinking" : name;
  [...elements.petStage.classList].filter((value) => value.startsWith("state-")).forEach((value) => elements.petStage.classList.remove(value));
  elements.petStage.classList.add(`state-${normalized}`);
  elements.petStage.dataset.emotion = emotion;
  elements.petStateLabel.textContent = stateLabels[normalized] || "陪伴中";
}

function scheduleIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    applyPetState("sleep", "neutral");
    showBubble("呼…我先眯一会儿。", 3500);
  }, 60_000);
}

function showBubble(text, duration = 0) {
  elements.speechBubble.textContent = text;
  elements.speechBubble.classList.remove("hidden");
  if (duration) setTimeout(() => elements.speechBubble.classList.add("hidden"), duration);
}

function applyAvatar(url) {
  const hasCustom = Boolean(url);
  elements.customPet.classList.toggle("hidden", !hasCustom);
  elements.defaultPet.classList.toggle("hidden", hasCustom);
  if (hasCustom) elements.customPet.src = url;
}

function appendMessage(role, content) {
  const message = document.createElement("div");
  message.className = `message ${role === "user" ? "user-message" : "pet-message"}`;
  message.textContent = content;
  elements.messages.append(message);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function populateSettings() {
  elements.petName.value = appState.pet.name;
  elements.personality.value = appState.pet.personality;
  elements.baseUrl.value = appState.ai.baseUrl;
  elements.model.value = appState.ai.model;
  elements.imageModel.value = appState.ai.imageModel;
  elements.apiKey.value = "";
  elements.apiKeyHint.textContent = appState.ai.hasApiKey ? "设备中已有加密密钥；留空可继续使用。" : "密钥将使用操作系统安全存储加密。";
  elements.speechRate.value = appState.pet.speechRate;
  elements.speechRateValue.textContent = Number(appState.pet.speechRate).toFixed(1);
  elements.petTitle.textContent = appState.pet.name;
  applyAvatar(appState.pet.avatarUrl);
}

async function saveSettings() {
  elements.saveSettings.disabled = true;
  setStatus(elements.settingsStatus, "正在保存…");
  try {
    appState = await window.neopet.state.save({
      ai: { baseUrl: elements.baseUrl.value, model: elements.model.value, imageModel: elements.imageModel.value, apiKey: elements.apiKey.value },
      pet: { name: elements.petName.value, personality: elements.personality.value, voiceName: elements.voice.value, speechRate: elements.speechRate.value }
    });
    populateSettings();
    setStatus(elements.settingsStatus, "设置已保存");
    return true;
  } catch (error) {
    setStatus(elements.settingsStatus, error.message, true);
    return false;
  } finally {
    elements.saveSettings.disabled = false;
  }
}

function speak(text, action, emotion) {
  speechSynthesis.cancel();
  const motion = !action || action === "speak" || action === "idle" ? "speaking" : action;
  applyPetState(motion, emotion || "neutral");
  elements.petStage.classList.add("is-talking");
  showBubble(text);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = Number(appState.pet.speechRate || 1);
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find((voice) => voice.name === appState.pet.voiceName);
  const languageMatch = voices.find((voice) => text.match(/[\u4e00-\u9fff]/) ? voice.lang.toLowerCase().startsWith("zh") : voice.lang.toLowerCase().startsWith("en"));
  utterance.voice = preferred || languageMatch || null;
  utterance.onstart = () => { applyPetState(motion, emotion); elements.petStage.classList.add("is-talking"); };
  utterance.onend = () => {
    elements.petStage.classList.remove("is-talking");
    elements.speechBubble.classList.add("hidden");
    applyPetState(action === "sleep" ? "sleep" : "idle", emotion);
    scheduleIdle();
  };
  utterance.onerror = () => { elements.petStage.classList.remove("is-talking"); applyPetState("idle", emotion); scheduleIdle(); };
  speechSynthesis.speak(utterance);
}

async function sendMessage(text) {
  const content = String(text || "").trim();
  if (!content) return;
  appendMessage("user", content);
  conversation.push({ role: "user", content });
  elements.messageInput.value = "";
  applyPetState("thinking", "curious");
  showBubble("让我想想…");
  elements.chatForm.classList.add("busy");
  try {
    const response = await window.neopet.ai.chat(conversation);
    conversation.push({ role: "assistant", content: response.reply });
    appendMessage("assistant", response.reply);
    speak(response.reply, response.action, response.emotion);
  } catch (error) {
    appendMessage("assistant", `连接失败：${error.message}`);
    showBubble(error.message, 5000);
    applyPetState("idle", "sad");
  } finally {
    elements.chatForm.classList.remove("busy");
    scheduleIdle();
  }
}

function setupSpeechRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    elements.mic.title = "当前系统不支持浏览器语音识别";
    return;
  }
  recognition = new Recognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "zh-CN";
  recognition.onstart = () => { elements.mic.classList.add("listening"); applyPetState("listening", "curious"); showBubble("我在听…"); };
  recognition.onresult = (event) => {
    elements.messageInput.value = [...event.results].map((item) => item[0].transcript).join("");
  };
  recognition.onend = () => { elements.mic.classList.remove("listening"); elements.speechBubble.classList.add("hidden"); applyPetState("idle"); };
  recognition.onerror = (event) => { elements.mic.classList.remove("listening"); showBubble(`语音识别失败：${event.error}`, 3500); applyPetState("idle"); };
}

function populateVoices() {
  const selected = appState?.pet?.voiceName || "";
  const voices = speechSynthesis.getVoices();
  elements.voice.innerHTML = '<option value="">自动选择</option>';
  for (const voice of voices) {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    option.selected = voice.name === selected;
    elements.voice.append(option);
  }
}

async function initialize() {
  appState = await window.neopet.state.get();
  showAuthenticated(Boolean(appState.session));
  conversation = (appState.memory || []).map(({ role, content }) => ({ role, content })).slice(-16);
  populateSettings();
  populateVoices();
  speechSynthesis.onvoiceschanged = populateVoices;
  setupSpeechRecognition();
  scheduleIdle();
}

elements.sendCode.addEventListener("click", async () => {
  elements.sendCode.disabled = true;
  setStatus(elements.authStatus, "正在发送验证码…");
  try {
    const result = await window.neopet.auth.requestCode(elements.email.value);
    elements.codeArea.classList.remove("hidden");
    setStatus(elements.authStatus, result.developmentCode ? `开发模式验证码：${result.developmentCode}` : "验证码已发送，请检查邮箱");
    elements.code.focus();
  } catch (error) {
    setStatus(elements.authStatus, error.message, true);
  } finally {
    elements.sendCode.disabled = false;
  }
});

elements.verifyCode.addEventListener("click", async () => {
  elements.verifyCode.disabled = true;
  try {
    await window.neopet.auth.verifyCode(elements.email.value, elements.code.value);
    appState = await window.neopet.state.get();
    showAuthenticated(true);
    populateSettings();
  } catch (error) {
    setStatus(elements.authStatus, error.message, true);
  } finally {
    elements.verifyCode.disabled = false;
  }
});

elements.chatForm.addEventListener("submit", (event) => { event.preventDefault(); sendMessage(elements.messageInput.value); });
elements.messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(elements.messageInput.value); }
});
elements.mic.addEventListener("click", () => recognition ? recognition.start() : showBubble("请使用文字输入，或在后续版本配置本地语音识别。", 4500));

function touchPet() {
  speechSynthesis.cancel();
  applyPetState("happy", "happy");
  showBubble("嘿嘿，好舒服！", 2200);
  setTimeout(() => applyPetState("idle", "happy"), 2200);
  scheduleIdle();
}
function enablePetDrag(element) {
  element.addEventListener("pointerdown", async (event) => {
    if (event.button !== 0) return;
    const [windowX, windowY] = await window.neopet.window.beginDrag();
    const startX = event.screenX;
    const startY = event.screenY;
    let moved = false;
    const move = (next) => {
      const dx = next.screenX - startX;
      const dy = next.screenY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
      if (moved) window.neopet.window.moveTo(windowX + dx, windowY + dy);
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      if (!moved) touchPet();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  });
}
enablePetDrag(elements.defaultPet);
enablePetDrag(elements.customPet);
elements.defaultPet.addEventListener("keydown", (event) => { if (event.key === "Enter") touchPet(); });

elements.settings.addEventListener("click", () => { elements.settingsPanel.classList.remove("hidden"); populateSettings(); });
elements.closeSettings.addEventListener("click", () => elements.settingsPanel.classList.add("hidden"));
elements.hide.addEventListener("click", () => window.neopet.window.hide());
elements.compact.addEventListener("click", async () => {
  compactMode = !compactMode;
  elements.chatPanel.classList.toggle("hidden", compactMode);
  await window.neopet.window.setCompact(compactMode);
});
window.neopet.onOpenChat(() => {
  compactMode = false;
  elements.chatPanel.classList.remove("hidden");
  window.neopet.window.setCompact(false);
  elements.messageInput.focus();
});

elements.speechRate.addEventListener("input", () => { elements.speechRateValue.textContent = Number(elements.speechRate.value).toFixed(1); });
elements.saveSettings.addEventListener("click", saveSettings);
elements.importAvatar.addEventListener("click", async () => {
  const avatar = await window.neopet.pet.importAvatar();
  if (avatar) { appState.pet.avatarUrl = avatar; applyAvatar(avatar); setStatus(elements.settingsStatus, "宠物图片已导入"); }
});
elements.restoreAvatar.addEventListener("click", async () => {
  appState = await window.neopet.state.save({ pet: { avatarUrl: "" } });
  applyAvatar("");
  setStatus(elements.settingsStatus, "已恢复默认宠物");
});
elements.generatePet.addEventListener("click", async () => {
  if (!(await saveSettings())) return;
  elements.generatePet.disabled = true;
  setStatus(elements.settingsStatus, "正在生成原创宠物，可能需要一两分钟…");
  applyPetState("thinking", "curious");
  try {
    const avatar = await window.neopet.ai.generatePet(elements.petPrompt.value);
    appState.pet.avatarUrl = avatar;
    applyAvatar(avatar);
    applyPetState("happy", "excited");
    setStatus(elements.settingsStatus, "新宠物已生成并保存");
  } catch (error) {
    setStatus(elements.settingsStatus, error.message, true);
    applyPetState("idle", "sad");
  } finally {
    elements.generatePet.disabled = false;
  }
});
elements.clearMemory.addEventListener("click", async () => {
  await window.neopet.state.clearMemory();
  conversation = [];
  setStatus(elements.settingsStatus, "对话记忆已清除");
});
elements.logout.addEventListener("click", async () => {
  speechSynthesis.cancel();
  await window.neopet.auth.logout();
  appState.session = null;
  elements.settingsPanel.classList.add("hidden");
  showAuthenticated(false);
});

initialize().catch((error) => setStatus(elements.authStatus, `启动失败：${error.message}`, true));
