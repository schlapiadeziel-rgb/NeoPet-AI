const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, shell, Tray } = require("electron");
const { ConfigStore } = require("./store");
const { OtpService } = require("./auth");
const ai = require("./ai");

let mainWindow;
let mediaWindow;
let tray;
let store;
let otp;
let quitting = false;
let clickThrough = false;
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
  ipcMain.handle("state:get", () => store.publicState());
  ipcMain.handle("state:save", (_event, value) => store.saveConfig(value || {}));
  ipcMain.handle("state:clear-memory", () => { store.clearMemory(); return true; });
  ipcMain.handle("auth:request-code", (_event, email) => otp.request(email));
  ipcMain.handle("auth:verify-code", (_event, { email, code }) => store.setSession(otp.verify(email, code)));
  ipcMain.handle("auth:logout", () => store.setSession(null));
  ipcMain.handle("ai:chat", async (_event, messages) => {
    const value = await ai.chat({
      config: store.data.ai,
      apiKey: store.apiKey(),
      pet: store.data.pet,
      messages: Array.isArray(messages) ? messages : []
    });
    const latest = messages?.at(-1);
    if (latest?.role === "user") store.addMemory("user", latest.content);
    store.addMemory("assistant", value.reply);
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
  ipcMain.handle("pet:import-avatar", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择宠物图片",
      properties: ["openFile"],
      filters: [{ name: "图片", extensions: ["png", "webp", "jpg", "jpeg"] }]
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
  ipcMain.handle("window:set-compact", (_event, compact) => {
    mainWindow.setSize(compact ? 320 : 440, compact ? 390 : 720, true);
    return true;
  });
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
