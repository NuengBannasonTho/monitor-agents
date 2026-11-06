import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Rectangle } from 'electron';
import { BrowserWindow, Menu, Tray, app, ipcMain, nativeImage, screen, shell } from 'electron';

/*
 * MON MANG on the desktop: your agents walk along the bottom of the screen, so you can
 * keep an eye on them without the dashboard open. A see-through, always-on-top strip
 * shows the web app's "walkers" page from the local server; clicks pass through it except
 * on a banana. A 🍌 in the menu bar shows or hides them, opens the dashboard, or quits.
 */

const PORT = process.env.AGENT_OFFICE_PORT ?? '4777';
const BASE_URL = `http://127.0.0.1:${PORT}`;
/** Tall enough for a banana, its name tag and the card shown on hover. */
const STRIP_HEIGHT = 300;
/** How often to try again while the server is not running. */
const RETRY_MS = 5_000;

const here = path.dirname(fileURLToPath(import.meta.url));
let strip: BrowserWindow | null = null;
let tray: Tray | null = null;
/** Whether the bananas are out: the setting from the dashboard or the 🍌 menu. */
let shown = true;
/** The walkers page is up (the server is running); it then owns the setting. */
let pageReady = false;

/** Shows or hides the strip to match `shown`; hidden, it draws nothing at all. */
function applyShown(): void {
  if (strip === null) return;
  if (shown && !strip.isVisible()) strip.showInactive();
  if (!shown && strip.isVisible()) strip.hide();
  tray?.setContextMenu(buildMenu());
}

/** The bottom of the main screen, above the Dock. */
function stripBounds(): Rectangle {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x,
    y: workArea.y + workArea.height - STRIP_HEIGHT,
    width: workArea.width,
    height: STRIP_HEIGHT,
  };
}

function load(win: BrowserWindow): void {
  void win.loadURL(`${BASE_URL}/?walkers`).catch(() => undefined);
}

function createStrip(): BrowserWindow {
  const win = new BrowserWindow({
    ...stripBounds(),
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    // Never steals focus from what you are typing in.
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  // Above other windows, on every Space, over full-screen apps too.
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Clicks go to whatever is underneath; the page turns this off over a banana.
  win.setIgnoreMouseEvents(true, { forward: true });

  // The page only ever shows the walkers; links open in your browser.
  win.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // Server not running yet: keep trying quietly.
  win.webContents.on('did-finish-load', () => {
    pageReady = true;
  });
  win.webContents.on('did-fail-load', () => {
    pageReady = false;
    setTimeout(() => {
      if (!win.isDestroyed()) load(win);
    }, RETRY_MS);
  });
  win.once('ready-to-show', () => {
    if (shown) win.showInactive();
  });
  load(win);
  return win;
}

function openDashboard(agentId?: string): void {
  const url =
    agentId === undefined ? BASE_URL : `${BASE_URL}/?agent=${encodeURIComponent(agentId)}`;
  void shell.openExternal(url);
}

function buildMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Open dashboard',
      click: () => {
        openDashboard();
      },
    },
    {
      label: 'Show walkers',
      type: 'checkbox',
      checked: shown,
      click: () => {
        // The page saves the choice on the server, so the dashboard switch follows; with
        // the server down, just flip it here.
        if (strip !== null && pageReady) {
          strip.webContents.send('walkers:toggle');
        } else {
          shown = !shown;
          applyShown();
        }
      },
    },
    { type: 'separator' },
    { label: 'Quit MON MANG walkers', role: 'quit' },
  ]);
}

function placeStrip(): void {
  strip?.setBounds(stripBounds());
}

/** Only the messages the page may send, and only well-formed. */
function listen(): void {
  ipcMain.on('walkers:click-through', (event, through: unknown) => {
    if (event.sender !== strip?.webContents || typeof through !== 'boolean') return;
    strip.setIgnoreMouseEvents(through, { forward: true });
  });
  ipcMain.on('walkers:shown', (event, next: unknown) => {
    if (event.sender !== strip?.webContents || typeof next !== 'boolean') return;
    shown = next;
    applyShown();
  });
  ipcMain.on('walkers:open', (event, agentId: unknown) => {
    if (event.sender !== strip?.webContents) return;
    if (typeof agentId === 'string' && /^[\w-]{1,128}$/.test(agentId)) openDashboard(agentId);
    else openDashboard();
  });
}

// One strip is enough: a second launch just quits.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void app.whenReady().then(() => {
    // A menu-bar app: no Dock icon, no app switcher entry.
    app.dock?.hide();
    listen();
    strip = createStrip();

    tray = new Tray(nativeImage.createEmpty());
    tray.setTitle('🍌');
    tray.setToolTip('MON MANG walkers');
    tray.setContextMenu(buildMenu());

    screen.on('display-metrics-changed', placeStrip);
    screen.on('display-added', placeStrip);
    screen.on('display-removed', placeStrip);
  });

  // Closing the strip is not quitting: only the menu does that.
  app.on('window-all-closed', () => undefined);
}
