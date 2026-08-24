const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("neopet", {
  state: {
    get: () => ipcRenderer.invoke("state:get"),
    save: (value) => ipcRenderer.invoke("state:save", value),
    clearMemory: () => ipcRenderer.invoke("state:clear-memory")
  },
  auth: {
    requestCode: (email) => ipcRenderer.invoke("auth:request-code", email),
    verifyCode: (email, code) => ipcRenderer.invoke("auth:verify-code", { email, code }),
    logout: () => ipcRenderer.invoke("auth:logout")
  },
  ai: {
    chat: (messages) => ipcRenderer.invoke("ai:chat", messages),
    generatePet: (prompt) => ipcRenderer.invoke("ai:generate-pet", prompt)
  },
  pet: {
    importAvatar: () => ipcRenderer.invoke("pet:import-avatar")
  },
  companion: {
    forgetFact: (id) => ipcRenderer.invoke("companion:forget-fact", id),
    setProactive: (enabled) => ipcRenderer.invoke("companion:set-proactive", enabled),
    clear: () => ipcRenderer.invoke("companion:clear"),
    greeting: () => ipcRenderer.invoke("companion:greeting"),
    exportData: () => ipcRenderer.invoke("companion:export"),
    importData: () => ipcRenderer.invoke("companion:import")
  },
  care: {
    action: (action) => ipcRenderer.invoke("care:action", action),
    buy: (item) => ipcRenderer.invoke("care:buy", item)
  },
  tools: {
    addTodo: (text) => ipcRenderer.invoke("tools:todo-add", text),
    toggleTodo: (id) => ipcRenderer.invoke("tools:todo-toggle", id),
    deleteTodo: (id) => ipcRenderer.invoke("tools:todo-delete", id),
    weather: (city) => ipcRenderer.invoke("tools:weather", city),
    launch: () => ipcRenderer.invoke("tools:launch"),
    translateClipboard: (language) => ipcRenderer.invoke("tools:translate-clipboard", language),
    screenAsk: (question) => ipcRenderer.invoke("tools:screen-ask", question)
  },
  runtime: {
    status: () => ipcRenderer.invoke("runtime:status"),
    install: () => ipcRenderer.invoke("runtime:install"),
    useOllama: () => ipcRenderer.invoke("runtime:use-ollama"),
    transcribe: (bytes) => ipcRenderer.invoke("runtime:transcribe", bytes),
    speak: (text) => ipcRenderer.invoke("runtime:speak", text)
  },
  window: {
    setCompact: (compact) => ipcRenderer.invoke("window:set-compact", compact),
    hide: () => ipcRenderer.invoke("window:hide"),
    toggleClickThrough: () => ipcRenderer.invoke("window:toggle-click-through"),
    beginDrag: () => ipcRenderer.invoke("window:begin-drag"),
    moveTo: (x, y) => ipcRenderer.send("window:move-to", { x, y }),
    openMedia: () => ipcRenderer.invoke("window:open-media")
  },
  external: { open: (url) => ipcRenderer.invoke("external:open", url) },
  onOpenChat: (callback) => ipcRenderer.on("window:open-chat", callback)
});
