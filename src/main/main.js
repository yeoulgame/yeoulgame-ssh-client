/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 * https://opensource.org/licenses/MIT
 *
 * main.js - Electron 메인 프로세스
 */
'use strict';

const { app, BrowserWindow, Menu, shell, ipcMain, dialog, safeStorage, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const { CryptoStore } = require('./crypto-store');
const { Store } = require('./store');
const { SshManager } = require('./ssh-manager');
const { I18n, SUPPORTED, resolveLanguage } = require('./i18n-main');
const updater = require('./updater');

const APP_INFO = {
  name: 'Yeoulgame SSH Client',
  nameKo: '여울 SSH 클라이언트',
  version: app.getVersion(),
  homepage: 'https://yeoulgame.com',
  downloads: 'https://yeoulgame.com/board/files',
  github: 'https://github.com/yeoulgame/yeoulgame-ssh-client',
  issues: 'https://github.com/yeoulgame/yeoulgame-ssh-client/issues',
  license: 'MIT License',
  licenseUrl: 'https://opensource.org/licenses/MIT',
  copyright: 'Copyright © 2026 Yeoulgame (https://yeoulgame.com)',
  support: 'support@yeoulgame.com'
};

const ALLOWED_EXTERNAL = [
  'https://yeoulgame.com',
  'https://api.yeoulgame.com',
  'https://github.com/yeoulgame',
  'https://opensource.org/licenses/MIT'
];

let mainWindow = null;
let aboutWindow = null;
let cryptoStore = null;
let store = null;
let i18n = null;
let sshManager = null;

const isDev = process.argv.includes('--dev');

/* ------------------------------------------------------------------ */
/* 창 생성                                                              */
/* ------------------------------------------------------------------ */

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 860,
    minHeight: 520,
    backgroundColor: '#11141a',
    show: false,
    title: APP_INFO.name,
    icon: resolveIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('close', (e) => {
    const active = Array.from(sshManager.sessions.values()).filter((s) => s.status === 'connected');
    if (active.length > 0 && !mainWindow.__forceClose) {
      e.preventDefault();
      const res = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: [i18n.t('common.cancel'), i18n.t('common.ok')],
        defaultId: 1,
        cancelId: 0,
        title: i18n.t('app.confirmExitTitle'),
        message: i18n.t('app.confirmExitMessage', { count: active.length })
      });
      if (res === 1) {
        mainWindow.__forceClose = true;
        sshManager.closeAll();
        mainWindow.close();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 외부 링크는 기본 브라우저로만 (허용 목록)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      openExternalSafe(url);
    }
  });
}

