// Type declarations for Electron preload API
export {}

declare global {
  interface Window {
    electronAPI?: {
      platform: string
      isElectron: boolean
      openExternal: (url: string) => void
      version: string
      notify: (title: string, body: string) => void
      checkForUpdates: () => void
      onUpdateAvailable: (callback: (info: any) => void) => void
      onUpdateDownloaded: (callback: (info: any) => void) => void
    }
  }
}
