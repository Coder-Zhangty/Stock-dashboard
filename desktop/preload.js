const { contextBridge, ipcRenderer, shell } = require('electron')

// Expose safe electron APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,
  isElectron: true,

  // Open external links in default browser
  openExternal: (url) => shell.openExternal(url),

  // App version
  version: process.env.npm_package_version || '1.0.0',

  // Notifications (delegated to main process)
  notify: (title, body) => {
    new Notification(title, { body })
  },

  // Check for updates
  checkForUpdates: () => {
    ipcRenderer.send('check-for-updates')
  },

  // Listen for update events
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, info) => callback(info))
  },

  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info))
  },
})