function resolveIcon() {
  const candidates =
    process.platform === 'win32'
      ? ['icon.ico', 'icon.png']
      : ['icons/512x512.png', 'icon.png'];
  for (const c of candidates) {
    const p = path.join(__dirname, '..', '..', 'build', c);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function openExternalSafe(url) {
  if (typeof url !== 'string') return;
  if (!ALLOWED_EXTERNAL.some((prefix) => url.startsWith(prefix))) return;
  shell.openExternal(url);
}

function createAboutWindow() {
  if (aboutWindow) {
    aboutWindow.focus();
    return;
  }
  aboutWindow = new BrowserWindow({
    width: 540,
    height: 760,
    resizable: true,
    minimizable: false,
    maximizable: false,
    parent: mainWindow || undefined,
    modal: process.platform !== 'darwin',
    backgroundColor: '#11141a',
    title: i18n.t('menu.about'),
    icon: resolveIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  aboutWindow.setMenu(null);
  aboutWindow.loadFile(path.join(__dirname, '..', 'renderer', 'about.html'));
  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
}

/* ------------------------------------------------------------------ */
/* 메뉴 (다국어)                                                        */
/* ------------------------------------------------------------------ */

function send(action, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu:action', { action, payload });
  }
}

function buildMenu() {
  const t = (k) => i18n.t(k);
  const template = [
    {
      label: t('menu.file'),
      submenu: [
        { label: t('menu.newTab'), accelerator: 'CmdOrCtrl+Shift+T', click: () => send('new-tab') },
        { label: t('menu.closeTab'), accelerator: 'CmdOrCtrl+Shift+W', click: () => send('close-tab') },
        { type: 'separator' },
        { label: t('menu.newConnection'), accelerator: 'CmdOrCtrl+Shift+N', click: () => send('new-connection') },
        { label: t('menu.saveSession'), accelerator: 'CmdOrCtrl+Shift+S', click: () => send('save-session') },
        { type: 'separator' },
        { label: t('menu.importSessions'), click: () => send('import-sessions') },
        { label: t('menu.exportSessions'), click: () => send('export-sessions') },
        { type: 'separator' },
        { label: t('menu.exit'), accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4', click: () => app.quit() }
      ]
    },
    {
      label: t('menu.edit'),
      submenu: [
        { label: t('menu.copy'), accelerator: 'CmdOrCtrl+Shift+C', click: () => send('copy') },
        { label: t('menu.paste'), accelerator: 'CmdOrCtrl+Shift+V', click: () => send('paste') },
        { label: t('menu.selectAll'), accelerator: 'CmdOrCtrl+Shift+A', click: () => send('select-all') },
        { type: 'separator' },
        { label: t('menu.find'), accelerator: 'CmdOrCtrl+Shift+F', click: () => send('find') },
        { label: t('menu.clear'), accelerator: 'CmdOrCtrl+Shift+L', click: () => send('clear') }
      ]
    },
    {
      label: t('menu.view'),
      submenu: [
        { label: t('menu.themeDark'), click: () => send('theme', { theme: 'dark' }) },
        { label: t('menu.themeLight'), click: () => send('theme', { theme: 'light' }) },
        { type: 'separator' },
        { label: t('menu.zoomIn'), accelerator: 'CmdOrCtrl+Plus', click: () => send('font-size', { delta: 1 }) },
        { label: t('menu.zoomOut'), accelerator: 'CmdOrCtrl+-', click: () => send('font-size', { delta: -1 }) },
        { label: t('menu.zoomReset'), accelerator: 'CmdOrCtrl+0', click: () => send('font-size', { reset: true }) },
        { type: 'separator' },
        { label: t('menu.toggleSidebar'), accelerator: 'CmdOrCtrl+Shift+B', click: () => send('toggle-sidebar') },
        { label: t('menu.toggleQuickBar'), accelerator: 'CmdOrCtrl+Shift+J', click: () => send('toggle-quickbar') },
        { label: t('menu.refresh'), accelerator: 'F5', click: () => send('refresh-terminal') }
      ]
    },
    {
      label: t('menu.session'),
      submenu: [
        { label: t('menu.connect'), click: () => send('connect') },
        { label: t('menu.disconnect'), click: () => send('disconnect') },
        { label: t('menu.reconnect'), accelerator: 'CmdOrCtrl+Shift+R', click: () => send('reconnect') },
        { type: 'separator' },
        {
          label: t('menu.encoding'),
          submenu: [
            { label: t('encoding.auto'), click: () => send('encoding', { mode: 'auto' }) },
            { label: 'UTF-8', click: () => send('encoding', { mode: 'utf8' }) },
            { label: 'EUC-KR (CP949)', click: () => send('encoding', { mode: 'euc-kr' }) }
          ]
        }
      ]
    },
    {
      label: t('menu.tools'),
      submenu: [
        { label: t('menu.settings'), accelerator: 'CmdOrCtrl+,', click: () => send('settings') },
        { label: t('menu.quickCommands'), click: () => send('quick-commands') },
        { label: t('menu.masterPassword'), click: () => send('master-password') },
        ...(isDev ? [{ type: 'separator' }, { label: 'DevTools', accelerator: 'F12', click: () => mainWindow && mainWindow.webContents.toggleDevTools() }] : [])
      ]
    },
    {
      label: t('menu.language'),
      submenu: [
        { label: t('language.auto'), click: () => setLanguage('auto') },
        { type: 'separator' },
        { label: '한국어 (Korean)', click: () => setLanguage('ko') },
        { label: 'English', click: () => setLanguage('en') },
        { label: '日本語 (Japanese)', click: () => setLanguage('ja') },
        { label: '简体中文 (Chinese)', click: () => setLanguage('zh-CN') },
        { label: 'Deutsch (German)', click: () => setLanguage('de') }
      ]
    },
    {
      label: t('menu.help'),
      submenu: [
        { label: t('menu.helpContents'), accelerator: 'F1', click: () => send('help') },
        { type: 'separator' },
        { label: t('menu.homepage'), click: () => openExternalSafe(APP_INFO.homepage) },
        { label: t('menu.github'), click: () => openExternalSafe(APP_INFO.github) },
        { label: t('menu.reportIssue'), click: () => openExternalSafe(APP_INFO.issues) },
        { label: t('menu.licenseMenu'), click: () => send('license') },
        { type: 'separator' },
        { label: t('menu.checkUpdates'), click: () => send('check-updates') },
        { label: t('menu.about'), click: () => createAboutWindow() }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function setLanguage(lang) {
  store.setSettings({ language: lang });
  i18n.setLanguage(resolveLanguage(lang, app.getLocale()));
  buildMenu();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('i18n:changed', i18n.bundle());
  }
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.webContents.send('i18n:changed', i18n.bundle());
  }
}

/* ------------------------------------------------------------------ */
/* IPC                                                                  */
/* ------------------------------------------------------------------ */

function registerIpc() {
  ipcMain.handle('app:info', () => ({
    ...APP_INFO,
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    node: process.versions.node,
    locale: app.getLocale(),
    userData: app.getPath('userData'),
    safeStorage: cryptoStore.safeAvailable
  }));

  ipcMain.handle('i18n:get', () => i18n.bundle());
  ipcMain.handle('i18n:set', (e, lang) => {
    setLanguage(SUPPORTED.includes(lang) || lang === 'auto' ? lang : 'auto');
    return i18n.bundle();
  });

  ipcMain.handle('settings:get', () => store.getSettings());
  ipcMain.handle('settings:set', (e, patch) => {
    const next = store.setSettings(patch || {});
    if (patch && patch.language) setLanguage(patch.language);
    return next;
  });

  ipcMain.handle('sessions:list', () => store.listSessions());
  ipcMain.handle('sessions:save', (e, session) => {
    try {
      return { ok: true, id: store.saveSession(session) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
  ipcMain.handle('sessions:delete', (e, id) => store.deleteSession(id));
  ipcMain.handle('sessions:duplicate', (e, id, name) => store.duplicateSession(id, name));
  ipcMain.handle('sessions:reorder', (e, ids) => store.reorderSessions(ids));

  ipcMain.handle('sessions:export', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: i18n.t('menu.exportSessions'),
      defaultPath: 'yeoulgame-sessions.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePath) return { ok: false };
    fs.writeFileSync(filePath, JSON.stringify(store.exportSessions(), null, 2), 'utf8');
    return { ok: true, filePath };
  });

  ipcMain.handle('sessions:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: i18n.t('menu.importSessions'),
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePaths || !filePaths[0]) return { ok: false };
    try {
      const payload = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
      return { ok: true, count: store.importSessions(payload) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // --- 보안 (마스터 비밀번호) ---
  ipcMain.handle('vault:status', () => ({
    masterEnabled: cryptoStore.masterEnabled,
    unlocked: cryptoStore.unlocked,
    safeStorage: cryptoStore.safeAvailable,
    canStore: cryptoStore.canStoreSecrets()
  }));
  ipcMain.handle('vault:unlock', (e, pw) => cryptoStore.unlock(pw));
  ipcMain.handle('vault:setMaster', (e, pw) => cryptoStore.setMasterPassword(pw));
  ipcMain.handle('vault:lock', () => {
    cryptoStore.lock();
    return true;
  });

  // --- SSH ---
  ipcMain.handle('ssh:connect', (e, id, cfg) => {
    const settings = store.getSettings();
    let full = { ...cfg };

    if (cfg.sessionId) {
      const saved = store.getSessionForConnect(cfg.sessionId);
      if (saved) full = { ...saved, ...cfg };
    }

    full.keepAlive = settings.keepAlive;
    full.keepAliveInterval = settings.keepAliveInterval;
    full.autoReconnect = full.autoReconnect !== undefined ? full.autoReconnect : settings.autoReconnect;
    full.reconnectMaxRetries = settings.reconnectMaxRetries;
    full.connectTimeout = settings.connectTimeout;
    full.encoding = full.encoding && full.encoding !== 'inherit' ? full.encoding : settings.encoding;
    full.sendLocaleEnv = settings.sendLocaleEnv;
    full.uiLanguage = i18n.lang;

    sshManager.connect(id, full);
    return { ok: true };
  });

  ipcMain.on('ssh:write', (e, id, data) => sshManager.write(id, data));
  ipcMain.on('ssh:resize', (e, id, cols, rows) => sshManager.resize(id, cols, rows));
  ipcMain.handle('ssh:encoding', (e, id, mode) => {
    sshManager.setEncoding(id, mode);
    return true;
  });
  ipcMain.handle('ssh:disconnect', (e, id) => {
    sshManager.disconnect(id);
    return true;
  });
  ipcMain.handle('ssh:reconnect', (e, id) => {
    sshManager.reconnect(id);
    return true;
  });
  ipcMain.handle('ssh:close', (e, id) => {
    sshManager.close(id);
    return true;
  });
  ipcMain.handle('ssh:forgetHostKey', (e, host, port) => {
    store.removeHostKey(host, Number(port) || 22);
    return true;
  });

  // --- 보조 ---
  ipcMain.handle('dialog:pickKeyFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: i18n.t('connect.selectKeyFile'),
      properties: ['openFile', 'showHiddenFiles'],
      filters: [
        { name: i18n.t('connect.keyFiles'), extensions: ['pem', 'key', 'ppk', ''] },
        { name: 'All', extensions: ['*'] }
      ]
    });
    return canceled || !filePaths ? '' : filePaths[0] || '';
  });

  ipcMain.handle('shell:open', (e, url) => {
    openExternalSafe(url);
    return true;
  });

  ipcMain.handle('clipboard:read', () => clipboard.readText());
  ipcMain.on('clipboard:write', (e, text) => clipboard.writeText(String(text || '')));

  ipcMain.handle('update:check', () => updater.check(APP_INFO.version));

  ipcMain.handle('window:about', () => {
    createAboutWindow();
    return true;
  });
  ipcMain.handle('window:closeAbout', () => {
    if (aboutWindow) aboutWindow.close();
    return true;
  });

  ipcMain.handle('fonts:suggested', () => {
    if (process.platform === 'win32') {
      return ['D2Coding', 'Consolas', '맑은 고딕', 'Malgun Gothic', 'NanumGothicCoding', '나눔고딕코딩', 'Courier New'];
    }
    return ['Noto Sans Mono CJK KR', 'D2Coding', 'NanumGothicCoding', 'DejaVu Sans Mono', 'Liberation Mono', 'monospace'];
  });
}

/* ------------------------------------------------------------------ */
/* 부트스트랩                                                           */
/* ------------------------------------------------------------------ */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('com.yeoulgame.sshclient');

    const userData = app.getPath('userData');
    cryptoStore = new CryptoStore(userData, safeStorage);
    store = new Store(userData, cryptoStore);

    const settings = store.getSettings();
    i18n = new I18n(resolveLanguage(settings.language, app.getLocale()));

    sshManager = new SshManager({ store });
    sshManager.setEmitter((type, payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ssh:event', { type, ...payload });
      }
    });

    registerIpc();
    buildMenu();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    sshManager && sshManager.closeAll();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    sshManager && sshManager.closeAll();
  });
}
