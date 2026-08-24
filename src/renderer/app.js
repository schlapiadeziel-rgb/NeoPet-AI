const $ = (selector) => document.querySelector(selector);

const elements = {
  loginView: $("#loginView"), petView: $("#petView"), email: $("#emailInput"), code: $("#codeInput"), codeArea: $("#codeArea"),
  sendCode: $("#sendCodeButton"), verifyCode: $("#verifyCodeButton"), authStatus: $("#authStatus"), petStage: $("#petStage"),
  defaultPet: $("#defaultPet"), customPet: $("#customPet"), petModel: $("#petModel"), speechBubble: $("#speechBubble"), petStateLabel: $("#petStateLabel"), homeRelationshipStage: $("#homeRelationshipStage"), homeMood: $("#homeMood"), homeMemoryCount: $("#homeMemoryCount"), chatPetName: $("#chatPetName"),
  messages: $("#messages"), chatForm: $("#chatForm"), messageInput: $("#messageInput"), mic: $("#micButton"), chatPanel: $("#chatPanel"),
  careLevel: $("#careLevel"), careCoins: $("#careCoins"), careHunger: $("#careHunger"), careEnergy: $("#careEnergy"), careHappiness: $("#careHappiness"), careCleanliness: $("#careCleanliness"), foodCount: $("#foodCount"), snackCount: $("#snackCount"), soapCount: $("#soapCount"),
  touch: $("#touchButton"), wave: $("#waveButton"), quickMic: $("#quickMicButton"), compactMic: $("#compactMicButton"), compactChat: $("#compactChatButton"),
  compact: $("#compactButton"), settings: $("#settingsButton"), hide: $("#hideButton"), settingsPanel: $("#settingsPanel"),
  closeSettings: $("#closeSettingsButton"), petTitle: $("#petTitle"), accountEmail: $("#accountEmail"), accountStatus: $("#accountStatus"), switchAccount: $("#switchAccountButton"), petPicker: $("#petPicker"), petName: $("#petNameInput"), personality: $("#personalityInput"),
  baseUrl: $("#baseUrlInput"), model: $("#modelInput"), imageModel: $("#imageModelInput"), apiKey: $("#apiKeyInput"),
  apiKeyHint: $("#apiKeyHint"), petPrompt: $("#petPromptInput"), generatePet: $("#generatePetButton"), importAvatar: $("#importAvatarButton"),
  restoreAvatar: $("#restoreAvatarButton"), modelUrl: $("#modelUrlInput"), modelFile: $("#modelFileInput"), language: $("#languageSelect"), voice: $("#voiceSelect"), speechRate: $("#speechRateInput"), speechRateValue: $("#speechRateValue"), sttProvider: $("#sttProviderSelect"), ttsProvider: $("#ttsProviderSelect"), installRuntime: $("#installRuntimeButton"), ollamaPreset: $("#ollamaPresetButton"), runtimeStatusButton: $("#runtimeStatusButton"), runtimeStatus: $("#runtimeStatus"),
  relationshipStage: $("#relationshipStage"), relationshipStats: $("#relationshipStats"), bondProgress: $("#bondProgress"), proactiveEnabled: $("#proactiveEnabled"),
  memoryFacts: $("#memoryFacts"), companionDiary: $("#companionDiary"), exportMemory: $("#exportMemoryButton"), importMemory: $("#importMemoryButton"), clearCompanion: $("#clearCompanionButton"),
  todoInput: $("#todoInput"), todoAdd: $("#todoAddButton"), todoList: $("#todoList"), focusMinutes: $("#focusMinutesInput"), focus: $("#focusButton"), focusStatus: $("#focusStatus"), weatherCity: $("#weatherCityInput"), weather: $("#weatherButton"), weatherResult: $("#weatherResult"), launch: $("#launchButton"), translateLanguage: $("#translateLanguageInput"), translate: $("#translateButton"), translateResult: $("#translateResult"), screenQuestion: $("#screenQuestionInput"), screenAsk: $("#screenAskButton"), screenResult: $("#screenResult"),
  saveSettings: $("#saveSettingsButton"), mediaCenter: $("#mediaCenterButton"), clearMemory: $("#clearMemoryButton"), logout: $("#logoutButton"), settingsStatus: $("#settingsStatus")
};

