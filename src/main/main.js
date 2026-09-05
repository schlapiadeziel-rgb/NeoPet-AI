const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, clipboard, desktopCapturer, dialog, globalShortcut, ipcMain, Menu, nativeImage, screen, shell, Tray } = require("electron");
const { ConfigStore } = require("./store");
const { OtpService } = require("./auth");
const ai = require("./ai");
const { proactiveGreeting } = require("../shared/companion");
const localRuntime = require("./runtime");
const { autoUpdater } = require("electron-updater");
const providers = require("./providers");

let mainWindow;
let mediaWindow;
let tray;
let store;
let otp;
let quitting = false;
let clickThrough = false;
let compactWindow = false;
let roamingTimer;
let roamVelocity = { x: 1.25, y: 0.55 };
const qaCapturePath = process.env.NEOPET_QA_CAPTURE || "";
const qaCaptureExpanded = process.env.NEOPET_QA_EXPANDED === "1";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 720,
    minWidth: 320,
    minHeight: 390,
    transparent: !qaCapturePath,
    backgroundColor: qaCapturePath ? "#090711" : "#00000000",
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (qaCapturePath) {
      if (qaCaptureExpanded) mainWindow.webContents.send("window:open-chat");
      setTimeout(async () => {
        const image = await mainWindow.webContents.capturePage();
        fs.mkdirSync(path.dirname(qaCapturePath), { recursive: true });
        fs.writeFileSync(qaCapturePath, image.toPNG());
        quitting = true;
        app.quit();
      }, 1400);
    }
  });
  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function showWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

function sendUpdateStatus(status, detail = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("update:status", { status, ...detail });
}

function setupUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on("checking-for-update", () => sendUpdateStatus("checking"));
  autoUpdater.on("update-available", (info) => sendUpdateStatus("available", { version: info.version }));
  autoUpdater.on("update-not-available", (info) => sendUpdateStatus("current", { version: info.version || app.getVersion() }));
  autoUpdater.on("download-progress", (progress) => sendUpdateStatus("downloading", { percent: Math.round(progress.percent || 0) }));
  autoUpdater.on("update-downloaded", (info) => sendUpdateStatus("downloaded", { version: info.version }));
  autoUpdater.on("error", (error) => sendUpdateStatus("error", { message: String(error?.message || error).slice(0, 300) }));
}

function setRoaming(enabled) {
  clearInterval(roamingTimer); roamingTimer = null;
  if (!enabled) return false;
  roamingTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || !compactWindow) return;
    const bounds = mainWindow.getBounds();
    const area = screen.getDisplayMatching(bounds).workArea;
    let x = bounds.x + roamVelocity.x; let y = bounds.y + roamVelocity.y;
    if (x <= area.x || x + bounds.width >= area.x + area.width) { roamVelocity.x *= -1; x = Math.max(area.x, Math.min(x, area.x + area.width - bounds.width)); }
    if (y <= area.y || y + bounds.height >= area.y + area.height) { roamVelocity.y *= -1; y = Math.max(area.y, Math.min(y, area.y + area.height - bounds.height)); }
    mainWindow.setPosition(Math.round(x), Math.round(y), false);
  }, 50);
  return true;
}

function openMediaCenter() {
  if (mediaWindow && !mediaWindow.isDestroyed()) { mediaWindow.show(); mediaWindow.focus(); return; }
  mediaWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: "#0d0a18",
    title: "NeoPet AI 视频中心",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mediaWindow.loadFile(path.join(__dirname, "../renderer/media.html"));
  mediaWindow.on("closed", () => { mediaWindow = null; });
}

function createTray() {
  let trayImage = nativeImage.createFromPath(process.execPath);
  if (trayImage.isEmpty()) trayImage = nativeImage.createEmpty();
  tray = new Tray(trayImage.resize({ width: 16, height: 16 }));
  tray.setToolTip("NeoPet AI");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "显示桌宠", click: showWindow },
    { label: "打开聊天", click: () => { showWindow(); mainWindow.webContents.send("window:open-chat"); } },
    {
      label: "鼠标穿透",
      type: "checkbox",
      checked: false,
      click: (item) => {
        clickThrough = item.checked;
        mainWindow.setIgnoreMouseEvents(clickThrough, { forward: true });
      }
    },
    { type: "separator" },
    { label: "退出", click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on("double-click", showWindow);
}

