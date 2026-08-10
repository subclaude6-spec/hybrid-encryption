const { contextBridge } = require('electron')

// The renderer gets an explicit, minimal surface. Crypto, OAuth and filesystem
// work will be added here later as invoke() channels - never by exposing ipcRenderer whole.
contextBridge.exposeInMainWorld('hce', {
  platform: process.platform,
  isDesktop: true,
  version: process.versions.electron,
})
