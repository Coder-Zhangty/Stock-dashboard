const { app, BrowserWindow, Tray, Menu, dialog, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

let mainWindow = null
let tray = null
let backendProcess = null
let isDev = process.argv.includes('--dev')

// ── Backend launcher ──────────────────────────────────────────────────────

function findPython() {
  // Try common Python paths
  const candidates = [
    'python',
    'python3',
    path.join(process.resourcesPath, 'backend', 'venv', 'Scripts', 'python.exe'),
    path.join(process.resourcesPath, 'backend', 'venv', 'bin', 'python'),
  ]
  return candidates[0] // Default to PATH python
}

function startBackend() {
  const python = findPython()
  let backendDir

  if (isDev) {
    backendDir = path.join(__dirname, '..', 'backend')
  } else {
    backendDir = path.join(process.resourcesPath, 'backend')
  }

  console.log(`Starting backend: ${python} in ${backendDir}`)

  backendProcess = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8021'], {
    cwd: backendDir,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  backendProcess.stdout.on('data', (data) => {
    console.log(`[backend] ${data.toString().trim()}`)
  })

  backendProcess.stderr.on('data', (data) => {
    console.error(`[backend] ${data.toString().trim()}`)
  })

  backendProcess.on('close', (code) => {
    console.log(`Backend exited with code ${code}`)
  })
}

function stopBackend() {
  if (backendProcess) {
    console.log('Stopping backend...')
    backendProcess.kill('SIGTERM')
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        backendProcess.kill('SIGKILL')
      }
    }, 5000)
  }
}

// ── Wait for backend to be ready ──────────────────────────────────────────

function waitForBackend(url, retries = 30, interval = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      attempts++
      http.get(url, (res) => {
        resolve(true)
      }).on('error', () => {
        if (attempts >= retries) {
          reject(new Error('Backend failed to start'))
        } else {
          setTimeout(check, interval)
        }
      })
    }
    check()
  })
}

// ── Create window ─────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Trade Dashboard',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: true,
    backgroundColor: '#0f0f12',
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadURL('http://127.0.0.1:8021')
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.on('close', (event) => {
    if (tray) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

// ── System Tray ───────────────────────────────────────────────────────────

function createTray() {
  // Use a simple 16x16 tray icon - in production use a real .ico/.png
  const iconPath = path.join(__dirname, 'build', 'icon.png')
  try {
    tray = new Tray(iconPath)
  } catch {
    // Fallback: create an empty icon
    const { nativeImage } = require('electron')
    const img = nativeImage.createEmpty()
    tray = new Tray(img)
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Open in Browser',
      click: () => shell.openExternal('http://localhost:8021'),
    },
    { type: 'separator' },
    {
      label: 'Restart Backend',
      click: () => {
        stopBackend()
        setTimeout(() => startBackend(), 2000)
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        if (mainWindow) {
          mainWindow.removeAllListeners('close')
        }
        app.quit()
      },
    },
  ])

  tray.setToolTip('Trade Dashboard')
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// ── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  createTray()

  // Start backend
  startBackend()

  // Wait for backend, then create window
  const backendUrl = 'http://127.0.0.1:8021/api/market/providers/health'
  try {
    await waitForBackend(backendUrl, 30, 1000)
    console.log('Backend is ready')
  } catch {
    console.warn('Backend did not respond in time, opening window anyway')
  }

  createWindow()

  // Auto-updater (only in production)
  if (!isDev) {
    try {
      const { autoUpdater } = require('electron-updater')
      autoUpdater.checkForUpdatesAndNotify().catch(() => {})
    } catch {
      // electron-updater not available
    }
  }
})

app.on('window-all-closed', () => {
  // Don't quit on window close - minimize to tray
})

app.on('before-quit', () => {
  stopBackend()
  if (tray) {
    tray.destroy()
    tray = null
  }
})

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show()
  } else {
    createWindow()
  }
})