function registerIpc() {
  ipcMain.handle("update:version", () => app.getVersion());
  ipcMain.handle("update:check", async () => { if (!app.isPackaged) return { development: true, version: app.getVersion() }; const result = await autoUpdater.checkForUpdates(); return { version: result?.updateInfo?.version || app.getVersion() }; });
  ipcMain.handle("update:download", async () => { if (!app.isPackaged) throw new Error("开发模式不能下载更新"); await autoUpdater.downloadUpdate(); return true; });
  ipcMain.handle("update:install", () => { setImmediate(() => autoUpdater.quitAndInstall(false, true)); return true; });
  ipcMain.handle("state:get", () => store.publicState());
  ipcMain.handle("state:save", (_event, value) => store.saveConfig(value || {}));
  ipcMain.handle("state:clear-memory", () => { store.clearMemory(); return true; });
  ipcMain.handle("provider:apply", (_event, id) => { const preset=providers.PRESETS[id]; if(!preset)throw new Error("未知模型提供商"); return store.saveConfig({ai:{provider:id,baseUrl:preset.baseUrl}}); });
  ipcMain.handle("provider:list-models", () => providers.listModels(store.data.ai.baseUrl, store.apiKey()));
  ipcMain.handle("auth:request-code", (_event, email) => otp.request(email));
  ipcMain.handle("auth:verify-code", (_event, { email, code }) => store.setSession(otp.verify(email, code)));
  ipcMain.handle("auth:logout", () => store.setSession(null));
  ipcMain.handle("ai:chat", async (_event, messages) => {
    const value = await ai.chat({
      config: store.data.ai,
      apiKey: store.apiKey(),
      pet: store.data.pet,
      companion: store.data.companion,
      messages: Array.isArray(messages) ? messages : []
    });
    const latest = messages?.at(-1);
    if (latest?.role === "user") store.addMemory("user", latest.content);
    store.addMemory("assistant", value.reply);
    store.recordInteraction({ userText: latest?.content || "", reply: value.reply, emotion: value.emotion });
    return value;
  });
  ipcMain.handle("ai:generate-pet", async (_event, prompt) => {
    const avatarUrl = await ai.generatePet({
      config: store.data.ai,
      apiKey: store.apiKey(),
      prompt,
      outputDirectory: path.join(app.getPath("userData"), "pets")
    });
    store.setAvatar(avatarUrl);
    return avatarUrl;
  });
  ipcMain.handle("runtime:status", () => localRuntime.runtimeStatus(store.data.runtime));
  ipcMain.handle("runtime:install", async () => {
    const scriptPath = app.isPackaged ? path.join(process.resourcesPath, "app.asar.unpacked", "scripts", "install-local-runtime.ps1") : path.join(__dirname, "../../scripts/install-local-runtime.ps1");
    await localRuntime.installRuntime(scriptPath);
    return localRuntime.runtimeStatus(store.data.runtime);
  });
  ipcMain.handle("runtime:use-ollama", () => store.saveConfig({ ai: { provider: "ollama", baseUrl: "http://127.0.0.1:11434/v1", model: "gemma3:1b" } }));
  ipcMain.handle("runtime:transcribe", (_event, bytes) => localRuntime.transcribe(Buffer.from(bytes), store.data.runtime));
  ipcMain.handle("runtime:speak", (_event, text) => {
    const scriptPath = app.isPackaged ? path.join(process.resourcesPath, "app.asar.unpacked", "scripts", "pyttsx3_speak.py") : path.join(__dirname, "../../scripts/pyttsx3_speak.py");
    return localRuntime.speak(text, { ...store.data.runtime, speechRate: store.data.pet.speechRate }, scriptPath);
  });
  ipcMain.handle("pet:import-avatar", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择宠物图片",
      properties: ["openFile"],
      filters: [{ name: "图片或动画", extensions: ["png", "webp", "jpg", "jpeg", "gif"] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const source = result.filePaths[0];
    const directory = path.join(app.getPath("userData"), "pets");
    fs.mkdirSync(directory, { recursive: true });
    const destination = path.join(directory, `imported-${Date.now()}${path.extname(source).toLowerCase()}`);
    fs.copyFileSync(source, destination);
    const avatarUrl = pathToFileURL(destination).href;
    store.setAvatar(avatarUrl);
    return avatarUrl;
  });
  ipcMain.handle("companion:forget-fact", (_event, id) => store.forgetFact(String(id || "")));
  ipcMain.handle("care:action", (_event, action) => store.careAction(String(action || "")));
  ipcMain.handle("care:buy", (_event, item) => store.buyCareItem(String(item || "")));
  ipcMain.handle("achievement:record", (_event, event, value) => store.recordAchievement(String(event || ""), value));
  ipcMain.handle("tools:todo-add", (_event, text) => store.addTodo(text));
  ipcMain.handle("tools:todo-toggle", (_event, id) => store.toggleTodo(String(id || "")));
  ipcMain.handle("tools:todo-delete", (_event, id) => store.deleteTodo(String(id || "")));
  ipcMain.handle("tools:weather", async (_event, city) => { const value=String(city||"").trim().slice(0,80); if(!value)throw new Error("请输入城市"); const response=await fetch(`https://wttr.in/${encodeURIComponent(value)}?format=j1`,{signal:AbortSignal.timeout(8000)}); if(!response.ok)throw new Error("天气服务暂不可用"); const data=await response.json(); const current=data.current_condition?.[0]; return {city:value,temp:current?.temp_C,feels:current?.FeelsLikeC,text:current?.lang_zh?.[0]?.value||current?.weatherDesc?.[0]?.value||""}; });
  ipcMain.handle("tools:launch", async () => { const result=await dialog.showOpenDialog(mainWindow,{title:"选择要启动的程序",properties:["openFile"],filters:process.platform==="win32"?[{name:"应用程序",extensions:["exe","bat","cmd"]}]:[]}); if(result.canceled||!result.filePaths[0])return {canceled:true}; const error=await shell.openPath(result.filePaths[0]); if(error)throw new Error(error); return {canceled:false}; });
  ipcMain.handle("tools:translate-clipboard", async (_event, language) => { const text=clipboard.readText().trim().slice(0,6000); if(!text)throw new Error("剪贴板里没有文字"); const result=await ai.chat({config:store.data.ai,apiKey:store.apiKey(),pet:{name:"翻译助手",personality:"准确、自然，只给出翻译结果"},companion:null,messages:[{role:"user",content:`翻译为${String(language||"中文").slice(0,30)}：\n${text}`}]}); return result.reply; });
  ipcMain.handle("tools:screen-ask", async (_event, question) => { const sources=await desktopCapturer.getSources({types:["screen"],thumbnailSize:{width:1280,height:720}}); if(!sources[0]||sources[0].thumbnail.isEmpty())throw new Error("无法读取当前屏幕"); return ai.vision({config:store.data.ai,apiKey:store.apiKey(),imageDataUrl:sources[0].thumbnail.toDataURL(),question}); });
  ipcMain.handle("companion:set-proactive", (_event, enabled) => store.setProactiveEnabled(enabled));
  ipcMain.handle("companion:clear", () => store.clearCompanion());
  ipcMain.handle("companion:greeting", () => proactiveGreeting(store.data.companion, store.data.pet.name));
  ipcMain.handle("companion:export", async () => {
    const result = await dialog.showSaveDialog(mainWindow, { title: "备份陪伴数据", defaultPath: `neopet-backup-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: "NeoPet 备份", extensions: ["json"] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.writeFileSync(result.filePath, JSON.stringify(store.exportData(), null, 2), "utf8");
    return { canceled: false, filePath: result.filePath };
  });
  ipcMain.handle("companion:import", async () => {
    const result = await dialog.showOpenDialog(mainWindow, { title: "导入陪伴数据", properties: ["openFile"], filters: [{ name: "NeoPet 备份", extensions: ["json"] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    return { canceled: false, state: store.importData(JSON.parse(fs.readFileSync(result.filePaths[0], "utf8"))) };
  });
  ipcMain.handle("window:set-compact", (_event, compact) => {
    compactWindow = Boolean(compact);
    mainWindow.setSize(compact ? 320 : 440, compact ? 390 : 720, true);
    return true;
  });
  ipcMain.handle("window:set-roaming", (_event, enabled) => setRoaming(Boolean(enabled)));
  ipcMain.handle("window:hide", () => { mainWindow.hide(); return true; });
  ipcMain.handle("window:open-media", () => { openMediaCenter(); return true; });
  ipcMain.handle("external:open", (_event, url) => {
    const parsed = new URL(String(url));
    if (parsed.protocol !== "https:") throw new Error("只允许打开 HTTPS 地址");
    return shell.openExternal(parsed.href);
  });
  ipcMain.handle("window:begin-drag", () => mainWindow.getPosition());
  ipcMain.on("window:move-to", (_event, { x, y }) => {
    if (Number.isFinite(x) && Number.isFinite(y)) mainWindow.setPosition(Math.round(x), Math.round(y));
  });
  ipcMain.handle("window:toggle-click-through", () => {
    clickThrough = !clickThrough;
    mainWindow.setIgnoreMouseEvents(clickThrough, { forward: true });
    return clickThrough;
  });
}

app.whenReady().then(() => {
  store = new ConfigStore(app.getPath("userData"));
  if (!app.isPackaged && process.argv.includes("--qa-session")) store.setSession("qa@local.test");
  otp = new OtpService({ development: !app.isPackaged });
  createWindow();
  setupUpdater();
  createTray();
  registerIpc();
  globalShortcut.register("CommandOrControl+Shift+Space", () => {
    showWindow();
    mainWindow.webContents.send("window:open-chat");
  });
});

app.on("window-all-closed", (event) => event.preventDefault());
app.on("before-quit", () => { quitting = true; globalShortcut.unregisterAll(); });
app.on("activate", showWindow);
