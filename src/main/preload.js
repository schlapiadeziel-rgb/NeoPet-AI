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
  window: {
    setCompact: (compact) => ipcRenderer.invoke("window:set-compact", compact),
    hide: () => ipcRenderer.invoke("window:hide"),
    toggleClickThrough: () => ipcRenderer.invoke("window:toggle-click-through"),
    beginDrag: () => ipcRenderer.invoke("window:begin-drag"),
    moveTo: (x, y) => ipcRenderer.send("window:move-to", { x, y })
  },
  onOpenChat: (callback) => ipcRenderer.on("window:open-chat", callback)
});