let appState;
let conversation = [];
let compactMode = true;
let idleTimer;
let idleMotionTimer;
let recognition;
let mediaRecorder;
let recordingStream;
let spriteTimer;
let lookResetTimer;
let currentPetState = "idle";
let localModelObjectUrl = "";
let focusTimer;

function renderTodos() {
  const todos = appState?.productivity?.todos || [];
  elements.todoList.replaceChildren(...todos.map((todo) => {
    const row = document.createElement("div"); row.className = `todo-row${todo.done ? " done" : ""}`;
    const check = document.createElement("input"); check.type = "checkbox"; check.checked = todo.done;
    const label = document.createElement("span"); label.textContent = todo.text;
    const remove = document.createElement("button"); remove.className = "text-button"; remove.textContent = "删除";
    check.addEventListener("change", async () => { appState = await window.neopet.tools.toggleTodo(todo.id); renderTodos(); });
    remove.addEventListener("click", async () => { appState = await window.neopet.tools.deleteTodo(todo.id); renderTodos(); });
    row.append(check, label, remove); return row;
  }));
}

const PETS = [
  { id: "xiaonuo", name: "小诺", description: "温暖机敏的像素机器人", personality: "温暖、活泼、简洁，使用用户正在使用的语言回答。", pixelated: true },
  { id: "yuntuan", name: "云团", description: "柔软治愈的3D云朵猫", personality: "温柔、治愈、好奇，善于安慰和倾听，回答自然亲切。" },
  { id: "yueli", name: "月狸", description: "月光森林里的灵狐伙伴", personality: "安静、灵动、可靠，带一点神秘感，会耐心陪伴并给出清晰回答。" }
];

function petById(id) {
  return PETS.find((pet) => pet.id === id) || PETS[0];
}

function applyBuiltInPet(id) {
  const pet = petById(id);
  elements.defaultPet.style.backgroundImage = `url("assets/pets/${pet.id}/spritesheet.webp")`;
  elements.defaultPet.classList.toggle("smooth-sprite", !pet.pixelated);
  elements.defaultPet.setAttribute("aria-label", `AI 桌宠${pet.name}`);
}

function renderPetPicker() {
  const selectedId = appState?.pet?.petId || "xiaonuo";
  elements.petPicker.replaceChildren(...PETS.map((pet) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pet-choice${pet.id === selectedId ? " selected" : ""}`;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(pet.id === selectedId));
    button.innerHTML = `<span class="pet-choice-preview${pet.pixelated ? " pixelated" : ""}"></span><strong>${pet.name}</strong><small>${pet.description}</small>`;
    button.querySelector(".pet-choice-preview").style.backgroundImage = `url("assets/pets/${pet.id}/spritesheet.webp")`;
    button.addEventListener("click", async () => {
      elements.petName.value = pet.name;
      elements.personality.value = pet.personality;
      appState = await window.neopet.state.save({ pet: { petId: pet.id, avatarUrl: "", modelUrl: "", renderMode: "sprite", name: pet.name, personality: pet.personality } });
      applyBuiltInPet(pet.id);
      applyAvatar("");
      elements.petTitle.textContent = pet.name;
      renderPetPicker();
      setStatus(elements.settingsStatus, `已选择${pet.name}`);
    });
    return button;
  }));
}

const spriteStates = {
  idle: { row: 0, frames: 6, interval: 480 },
  "running-right": { row: 1, frames: 8, interval: 95 },
  "running-left": { row: 2, frames: 8, interval: 95 },
  wave: { row: 3, frames: 4, interval: 170 },
  happy: { row: 4, frames: 5, interval: 135 },
  dance: { row: 4, frames: 5, interval: 115 },
  failed: { row: 5, frames: 8, interval: 180 },
  sleep: { row: 5, frames: 8, interval: 310 },
  listening: { row: 6, frames: 6, interval: 235 },
  thinking: { row: 7, frames: 6, interval: 145 },
  nod: { row: 7, frames: 6, interval: 170 },
  speaking: { row: 8, frames: 6, interval: 125 }
};

const stateLabels = {
  idle: "空闲", listening: "正在听", thinking: "正在思考", speaking: "正在回答", happy: "开心",
  wave: "向你挥手", nod: "点头", dance: "跳舞", sleep: "睡觉", failed: "需要帮助",
  "running-left": "跟着你", "running-right": "跟着你"
};

function setStatus(element, text, error = false) {
  element.textContent = text || "";
  element.style.color = error ? "#ff9baa" : "";
}

function showAuthenticated(authenticated) {
  elements.loginView.classList.toggle("hidden", authenticated);
  elements.petView.classList.toggle("hidden", !authenticated);
}

function showSpriteFrame(row, column) {
  elements.defaultPet.style.backgroundPosition = `${(column / 7) * 100}% ${(row / 10) * 100}%`;
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

function applyPetState(name = "idle", emotion = "neutral") {
  const normalized = name === "speak" ? "speaking" : name === "think" ? "thinking" : name;
  currentPetState = normalized;
  [...elements.petStage.classList].filter((value) => value.startsWith("state-")).forEach((value) => elements.petStage.classList.remove(value));
  elements.petStage.classList.add(`state-${normalized}`);
  elements.petStage.dataset.emotion = emotion;
  elements.petStateLabel.textContent = stateLabels[normalized] || "陪伴中";
  animateSprite(normalized);
  if (!elements.petModel.classList.contains("hidden")) {
    const names = elements.petModel.availableAnimations || [];
    const token = normalized === "speaking" ? "talk" : normalized;
    const match = names.find((item) => item.toLowerCase().includes(token)) || names[0];
    if (match) { elements.petModel.animationName = match; elements.petModel.play?.(); }
  }
}

function scheduleIdle() {
  clearTimeout(idleTimer);
  clearTimeout(idleMotionTimer);
  const startedAt = Date.now();
  const idleMotions = [
    { action: "wave", emotion: "happy", label: "向你挥手" },
    { action: "nod", emotion: "curious", label: "看看你在做什么" },
    { action: "happy", emotion: "happy", label: "心情不错" },
    { action: "dance", emotion: "excited", label: "偷偷活动一下" }
  ];
  const playIdleMotion = () => {
    if (Date.now() - startedAt >= 55_000) return;
    const motion = idleMotions[Math.floor(Math.random() * idleMotions.length)];
    applyPetState(motion.action, motion.emotion);
    elements.petStateLabel.textContent = motion.label;
    setTimeout(() => applyPetState("idle", "neutral"), motion.action === "dance" ? 3800 : 2400);
    idleMotionTimer = setTimeout(playIdleMotion, 12_000 + Math.random() * 10_000);
  };
  idleMotionTimer = setTimeout(playIdleMotion, 10_000 + Math.random() * 8_000);
  idleTimer = setTimeout(() => {
    clearTimeout(idleMotionTimer);
    applyPetState("sleep", "neutral");
    showBubble("呼…我先眯一会儿。", 3500);
  }, 60_000);
}

async function setPetMode(compact, focusChat = false) {
  compactMode = Boolean(compact);
  elements.petView.classList.toggle("compact-mode", compactMode);
  elements.chatPanel.classList.toggle("hidden", compactMode);
  elements.settingsPanel.classList.add("hidden");
  await window.neopet.window.setCompact(compactMode);
  if (!compactMode && focusChat) elements.messageInput.focus();
}

function openSettingsPanel() {
  setPetMode(false).then(() => {
    populateSettings();
    elements.settingsPanel.classList.remove("hidden");
  });
}

function showBubble(text, duration = 0) {
  elements.speechBubble.textContent = text;
  elements.speechBubble.classList.remove("hidden");
  if (duration) setTimeout(() => elements.speechBubble.classList.add("hidden"), duration);
}

function applyVisualMode(modelSource = "") {
  const modelUrl = modelSource || appState?.pet?.modelUrl || "";
  const hasModel = Boolean(modelUrl) && appState?.pet?.renderMode === "3d";
  const hasCustom = Boolean(appState?.pet?.avatarUrl) && !hasModel;
  elements.petModel.classList.toggle("hidden", !hasModel);
  elements.customPet.classList.toggle("hidden", !hasCustom);
  elements.defaultPet.classList.toggle("hidden", hasModel || hasCustom);
  if (hasModel) elements.petModel.src = modelUrl;
  if (hasCustom) elements.customPet.src = appState.pet.avatarUrl;
}

function applyAvatar(url) {
  appState.pet.avatarUrl = url || "";
  appState.pet.renderMode = url ? "image" : "sprite";
  applyVisualMode();
}

function appendMessage(role, content) {
  const message = document.createElement("div");
  message.className = `message ${role === "user" ? "user-message" : "pet-message"}`;
  message.textContent = content;
  elements.messages.append(message);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function renderCompanion() {
  const companion = appState?.companion || {};
  elements.relationshipStage.textContent = companion.stage || "初识";
  elements.relationshipStats.textContent = `信任 ${companion.trust || 0} · 连续 ${companion.streakDays || 0} 天 · ${companion.mood || "平静"}`;
  elements.bondProgress.style.width = `${Math.min(100, Number(companion.xp || 0) % 100)}%`;
  elements.proactiveEnabled.checked = companion.proactiveEnabled !== false;
  elements.homeRelationshipStage.textContent = companion.stage || "初识";
  elements.homeMood.textContent = companion.mood || "平静";
  elements.homeMemoryCount.textContent = `${companion.facts?.length || 0} 条记忆`;
  const facts = Array.isArray(companion.facts) ? companion.facts : [];
  elements.memoryFacts.replaceChildren(...(facts.length ? facts.slice().reverse().map((fact) => {
    const row = document.createElement("div");
    row.className = "memory-row";
    const text = document.createElement("span");
    text.textContent = fact.text;
    const forget = document.createElement("button");
    forget.type = "button";
    forget.textContent = "忘记";
    forget.addEventListener("click", async () => { appState = await window.neopet.companion.forgetFact(fact.id); renderCompanion(); });
    row.append(text, forget);
    return row;
  }) : [Object.assign(document.createElement("p"), { className: "hint", textContent: "还没有长期记忆" })]));
  const diary = Array.isArray(companion.diary) ? companion.diary : [];
  elements.companionDiary.replaceChildren(...(diary.length ? diary.slice(-5).reverse().map((entry) => {
    const row = document.createElement("div");
    row.className = "diary-row";
    row.textContent = `${new Date(entry.at).toLocaleDateString()} · ${entry.text}`;
    return row;
  }) : [Object.assign(document.createElement("p"), { className: "hint", textContent: "日记会随着相处逐渐出现" })]));
}

function renderCare() {
  const care = appState?.care || {};
  elements.careLevel.textContent = care.level || 1; elements.careCoins.textContent = Math.floor(care.coins || 0);
  [[elements.careHunger, care.hunger], [elements.careEnergy, care.energy], [elements.careHappiness, care.happiness], [elements.careCleanliness, care.cleanliness]].forEach(([bar, value]) => { bar.style.width = `${Math.max(0, Math.min(100, value || 0))}%`; });
  elements.foodCount.textContent = care.inventory?.food || 0; elements.snackCount.textContent = care.inventory?.snack || 0; elements.soapCount.textContent = care.inventory?.soap || 0;
}

function populateSettings() {
  elements.accountEmail.textContent = appState.session?.email || "未登录";
  elements.accountStatus.textContent = appState.session?.verifiedAt ? `已验证 · ${new Date(appState.session.verifiedAt).toLocaleDateString()}` : "邮箱验证码账户";
  elements.petName.value = appState.pet.name;
  elements.personality.value = appState.pet.personality;
  elements.baseUrl.value = appState.ai.baseUrl;
  elements.model.value = appState.ai.model;
  elements.imageModel.value = appState.ai.imageModel;
  elements.modelUrl.value = appState.pet.modelUrl || "";
  elements.language.value = appState.pet.language || "auto";
  elements.apiKey.value = "";
  elements.apiKeyHint.textContent = appState.ai.hasApiKey ? "设备中已有加密密钥；留空可继续使用。" : "密钥将使用操作系统安全存储加密。";
  elements.speechRate.value = appState.pet.speechRate;
  elements.speechRateValue.textContent = Number(appState.pet.speechRate).toFixed(1);
  elements.petTitle.textContent = appState.pet.name;
  elements.chatPetName.textContent = appState.pet.name;
  elements.sttProvider.value = appState.runtime?.sttProvider || "system";
  elements.ttsProvider.value = appState.runtime?.ttsProvider || "system";
  applyBuiltInPet(appState.pet.petId);
  applyVisualMode(localModelObjectUrl);
  renderPetPicker();
  renderCompanion();
  renderCare();
  renderTodos();
}

async function saveSettings() {
  elements.saveSettings.disabled = true;
  setStatus(elements.settingsStatus, "正在保存…");
  try {
    appState = await window.neopet.state.save({
      ai: { baseUrl: elements.baseUrl.value, model: elements.model.value, imageModel: elements.imageModel.value, apiKey: elements.apiKey.value },
      pet: { petId: appState.pet.petId, name: elements.petName.value, personality: elements.personality.value, modelUrl: elements.modelUrl.value, renderMode: elements.modelUrl.value ? "3d" : appState.pet.renderMode, language: elements.language.value, voiceName: elements.voice.value, speechRate: elements.speechRate.value },
      runtime: { sttProvider: elements.sttProvider.value, ttsProvider: elements.ttsProvider.value }
    });
    populateSettings();
    setupSpeechRecognition();
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
  const finishSpeaking = () => {
    elements.petStage.classList.remove("is-talking");
    elements.speechBubble.classList.add("hidden");
    applyPetState(action === "sleep" ? "sleep" : "idle", emotion);
    scheduleIdle();
  };
  if (appState.runtime?.ttsProvider === "pyttsx3") {
    window.neopet.runtime.speak(text).then(finishSpeaking).catch(() => speakWithSystem());
    return;
  }
  if (appState.runtime?.ttsProvider === "kokoro") {
    showBubble("Kokoro 接口已预留，当前回退到系统朗读。", 2200);
  }
  speakWithSystem();
  function speakWithSystem() {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = Number(appState.pet.speechRate || 1);
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find((voice) => voice.name === appState.pet.voiceName);
  const requestedLanguage = appState.pet.language && appState.pet.language !== "auto" ? appState.pet.language.toLowerCase().split("-")[0] : "";
  const languageMatch = voices.find((voice) => requestedLanguage ? voice.lang.toLowerCase().startsWith(requestedLanguage) : (text.match(/[\u4e00-\u9fff]/) ? voice.lang.toLowerCase().startsWith("zh") : voice.lang.toLowerCase().startsWith("en")));
  utterance.voice = preferred || languageMatch || null;
  if (appState.pet.language && appState.pet.language !== "auto") utterance.lang = appState.pet.language;
  utterance.onstart = () => { applyPetState(motion, emotion); elements.petStage.classList.add("is-talking"); };
  utterance.onend = finishSpeaking;
  utterance.onerror = () => { elements.petStage.classList.remove("is-talking"); applyPetState("idle", emotion); scheduleIdle(); };
  speechSynthesis.speak(utterance);
  }
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
    appState = await window.neopet.state.get();
    renderCompanion();
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
  recognition.lang = appState?.pet?.language && appState.pet.language !== "auto" ? appState.pet.language : (navigator.language || "zh-CN");
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
  const authenticated = Boolean(appState.session);
  showAuthenticated(authenticated);
  conversation = (appState.memory || []).map(({ role, content }) => ({ role, content })).slice(-16);
  populateSettings();
  populateVoices();
  speechSynthesis.onvoiceschanged = populateVoices;
  setupSpeechRecognition();
  applyPetState("idle", "neutral");
  scheduleIdle();
  if (authenticated) {
    await setPetMode(true);
    const last = Date.parse(appState.companion?.lastInteractionAt || "") || 0;
    if (appState.companion?.proactiveEnabled !== false && Date.now() - last > 6 * 60 * 60 * 1000) {
      const greeting = await window.neopet.companion.greeting();
      if (greeting) showBubble(greeting, 7000);
    }
  }
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
    await setPetMode(true);
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
function startListening() {
  if (appState.runtime?.sttProvider === "whisper") { toggleWhisperRecording(); return; }
  if (recognition) recognition.start();
  else {
    setPetMode(false, true);
    showBubble("当前系统不支持语音识别，请直接输入文字。", 4500);
  }
}
async function toggleWhisperRecording() {
  if (mediaRecorder?.state === "recording") { mediaRecorder.stop(); return; }
  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    mediaRecorder = new MediaRecorder(recordingStream);
    mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    mediaRecorder.onstop = async () => {
      recordingStream.getTracks().forEach((track) => track.stop());
      elements.mic.classList.remove("listening"); applyPetState("thinking", "curious"); showBubble("Whisper Tiny 正在识别…");
      try { const bytes = new Uint8Array(await new Blob(chunks, { type: mediaRecorder.mimeType }).arrayBuffer()); elements.messageInput.value = await window.neopet.runtime.transcribe(bytes); showBubble("识别完成，确认后发送。", 2200); }
      catch (error) { showBubble(`本地识别失败：${error.message}`, 4500); }
      applyPetState("idle");
    };
    mediaRecorder.start(); elements.mic.classList.add("listening"); applyPetState("listening", "curious"); showBubble("正在离线录音，再点一次结束。", 0);
    setTimeout(() => { if (mediaRecorder?.state === "recording") mediaRecorder.stop(); }, 20000);
  } catch (error) { showBubble(`无法录音：${error.message}`, 4000); }
}
elements.mic.addEventListener("click", startListening);
elements.quickMic.addEventListener("click", startListening);
elements.compactMic.addEventListener("click", startListening);

function touchPet() {
  speechSynthesis.cancel();
  applyPetState("happy", "happy");
  showBubble("嘿嘿，好舒服！", 2200);
  setTimeout(() => applyPetState("idle", "happy"), 2200);
  scheduleIdle();
}
function waveToUser() {
  speechSynthesis.cancel();
  applyPetState("wave", "happy");
  showBubble("我在这里！", 1900);
  setTimeout(() => applyPetState("idle", "happy"), 2100);
  scheduleIdle();
}
elements.touch.addEventListener("click", touchPet);
elements.wave.addEventListener("click", waveToUser);
elements.compactChat.addEventListener("click", () => setPetMode(false, true));
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
      if (moved) {
        if (element === elements.defaultPet) animateSprite(dx < 0 ? "running-left" : "running-right");
        window.neopet.window.moveTo(windowX + dx, windowY + dy);
      }
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      if (!moved) touchPet();
      else if (element === elements.defaultPet) applyPetState("idle", "neutral");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  });
}
enablePetDrag(elements.defaultPet);
enablePetDrag(elements.customPet);
elements.defaultPet.addEventListener("keydown", (event) => { if (event.key === "Enter") touchPet(); });
elements.defaultPet.addEventListener("dblclick", () => setPetMode(false, true));
elements.customPet.addEventListener("dblclick", () => setPetMode(false, true));
elements.petStage.addEventListener("pointermove", (event) => {
  if (currentPetState !== "idle" || elements.defaultPet.classList.contains("hidden") || event.buttons) return;
  const rect = elements.defaultPet.getBoundingClientRect();
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
elements.petStage.addEventListener("contextmenu", (event) => { event.preventDefault(); openSettingsPanel(); });

elements.settings.addEventListener("click", openSettingsPanel);
elements.closeSettings.addEventListener("click", () => elements.settingsPanel.classList.add("hidden"));
elements.hide.addEventListener("click", () => window.neopet.window.hide());
elements.compact.addEventListener("click", () => setPetMode(!compactMode, compactMode));
window.neopet.onOpenChat(() => setPetMode(false, true));

elements.speechRate.addEventListener("input", () => { elements.speechRateValue.textContent = Number(elements.speechRate.value).toFixed(1); });
elements.saveSettings.addEventListener("click", saveSettings);
elements.todoAdd.addEventListener("click", async () => { try { appState = await window.neopet.tools.addTodo(elements.todoInput.value); elements.todoInput.value = ""; renderTodos(); } catch (error) { setStatus(elements.settingsStatus, error.message, true); } });
elements.focus.addEventListener("click", () => { if (focusTimer) { clearInterval(focusTimer); focusTimer = null; elements.focus.textContent = "开始"; elements.focusStatus.textContent = "已取消"; return; } const deadline = Date.now() + Math.max(1, Math.min(180, Number(elements.focusMinutes.value) || 25)) * 60000; elements.focus.textContent = "取消"; const tick = () => { const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); elements.focusStatus.textContent = `剩余 ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2,"0")}`; if (remaining <= 0) { clearInterval(focusTimer); focusTimer = null; elements.focus.textContent = "开始"; elements.focusStatus.textContent = "专注完成，休息一下吧"; showBubble("专注完成，活动一下吧！", 5000); } }; tick(); focusTimer = setInterval(tick, 1000); });
elements.weather.addEventListener("click", async () => { elements.weatherResult.textContent = "查询中…"; try { const v = await window.neopet.tools.weather(elements.weatherCity.value); elements.weatherResult.textContent = `${v.city} · ${v.text} · ${v.temp}°C，体感 ${v.feels}°C`; } catch (e) { elements.weatherResult.textContent = e.message; } });
elements.launch.addEventListener("click", async () => { try { const v = await window.neopet.tools.launch(); setStatus(elements.settingsStatus, v.canceled ? "已取消" : "程序已启动"); } catch (e) { setStatus(elements.settingsStatus, e.message, true); } });
elements.translate.addEventListener("click", async () => { elements.translateResult.textContent = "翻译中…"; try { elements.translateResult.textContent = await window.neopet.tools.translateClipboard(elements.translateLanguage.value); } catch (e) { elements.translateResult.textContent = e.message; } });
elements.screenAsk.addEventListener("click", async () => { elements.screenResult.textContent = "正在分析当前屏幕…"; try { elements.screenResult.textContent = await window.neopet.tools.screenAsk(elements.screenQuestion.value); } catch (e) { elements.screenResult.textContent = e.message; } });
document.querySelectorAll("[data-care]").forEach((button) => button.addEventListener("click", async () => { try { appState = await window.neopet.care.action(button.dataset.care); renderCare(); applyPetState(button.dataset.care === "rest" ? "sleep" : "happy", "happy"); showBubble({ feed: "好吃！谢谢你。", play: "一起玩真开心！", bath: "现在干干净净啦！", rest: "我休息一会儿。" }[button.dataset.care], 2200); } catch (error) { showBubble(error.message, 3500); } }));
document.querySelectorAll("[data-buy]").forEach((button) => button.addEventListener("click", async () => { try { appState = await window.neopet.care.buy(button.dataset.buy); renderCare(); setStatus(elements.settingsStatus, "购买成功"); } catch (error) { setStatus(elements.settingsStatus, error.message, true); } }));
elements.installRuntime.addEventListener("click", async () => {
  if (!confirm("将从官方来源下载并安装 Ollama、Gemma 3 1B、Whisper Tiny 和 pyttsx3，约需 2.4GB 磁盘空间。继续吗？")) return;
  elements.installRuntime.disabled = true; elements.runtimeStatus.textContent = "正在应用内下载和安装，首次安装可能需要较长时间…";
  try { const value = await window.neopet.runtime.install(); elements.runtimeStatus.textContent = `安装完成 · Ollama ${value.ollama ? "可用" : "需启动"} · Gemma ${value.gemma ? "已安装" : "待确认"} · Whisper ${value.whisper ? "可用" : "失败"} · pyttsx3 ${value.pyttsx3 ? "可用" : "失败"}`; }
  catch (error) { elements.runtimeStatus.textContent = `安装失败：${error.message}`; }
  finally { elements.installRuntime.disabled = false; }
});
elements.ollamaPreset.addEventListener("click", async () => { appState = await window.neopet.runtime.useOllama(); populateSettings(); setStatus(elements.settingsStatus, "已切换到 Ollama + Gemma 3 1B"); });
elements.runtimeStatusButton.addEventListener("click", async () => { elements.runtimeStatus.textContent = "正在检测…"; const value = await window.neopet.runtime.status(); elements.runtimeStatus.textContent = `Ollama ${value.ollama ? "可用" : "未运行"} · Gemma 3 1B ${value.gemma ? "已安装" : "未安装"} · Whisper Tiny ${value.whisper ? "可用" : "未安装"} · pyttsx3 ${value.pyttsx3 ? "可用" : "未安装"}`; });
elements.proactiveEnabled.addEventListener("change", async () => { appState = await window.neopet.companion.setProactive(elements.proactiveEnabled.checked); renderCompanion(); });
elements.exportMemory.addEventListener("click", async () => { const result = await window.neopet.companion.exportData(); setStatus(elements.settingsStatus, result?.canceled ? "已取消备份" : "陪伴数据已备份"); });
elements.importMemory.addEventListener("click", async () => { const result = await window.neopet.companion.importData(); if (result?.state) { appState = result.state; populateSettings(); setStatus(elements.settingsStatus, "备份已导入"); } });
elements.clearCompanion.addEventListener("click", async () => {
  if (!confirm("这会删除对话、长期记忆、关系等级和陪伴日记，确定继续吗？")) return;
  appState = await window.neopet.companion.clear();
  conversation = [];
  elements.messages.replaceChildren();
  renderCompanion();
  setStatus(elements.settingsStatus, "陪伴数据已清除");
});
elements.mediaCenter.addEventListener("click", () => window.neopet.window.openMedia());
elements.importAvatar.addEventListener("click", async () => {
  const avatar = await window.neopet.pet.importAvatar();
  if (avatar) { appState.pet.avatarUrl = avatar; applyAvatar(avatar); setStatus(elements.settingsStatus, "宠物图片已导入"); }
});
elements.modelFile.addEventListener("change", () => {
  const file = elements.modelFile.files?.[0];
  if (!file) return;
  if (file.size > 80_000_000) { setStatus(elements.settingsStatus, "3D 模型不能超过 80MB", true); return; }
  if (localModelObjectUrl) URL.revokeObjectURL(localModelObjectUrl);
  localModelObjectUrl = URL.createObjectURL(file);
  appState.pet.renderMode = "3d";
  appState.pet.modelUrl = "";
  appState.pet.avatarUrl = "";
  elements.modelUrl.value = "";
  applyVisualMode(localModelObjectUrl);
  setStatus(elements.settingsStatus, "本地 3D 模型已载入；网址模型可持久保存");
});
elements.modelUrl.addEventListener("change", () => {
  const value = elements.modelUrl.value.trim();
  if (!value) return;
  appState.pet.renderMode = "3d";
  appState.pet.modelUrl = value;
  appState.pet.avatarUrl = "";
  applyVisualMode(value);
});
elements.restoreAvatar.addEventListener("click", async () => {
  appState = await window.neopet.state.save({ pet: { avatarUrl: "", modelUrl: "", renderMode: "sprite" } });
  elements.modelUrl.value = "";
  applyVisualMode();
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
  compactMode = false;
  elements.petView.classList.remove("compact-mode");
  elements.chatPanel.classList.remove("hidden");
  await window.neopet.window.setCompact(false);
});
elements.switchAccount.addEventListener("click", () => elements.logout.click());

initialize().catch((error) => setStatus(elements.authStatus, `启动失败：${error.message}`, true));
