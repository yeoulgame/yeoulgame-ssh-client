/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 * https://opensource.org/licenses/MIT
 *
 * app.js - 렌더러: 탭 · 터미널 · 세션 · 설정 UI
 */
'use strict';

/* ------------------------------------------------------------------ */
/* xterm 전역 해석 (UMD 스크립트 태그 로딩)                              */
/* ------------------------------------------------------------------ */
function pickCtor(ns, name) {
  if (!ns) return null;
  if (typeof ns === 'function') return ns;
  return ns[name] || null;
}
const TerminalCtor = pickCtor(window.Terminal, 'Terminal');
const FitCtor = pickCtor(window.FitAddon, 'FitAddon');
const SearchCtor = pickCtor(window.SearchAddon, 'SearchAddon');
const Unicode11Ctor = pickCtor(window.Unicode11Addon, 'Unicode11Addon');
const WebLinksCtor = pickCtor(window.WebLinksAddon, 'WebLinksAddon');

const api = window.yeoul;

/* ------------------------------------------------------------------ */
/* 상태                                                                 */
/* ------------------------------------------------------------------ */
const state = {
  info: null,
  settings: null,
  dict: {},
  lang: 'ko',
  fullSupport: true,
  sessions: [],
  vault: { masterEnabled: false, unlocked: true, safeStorage: false, canStore: false },
  tabs: new Map(),
  activeTab: null,
  tabSeq: 0,
  fonts: []
};

/* ------------------------------------------------------------------ */
/* 작은 도우미                                                          */
/* ------------------------------------------------------------------ */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function t(key, vars) {
  let cur = state.dict;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object') cur = cur[part];
    else {
      cur = undefined;
      break;
    }
  }
  if (typeof cur !== 'string') return key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) cur = cur.split('{' + k + '}').join(String(v));
  }
  return cur;
}

function toast(message, kind, ms) {
  const root = $('#toast-root');
  const div = document.createElement('div');
  div.className = 'toast' + (kind ? ' ' + kind : '');
  div.textContent = message;
  root.appendChild(div);
  setTimeout(() => div.remove(), ms || 5200);
}

/** 모달 생성. buttons: [{label, kind, onClick(close, body)}] */
function openModal({ title, bodyHtml, buttons, wide, onMount }) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML =
    '<div class="modal' + (wide ? ' wide' : '') + '">' +
    '<div class="modal-head">' + esc(title) + '</div>' +
    '<div class="modal-body"></div>' +
    '<div class="modal-foot"></div>' +
    '</div>';
  const body = $('.modal-body', back);
  body.innerHTML = bodyHtml;
  const foot = $('.modal-foot', back);

  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey);
    const tab = activeTab();
    if (tab) tab.term.focus();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  (buttons || [{ label: t('common.close') }]).forEach((b) => {
    const btn = document.createElement('button');
    btn.textContent = b.label;
    if (b.kind) btn.className = b.kind;
    btn.addEventListener('click', () => {
      if (b.onClick) b.onClick(close, body);
      else close();
    });
    foot.appendChild(btn);
  });

  $('#modal-root').appendChild(back);
  if (onMount) onMount(body, close);
  const firstInput = body.querySelector('input, select, textarea');
  if (firstInput) firstInput.focus();
  return { close, body };
}

function confirmModal(title, message, onYes) {
  openModal({
    title,
    bodyHtml: '<p class="note" style="font-size:13px;color:var(--fg)">' + esc(message) + '</p>',
    buttons: [
      { label: t('common.cancel') },
      {
        label: t('common.ok'),
        kind: 'primary',
        onClick: (close) => {
          close();
          onYes();
        }
      }
    ]
  });
}

/* ------------------------------------------------------------------ */
/* 폰트                                                                 */
/* ------------------------------------------------------------------ */
function defaultFontStack() {
  if (state.info && state.info.platform === 'win32') {
    return "'D2Coding', 'NanumGothicCoding', Consolas, 'Malgun Gothic', monospace";
  }
  return "'Noto Sans Mono CJK KR', 'D2Coding', 'NanumGothicCoding', 'DejaVu Sans Mono', monospace";
}

function terminalFont() {
  const f = state.settings && state.settings.fontFamily;
  return f ? "'" + f + "', " + defaultFontStack() : defaultFontStack();
}

/** 한글 글리프 존재 여부 추정 (없으면 tofu 와 폭이 같다) */
function koreanGlyphAvailable(fontStack) {
  try {
    const c = document.createElement('canvas').getContext('2d');
    c.font = '16px ' + fontStack;
    const ko = c.measureText('가').width;
    const tofu = c.measureText('￾').width;
    return ko > 0 && Math.abs(ko - tofu) > 0.5;
  } catch {
    return true;
  }
}

/* ------------------------------------------------------------------ */
/* 테마                                                                 */
/* ------------------------------------------------------------------ */
function terminalTheme() {
  const light = state.settings.theme === 'light';
  return light
    ? {
        background: '#ffffff', foreground: '#1d2430', cursor: '#1c72d4', cursorAccent: '#ffffff',
        selectionBackground: 'rgba(28,114,212,.25)',
        black: '#2e3440', red: '#c0392b', green: '#1f9d63', yellow: '#b57d09', blue: '#1c72d4',
        magenta: '#8e44ad', cyan: '#1f8f9d', white: '#d8dde6',
        brightBlack: '#5d6779', brightRed: '#e74c3c', brightGreen: '#27ae60', brightYellow: '#d49a13',
        brightBlue: '#3b8fe0', brightMagenta: '#a55bc9', brightCyan: '#31a8b7', brightWhite: '#1d2430'
      }
    : {
        background: '#11141a', foreground: '#e6e9ef', cursor: '#4ea1ff', cursorAccent: '#11141a',
        selectionBackground: 'rgba(78,161,255,.30)',
        black: '#1e2430', red: '#f2616b', green: '#4cc38a', yellow: '#e8b339', blue: '#4ea1ff',
        magenta: '#b083f0', cyan: '#52c7d8', white: '#e6e9ef',
        brightBlack: '#5b6673', brightRed: '#ff7d85', brightGreen: '#6bd9a4', brightYellow: '#f5c95c',
        brightBlue: '#79b8ff', brightMagenta: '#c9a2ff', brightCyan: '#79dbe8', brightWhite: '#ffffff'
      };
}

function applyTheme() {
  document.body.dataset.theme = state.settings.theme === 'light' ? 'light' : 'dark';
  for (const tab of state.tabs.values()) {
    tab.term.options.theme = terminalTheme();
  }
}

/* ------------------------------------------------------------------ */
/* 탭 / 터미널                                                          */
/* ------------------------------------------------------------------ */
function activeTab() {
  return state.activeTab ? state.tabs.get(state.activeTab) : null;
}

function newTabId() {
  state.tabSeq += 1;
  return 'tab-' + state.tabSeq + '-' + Date.now().toString(36);
}

function createTab(options) {
  const opts = options || {};
  const id = newTabId();

  const host = document.createElement('div');
  host.className = 'term-host';
  host.dataset.tabId = id;
  $('#terminals').appendChild(host);

  const term = new TerminalCtor({
    fontFamily: terminalFont(),
    fontSize: state.settings.fontSize,
    scrollback: state.settings.scrollback,
    cursorBlink: !!state.settings.cursorBlink,
    allowProposedApi: true,
    convertEol: false,
    macOptionIsMeta: true,
    rightClickSelectsWord: false,
    theme: terminalTheme()
  });

  const fit = FitCtor ? new FitCtor() : null;
  const search = SearchCtor ? new SearchCtor() : null;
  if (fit) term.loadAddon(fit);
  if (search) term.loadAddon(search);
  if (Unicode11Ctor) {
    try {
      term.loadAddon(new Unicode11Ctor());
      term.unicode.activeVersion = '11'; // 한글/CJK 문자폭 2칸 계산
    } catch { /* 선택 기능 */ }
  }
  if (WebLinksCtor) {
    try {
      term.loadAddon(new WebLinksCtor((event, uri) => api.invoke('shell:open', uri)));
    } catch { /* 선택 기능 */ }
  }

  term.open(host);

  // 터미널에 포커스가 있어도 앱 단축키가 동작하도록 (xterm 이 먼저 삼키는 것을 막는다)
  // 규칙: Ctrl+Shift+* 와 Ctrl+Tab 은 앱이 가져가고, 나머지 Ctrl+* 는 셸(readline)에 그대로 넘긴다.
  //       Ctrl+C(SIGINT) · Ctrl+R(역방향 검색) · Ctrl+W(단어 삭제) 등이 살아 있어야 하기 때문.
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown') return true;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return true;

    if (e.key === 'Tab') {
      // window 리스너까지 함께 반응해 두 칸씩 넘어가지 않도록 전파를 끊는다
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      cycleTab(e.shiftKey);
      return false;
    }
    if (e.shiftKey) return false;              // Ctrl+Shift+* = 앱 단축키
    if (['+', '-', '=', '0', ','].includes(e.key)) return false; // 글자 크기 · 설정
    return true;                                // 그 밖의 Ctrl+* 는 셸로
  });

  const tab = {
    id,
    term,
    fit,
    search,
    host,
    name: opts.name || t('session.tabDefault'),
    status: 'idle',
    cfg: null,
    encoding: state.settings.encoding,
    connectedAt: null,
    commandCount: 0,
    color: opts.color || '#4ea1ff',
    icon: opts.icon || 'server'
  };
  state.tabs.set(id, tab);

  term.onData((data) => {
    if (tab.status !== 'connected') return;
    if (data.indexOf('\r') >= 0) tab.commandCount += 1;
    api.send('ssh:write', id, data);
  });

  term.onResize(({ cols, rows }) => {
    api.send('ssh:resize', id, cols, rows);
  });

  if (state.settings.copyOnSelect) {
    term.onSelectionChange(() => {
      const sel = term.getSelection();
      if (sel) api.send('clipboard:write', sel);
    });
  }

  host.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    if (!state.settings.rightClickPaste) return;
    const sel = term.getSelection();
    if (sel) {
      api.send('clipboard:write', sel);
      term.clearSelection();
      return;
    }
    const text = await api.invoke('clipboard:read');
    if (text && tab.status === 'connected') api.send('ssh:write', id, text);
  });

  const ro = new ResizeObserver(() => {
    if (host.classList.contains('active') && fit) {
      try { fit.fit(); } catch { /* 레이아웃 전환 중 */ }
    }
  });
  ro.observe(host);
  tab.ro = ro;

  renderTabs();
  activateTab(id);
  return tab;
}

/** 다음/이전 탭으로 순환 */
function cycleTab(backwards) {
  const ids = Array.from(state.tabs.keys());
  if (ids.length < 2) return;
  const i = ids.indexOf(state.activeTab);
  const next = backwards ? (i - 1 + ids.length) % ids.length : (i + 1) % ids.length;
  activateTab(ids[next]);
}

function activateTab(id) {
  state.activeTab = id;
  for (const [tid, tab] of state.tabs) {
    tab.host.classList.toggle('active', tid === id);
  }
  const tab = state.tabs.get(id);
  $('#welcome').classList.toggle('hidden', state.tabs.size > 0);
  if (tab) {
    setTimeout(() => {
      if (tab.fit) {
        try { tab.fit.fit(); } catch { /* noop */ }
      }
      tab.term.focus();
    }, 0);
  }
  renderTabs();
  renderStatus();
}

function closeTab(id, force) {
  const tab = state.tabs.get(id);
  if (!tab) return;
  if (!force && tab.status === 'connected') {
    confirmModal(t('menu.closeTab'), t('session.closeTabConfirm', { name: tab.name }), () => closeTab(id, true));
    return;
  }
  api.invoke('ssh:close', id);
  if (tab.ro) tab.ro.disconnect();
  tab.term.dispose();
  tab.host.remove();
  state.tabs.delete(id);

  if (state.activeTab === id) {
    const next = Array.from(state.tabs.keys()).pop() || null;
    state.activeTab = next;
    if (next) activateTab(next);
  }
  $('#welcome').classList.toggle('hidden', state.tabs.size > 0);
  renderTabs();
  renderStatus();
}

function renderTabs() {
  const wrap = $('#tabs');
  wrap.innerHTML = '';
  for (const tab of state.tabs.values()) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === state.activeTab ? ' active' : '');
    el.style.borderTopColor = tab.id === state.activeTab ? tab.color : 'transparent';
    el.innerHTML =
      '<span class="state ' + esc(tab.status) + '"></span>' +
      '<span class="ico">' + (tab.icon === 'game' ? '🎮' : tab.icon === 'other' ? '◆' : '🖥') + '</span>' +
      '<span class="label">' + esc(tab.name) + '</span>' +
      '<button class="x" title="' + esc(t('menu.closeTab')) + '">✕</button>';
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('x')) {
        closeTab(tab.id);
        return;
      }
      activateTab(tab.id);
    });
    const label = $('.label', el);
    label.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      label.contentEditable = 'true';
      label.focus();
      document.execCommand('selectAll', false, null);
      const finish = () => {
        label.contentEditable = 'false';
        const v = label.textContent.trim();
        tab.name = v || t('session.tabDefault');
        renderTabs();
      };
      label.addEventListener('blur', finish, { once: true });
      label.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          label.blur();
        }
      });
    });
    wrap.appendChild(el);
  }
}

/* ------------------------------------------------------------------ */
/* 상태 표시줄                                                          */
/* ------------------------------------------------------------------ */
function statusLabel(tab) {
  if (!tab) return t('status.notConnected');
  switch (tab.status) {
    case 'connected': return t('status.connected');
    case 'connecting': return t('status.connecting');
    case 'reconnecting': return t('status.reconnecting', { attempt: tab.retryAttempt || 1, max: tab.retryMax || 5 });
    case 'error': return t('status.error');
    case 'give-up': return t('status.giveUp');
    case 'disconnected': return t('status.disconnected');
    default: return t('status.idle');
  }
}

function fmtUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h + ':' + m + ':' + ss;
}

function renderStatus() {
  const tab = activeTab();
  const pill = $('#st-status');
  pill.textContent = statusLabel(tab);
  pill.className = 'pill ' + (tab ? tab.status : '');
  $('#st-host').textContent = tab && tab.cfg ? t('status.host') + ': ' + tab.cfg.username + '@' + tab.cfg.host + ':' + (tab.cfg.port || 22) : '';
  $('#st-encoding').textContent = tab && tab.encoding ? t('status.encoding') + ': ' + (tab.encoding === 'euc-kr' ? 'EUC-KR' : tab.encoding.toUpperCase()) : '';
  $('#st-uptime').textContent = tab && tab.connectedAt && tab.status === 'connected' ? t('status.uptime') + ': ' + fmtUptime(Date.now() - tab.connectedAt) : '';
  $('#st-commands').textContent = tab && tab.commandCount ? t('status.commands') + ': ' + tab.commandCount : '';
}

/* ------------------------------------------------------------------ */
/* 세션 사이드바                                                        */
/* ------------------------------------------------------------------ */
async function reloadSessions() {
  state.sessions = await api.invoke('sessions:list');
  renderSessions();
}

function renderSessions() {
  const ul = $('#session-list');
  ul.innerHTML = '';
  if (!state.sessions.length) {
    const li = document.createElement('li');
    li.className = 'session-empty';
    li.textContent = t('session.empty');
    ul.appendChild(li);
    return;
  }
  for (const s of state.sessions) {
    const li = document.createElement('li');
    li.innerHTML =
      '<span class="dot" style="background:' + esc(s.color || '#4ea1ff') + '"></span>' +
      '<span class="meta"><span class="nm">' + esc(s.name || s.host) + '</span>' +
      '<span class="sub">' + esc((s.username || '') + '@' + (s.host || '') + ':' + (s.port || 22)) + '</span></span>' +
      '<span class="acts">' +
      '<button data-act="edit" title="' + esc(t('common.edit')) + '">✎</button>' +
      '<button data-act="dup" title="' + esc(t('session.duplicate')) + '">⧉</button>' +
      '<button data-act="del" title="' + esc(t('common.delete')) + '">🗑</button>' +
      '</span>';
    li.addEventListener('click', (e) => {
      const act = e.target && e.target.dataset ? e.target.dataset.act : null;
      if (act === 'edit') {
        e.stopPropagation();
        openConnectDialog(s, true);
      } else if (act === 'dup') {
        e.stopPropagation();
        api.invoke('sessions:duplicate', s.id, (s.name || s.host) + t('session.copySuffix')).then(reloadSessions);
      } else if (act === 'del') {
        e.stopPropagation();
        confirmModal(t('common.delete'), t('session.deleteConfirm', { name: s.name || s.host }), async () => {
          await api.invoke('sessions:delete', s.id);
          await reloadSessions();
          toast(t('msg.sessionDeleted'), 'success');
        });
      } else {
        connectSaved(s);
      }
    });
    ul.appendChild(li);
  }
}

/* ------------------------------------------------------------------ */
/* 연결                                                                 */
/* ------------------------------------------------------------------ */
async function ensureVaultUnlocked() {
  state.vault = await api.invoke('vault:status');
  if (state.vault.masterEnabled && !state.vault.unlocked) {
    openUnlockDialog();
    return false;
  }
  return true;
}

async function connectSaved(s) {
  if (!(await ensureVaultUnlocked())) return;
  const tab = createTab({ name: s.name || s.host, color: s.color, icon: s.icon });
  tab.cfg = { host: s.host, port: s.port || 22, username: s.username };
  tab.encoding = s.encoding && s.encoding !== 'inherit' ? s.encoding : state.settings.encoding;
  tab.status = 'connecting';
  renderTabs();
  renderStatus();
  await api.invoke('ssh:connect', tab.id, {
    sessionId: s.id,
    cols: tab.term.cols,
    rows: tab.term.rows
  });
}

async function connectDirect(cfg) {
  if (!(await ensureVaultUnlocked())) return;
  const tab = createTab({ name: cfg.name || cfg.host, color: cfg.color, icon: cfg.icon });
  tab.cfg = { host: cfg.host, port: cfg.port, username: cfg.username };
  tab.encoding = cfg.encoding && cfg.encoding !== 'inherit' ? cfg.encoding : state.settings.encoding;
  tab.status = 'connecting';
  renderTabs();
  renderStatus();
  await api.invoke('ssh:connect', tab.id, { ...cfg, cols: tab.term.cols, rows: tab.term.rows });
}

/* ------------------------------------------------------------------ */
/* 연결 / 세션 편집 다이얼로그                                           */
/* ------------------------------------------------------------------ */
function openConnectDialog(session, editOnly) {
  const s = session || {};
  const encOpts = [
    ['inherit', t('settings.encoding') + ' (' + t('encoding.auto') + ')'],
    ['auto', t('encoding.auto')],
    ['utf8', 'UTF-8'],
    ['euc-kr', 'EUC-KR (CP949)']
  ];
  const html =
    '<div class="field"><label>' + esc(t('connect.name')) + '</label>' +
    '<input id="f-name" value="' + esc(s.name || '') + '" placeholder="' + esc(t('connect.placeholderName')) + '"></div>' +
    '<div class="row">' +
    '<div class="field"><label>' + esc(t('connect.host')) + '</label>' +
    '<input id="f-host" value="' + esc(s.host || '') + '" placeholder="' + esc(t('connect.placeholderHost')) + '"></div>' +
    '<div class="field small"><label>' + esc(t('connect.port')) + '</label>' +
    '<input id="f-port" type="number" min="1" max="65535" value="' + esc(s.port || 22) + '"></div>' +
    '</div>' +
    '<div class="row">' +
    '<div class="field"><label>' + esc(t('connect.username')) + '</label>' +
    '<input id="f-user" value="' + esc(s.username || '') + '"></div>' +
    '<div class="field"><label>' + esc(t('connect.authType')) + '</label>' +
    '<select id="f-auth">' +
    '<option value="password">' + esc(t('connect.authPassword')) + '</option>' +
    '<option value="key">' + esc(t('connect.authKey')) + '</option>' +
    '<option value="agent">' + esc(t('connect.authAgent')) + '</option>' +
    '</select></div>' +
    '</div>' +
    '<div class="field" id="wrap-pw"><label>' + esc(t('connect.password')) + '</label>' +
    '<input id="f-pw" type="password" placeholder="' + (s.hasPassword ? '••••••••' : '') + '"></div>' +
    '<div class="field hidden" id="wrap-key"><label>' + esc(t('connect.keyFile')) + '</label>' +
    '<div class="inline"><input id="f-key" value="' + esc(s.keyPath || '') + '">' +
    '<button id="btn-pick-key">' + esc(t('common.browse')) + '</button></div>' +
    '<label style="margin-top:8px">' + esc(t('connect.passphrase')) + '</label>' +
    '<input id="f-pass" type="password" placeholder="' + (s.hasPassphrase ? '••••••••' : '') + '"></div>' +
    '<div class="check"><input type="checkbox" id="f-savepw"' + (s.hasPassword || s.hasPassphrase ? ' checked' : '') + '>' +
    '<label for="f-savepw">' + esc(t('connect.savePassword')) + '</label></div>' +
    '<div class="section-title">' + esc(t('connect.advanced')) + '</div>' +
    '<div class="row">' +
    '<div class="field"><label>' + esc(t('connect.encoding')) + '</label><select id="f-enc">' +
    encOpts.map((o) => '<option value="' + o[0] + '"' + ((s.encoding || 'inherit') === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') +
    '</select></div>' +
    '<div class="field small"><label>' + esc(t('connect.color')) + '</label>' +
    '<input id="f-color" type="color" value="' + esc(s.color || '#4ea1ff') + '"></div>' +
    '<div class="field small"><label>' + esc(t('connect.icon')) + '</label><select id="f-icon">' +
    '<option value="server"' + (s.icon === 'server' || !s.icon ? ' selected' : '') + '>' + esc(t('connect.iconServer')) + '</option>' +
    '<option value="game"' + (s.icon === 'game' ? ' selected' : '') + '>' + esc(t('connect.iconGame')) + '</option>' +
    '<option value="other"' + (s.icon === 'other' ? ' selected' : '') + '>' + esc(t('connect.iconOther')) + '</option>' +
    '</select></div>' +
    '</div>' +
    '<div class="check"><input type="checkbox" id="f-autorc"' + (s.autoReconnect === false ? '' : ' checked') + '>' +
    '<label for="f-autorc">' + esc(t('connect.autoReconnect')) + '</label></div>' +
    (editOnly ? '' :
      '<div class="check"><input type="checkbox" id="f-save"' + (s.id ? ' checked' : '') + '>' +
      '<label for="f-save">' + esc(t('connect.saveSession')) + '</label></div>') +
    '<p class="note" id="vault-note"></p>';

  const readForm = (body) => ({
    id: s.id,
    name: $('#f-name', body).value.trim() || $('#f-host', body).value.trim(),
    host: $('#f-host', body).value.trim(),
    port: parseInt($('#f-port', body).value, 10) || 22,
    username: $('#f-user', body).value.trim(),
    authType: $('#f-auth', body).value,
    password: $('#f-pw', body).value,
    keyPath: $('#f-key', body).value.trim(),
    passphrase: $('#f-pass', body).value,
    encoding: $('#f-enc', body).value,
    color: $('#f-color', body).value,
    icon: $('#f-icon', body).value,
    autoReconnect: $('#f-autorc', body).checked,
    savePw: $('#f-savepw', body).checked
  });

  const validate = (f) => {
    if (!f.host) {
      toast(t('msg.hostRequired'), 'warn');
      return false;
    }
    if (!f.username && f.authType !== 'agent') {
      toast(t('msg.userRequired'), 'warn');
      return false;
    }
    return true;
  };

  const persist = async (f) => {
    const payload = {
      id: f.id,
      name: f.name,
      host: f.host,
      port: f.port,
      username: f.username,
      authType: f.authType,
      keyPath: f.keyPath,
      encoding: f.encoding,
      color: f.color,
      icon: f.icon,
      autoReconnect: f.autoReconnect
    };
    if (f.savePw) {
      if (f.password) payload.password = f.password;
      if (f.passphrase) payload.passphrase = f.passphrase;
    } else {
      payload.password = '';
      payload.passphrase = '';
    }
    const res = await api.invoke('sessions:save', payload);
    if (!res.ok) {
      if (res.error === 'NO_ENCRYPTION_BACKEND') toast(t('msg.noEncryptionBackend'), 'error', 9000);
      else if (res.error === 'VAULT_LOCKED') toast(t('msg.vaultLocked'), 'error');
      else toast(String(res.error), 'error');
      return null;
    }
    await reloadSessions();
    toast(t('msg.sessionSaved'), 'success');
    return res.id;
  };

  const buttons = editOnly
    ? [
        { label: t('common.cancel') },
        {
          label: t('common.save'),
          kind: 'primary',
          onClick: async (close, body) => {
            const f = readForm(body);
            if (!validate(f)) return;
            if (await persist(f)) close();
          }
        }
      ]
    : [
        { label: t('common.cancel') },
        {
          label: t('connect.connectBtn'),
          kind: 'primary',
          onClick: async (close, body) => {
            const f = readForm(body);
            if (!validate(f)) return;
            let sessionId = null;
            if ($('#f-save', body) && $('#f-save', body).checked) sessionId = await persist(f);
            close();
            if (sessionId) connectSaved(state.sessions.find((x) => x.id === sessionId) || f);
            else connectDirect(f);
          }
        }
      ];

  openModal({
    title: editOnly ? t('connect.editTitle') : t('connect.title'),
    bodyHtml: html,
    buttons,
    onMount: (body) => {
      const auth = $('#f-auth', body);
      auth.value = s.authType || 'password';
      const sync = () => {
        $('#wrap-pw', body).classList.toggle('hidden', auth.value !== 'password');
        $('#wrap-key', body).classList.toggle('hidden', auth.value !== 'key');
      };
      auth.addEventListener('change', sync);
      sync();
      $('#btn-pick-key', body).addEventListener('click', async () => {
        const p = await api.invoke('dialog:pickKeyFile');
        if (p) $('#f-key', body).value = p;
      });
      if (!state.vault.canStore) {
        $('#vault-note', body).textContent = t('msg.noEncryptionBackend');
        $('#vault-note', body).className = 'note warn';
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/* 설정 다이얼로그                                                      */
/* ------------------------------------------------------------------ */
function openSettingsDialog() {
  const s = state.settings;
  const fontOpts = ['', ...state.fonts]
    .map((f) => '<option value="' + esc(f) + '"' + (s.fontFamily === f ? ' selected' : '') + '>' + esc(f || t('common.none')) + '</option>')
    .join('');

  const html =
    '<div class="section-title">' + esc(t('settings.general')) + '</div>' +
    '<div class="row">' +
    '<div class="field"><label>' + esc(t('settings.language')) + '</label><select id="s-lang">' +
    '<option value="auto">' + esc(t('language.auto')) + '</option>' +
    '<option value="ko">' + esc(t('language.ko')) + '</option>' +
    '<option value="en">' + esc(t('language.en')) + '</option>' +
    '<option value="ja">' + esc(t('language.ja')) + '</option>' +
    '<option value="zh-CN">' + esc(t('language.zhCN')) + '</option>' +
    '<option value="de">' + esc(t('language.de')) + '</option>' +
    '</select></div>' +
    '<div class="field"><label>' + esc(t('settings.theme')) + '</label><select id="s-theme">' +
    '<option value="dark"' + (s.theme === 'dark' ? ' selected' : '') + '>' + esc(t('settings.dark')) + '</option>' +
    '<option value="light"' + (s.theme === 'light' ? ' selected' : '') + '>' + esc(t('settings.light')) + '</option>' +
    '</select></div></div>' +
    '<div class="check"><input type="checkbox" id="s-updates"' + (s.checkUpdates ? ' checked' : '') + '>' +
    '<label for="s-updates">' + esc(t('settings.checkUpdates')) + '</label></div>' +

    '<div class="section-title">' + esc(t('settings.appearance')) + '</div>' +
    '<div class="row">' +
    '<div class="field"><label>' + esc(t('settings.fontFamily')) + '</label><select id="s-font">' + fontOpts + '</select></div>' +
    '<div class="field small"><label>' + esc(t('settings.fontSize')) + '</label>' +
    '<input id="s-fontsize" type="number" min="8" max="20" value="' + esc(s.fontSize) + '"></div>' +
    '</div>' +
    '<p class="note">' + esc(t('settings.fontHint')) + '</p>' +

    '<div class="section-title">' + esc(t('settings.terminal')) + '</div>' +
    '<div class="row">' +
    '<div class="field"><label>' + esc(t('settings.scrollback')) + '</label>' +
    '<input id="s-scrollback" type="number" min="100" max="100000" step="100" value="' + esc(s.scrollback) + '"></div>' +
    '<div class="field"><label>' + esc(t('settings.encoding')) + '</label><select id="s-enc">' +
    '<option value="auto"' + (s.encoding === 'auto' ? ' selected' : '') + '>' + esc(t('encoding.auto')) + '</option>' +
    '<option value="utf8"' + (s.encoding === 'utf8' ? ' selected' : '') + '>UTF-8</option>' +
    '<option value="euc-kr"' + (s.encoding === 'euc-kr' ? ' selected' : '') + '>EUC-KR (CP949)</option>' +
    '</select></div></div>' +
    '<div class="check"><input type="checkbox" id="s-blink"' + (s.cursorBlink ? ' checked' : '') + '><label for="s-blink">' + esc(t('settings.cursorBlink')) + '</label></div>' +
    '<div class="check"><input type="checkbox" id="s-copysel"' + (s.copyOnSelect ? ' checked' : '') + '><label for="s-copysel">' + esc(t('settings.copyOnSelect')) + '</label></div>' +
    '<div class="check"><input type="checkbox" id="s-rclick"' + (s.rightClickPaste ? ' checked' : '') + '><label for="s-rclick">' + esc(t('settings.rightClickPaste')) + '</label></div>' +
    '<div class="check"><input type="checkbox" id="s-quickbar"' + (s.showQuickBar ? ' checked' : '') + '><label for="s-quickbar">' + esc(t('settings.showQuickBar')) + '</label></div>' +

    '<div class="section-title">' + esc(t('settings.connection')) + '</div>' +
    '<div class="check"><input type="checkbox" id="s-keepalive"' + (s.keepAlive ? ' checked' : '') + '><label for="s-keepalive">' + esc(t('settings.keepAlive')) + '</label></div>' +
    '<div class="row">' +
    '<div class="field"><label>' + esc(t('settings.keepAliveInterval')) + '</label>' +
    '<input id="s-kainterval" type="number" min="5" max="600" value="' + esc(s.keepAliveInterval) + '"></div>' +
    '<div class="field"><label>' + esc(t('settings.connectTimeout')) + '</label>' +
    '<input id="s-timeout" type="number" min="0" max="600" value="' + esc(s.connectTimeout) + '"></div>' +
    '</div>' +
    '<div class="check"><input type="checkbox" id="s-autorc"' + (s.autoReconnect ? ' checked' : '') + '><label for="s-autorc">' + esc(t('settings.autoReconnect')) + '</label></div>' +
    '<div class="field"><label>' + esc(t('settings.maxRetries')) + '</label>' +
    '<input id="s-retries" type="number" min="1" max="20" value="' + esc(s.reconnectMaxRetries) + '"></div>' +
    '<div class="check"><input type="checkbox" id="s-localeenv"' + (s.sendLocaleEnv ? ' checked' : '') + '><label for="s-localeenv">' + esc(t('settings.sendLocaleEnv')) + '</label></div>' +

    '<div class="section-title">' + esc(t('settings.security')) + '</div>' +
    '<p class="note" id="s-vault"></p>' +
    '<div class="inline"><button id="s-master-set">' + esc(t('settings.masterPasswordSet')) + '</button>' +
    '<button id="s-master-del" class="danger">' + esc(t('settings.masterPasswordRemove')) + '</button></div>';

  openModal({
    title: t('settings.title'),
    bodyHtml: html,
    wide: true,
    buttons: [
      { label: t('common.cancel') },
      {
        label: t('common.save'),
        kind: 'primary',
        onClick: async (close, body) => {
          const patch = {
            language: $('#s-lang', body).value,
            theme: $('#s-theme', body).value,
            checkUpdates: $('#s-updates', body).checked,
            fontFamily: $('#s-font', body).value,
            fontSize: parseInt($('#s-fontsize', body).value, 10) || 14,
            scrollback: parseInt($('#s-scrollback', body).value, 10) || 1000,
            encoding: $('#s-enc', body).value,
            cursorBlink: $('#s-blink', body).checked,
            copyOnSelect: $('#s-copysel', body).checked,
            rightClickPaste: $('#s-rclick', body).checked,
            showQuickBar: $('#s-quickbar', body).checked,
            keepAlive: $('#s-keepalive', body).checked,
            keepAliveInterval: parseInt($('#s-kainterval', body).value, 10) || 60,
            connectTimeout: parseInt($('#s-timeout', body).value, 10) || 0,
            autoReconnect: $('#s-autorc', body).checked,
            reconnectMaxRetries: parseInt($('#s-retries', body).value, 10) || 5,
            sendLocaleEnv: $('#s-localeenv', body).checked
          };
          state.settings = await api.invoke('settings:set', patch);
          applySettings();
          close();
        }
      }
    ],
    onMount: (body) => {
      $('#s-lang', body).value = s.language || 'auto';
      const note = $('#s-vault', body);
      note.textContent = state.vault.masterEnabled
        ? t('settings.masterPasswordOn')
        : t('settings.masterPasswordOff') + (state.vault.safeStorage ? '' : ' — ' + t('msg.noEncryptionBackend'));
      $('#s-master-set', body).addEventListener('click', () => openMasterPasswordDialog());
      $('#s-master-del', body).addEventListener('click', async () => {
        await api.invoke('vault:setMaster', null);
        state.vault = await api.invoke('vault:status');
        note.textContent = t('settings.masterPasswordOff');
        toast(t('msg.masterRemoved'), 'success');
      });
    }
  });
}

/* ------------------------------------------------------------------ */
/* 마스터 비밀번호                                                       */
/* ------------------------------------------------------------------ */
function openMasterPasswordDialog() {
  openModal({
    title: t('settings.masterPassword'),
    bodyHtml:
      '<div class="field"><label>' + esc(t('settings.newPassword')) + '</label><input id="m-pw1" type="password"></div>' +
      '<div class="field"><label>' + esc(t('settings.confirmPassword')) + '</label><input id="m-pw2" type="password"></div>' +
      '<p class="note">' + esc(t('help.s6body')) + '</p>',
    buttons: [
      { label: t('common.cancel') },
      {
        label: t('common.save'),
        kind: 'primary',
        onClick: async (close, body) => {
          const a = $('#m-pw1', body).value;
          const b = $('#m-pw2', body).value;
          if (a.length < 8) {
            toast(t('msg.passwordTooShort'), 'warn');
            return;
          }
          if (a !== b) {
            toast(t('msg.passwordMismatch'), 'warn');
            return;
          }
          await api.invoke('vault:setMaster', a);
          state.vault = await api.invoke('vault:status');
          toast(t('msg.masterSet'), 'success');
          close();
        }
      }
    ]
  });
}

function openUnlockDialog() {
  openModal({
    title: t('settings.unlock'),
    bodyHtml: '<div class="field"><label>' + esc(t('settings.masterPassword')) + '</label><input id="u-pw" type="password"></div>',
    buttons: [
      { label: t('common.cancel') },
      {
        label: t('settings.unlock'),
        kind: 'primary',
        onClick: async (close, body) => {
          const res = await api.invoke('vault:unlock', $('#u-pw', body).value);
          if (!res.ok) {
            toast(t('msg.unlockFailed'), 'error');
            return;
          }
          state.vault = await api.invoke('vault:status');
          close();
        }
      }
    ]
  });
}

/* ------------------------------------------------------------------ */
/* 빠른 명령어                                                          */
/* ------------------------------------------------------------------ */
function quickLabel(q) {
  return q.labelKey ? t(q.labelKey) : q.label || '';
}

function renderQuickBar() {
  const bar = $('#quickbar');
  bar.innerHTML = '';
  bar.classList.toggle('hidden', !state.settings.showQuickBar);
  for (const q of state.settings.quickCommands) {
    const b = document.createElement('button');
    b.textContent = quickLabel(q);
    b.title = q.command;
    b.addEventListener('click', () => runQuickCommand(q.command));
    bar.appendChild(b);
  }
  const edit = document.createElement('button');
  edit.className = 'qc-edit';
  edit.textContent = '⚙ ' + t('menu.quickCommands');
  edit.addEventListener('click', openQuickCommandsDialog);
  bar.appendChild(edit);
}

function runQuickCommand(cmd) {
  const tab = activeTab();
  if (!tab || tab.status !== 'connected') {
    toast(t('status.notConnected'), 'warn');
    return;
  }
  tab.commandCount += 1;
  api.send('ssh:write', tab.id, cmd + '\r');
  tab.term.focus();
}

function openQuickCommandsDialog() {
  const rows = state.settings.quickCommands
    .map(
      (q, i) =>
        '<li data-i="' + i + '">' +
        '<input class="qc-label" value="' + esc(quickLabel(q)) + '">' +
        '<input class="qc-cmd" value="' + esc(q.command) + '">' +
        '<button class="qc-del danger">✕</button></li>'
    )
    .join('');
  openModal({
    title: t('quick.editTitle'),
    wide: true,
    bodyHtml:
      '<p class="note">' + esc(t('quick.hint')) + '</p>' +
      '<ul class="qc-list" id="qc-list">' + rows + '</ul>' +
      '<button id="qc-add">+ ' + esc(t('quick.addButton')) + '</button>',
    buttons: [
      { label: t('common.cancel') },
      {
        label: t('common.save'),
        kind: 'primary',
        onClick: async (close, body) => {
          const list = $$('#qc-list li', body).map((li, i) => ({
            id: 'qc-' + i,
            label: $('.qc-label', li).value.trim(),
            command: $('.qc-cmd', li).value
          })).filter((q) => q.label && q.command);
          state.settings = await api.invoke('settings:set', { quickCommands: list });
          renderQuickBar();
          close();
        }
      }
    ],
    onMount: (body) => {
      const list = $('#qc-list', body);
      list.addEventListener('click', (e) => {
        if (e.target.classList.contains('qc-del')) e.target.closest('li').remove();
      });
      $('#qc-add', body).addEventListener('click', () => {
        const li = document.createElement('li');
        li.innerHTML = '<input class="qc-label" placeholder="' + esc(t('quick.label')) + '">' +
          '<input class="qc-cmd" placeholder="' + esc(t('quick.command')) + '">' +
          '<button class="qc-del danger">✕</button>';
        list.appendChild(li);
      });
    }
  });
}

/* ------------------------------------------------------------------ */
/* 도움말 / 라이선스                                                     */
/* ------------------------------------------------------------------ */
function openHelpDialog() {
  let html = '<div class="doc">';
  for (let i = 1; i <= 8; i++) {
    html += '<h3>' + esc(t('help.s' + i + 'title')) + '</h3><p>' + esc(t('help.s' + i + 'body')) + '</p>';
  }
  html += '<h3>' + esc(t('about.developedBy')) + '</h3><p>' + esc(t('about.copyright')) + '\n' + esc(t('about.license')) + '</p></div>';
  openModal({ title: t('help.title'), bodyHtml: html, wide: true, buttons: [{ label: t('common.close'), kind: 'primary' }] });
}

const MIT_TEXT =
  'MIT License\n\n' +
  'Copyright (c) 2026 Yeoulgame (https://yeoulgame.com)\n\n' +
  'Permission is hereby granted, free of charge, to any person obtaining a copy\n' +
  'of this software and associated documentation files (the "Software"), to deal\n' +
  'in the Software without restriction, including without limitation the rights\n' +
  'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n' +
  'copies of the Software, and to permit persons to whom the Software is\n' +
  'furnished to do so, subject to the following conditions:\n\n' +
  'The above copyright notice and this permission notice shall be included in all\n' +
  'copies or substantial portions of the Software.\n\n' +
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n' +
  'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n' +
  'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n' +
  'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n' +
  'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n' +
  'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\n' +
  'SOFTWARE.';

function openLicenseDialog() {
  openModal({
    title: t('menu.licenseMenu'),
    wide: true,
    bodyHtml: '<div class="doc"><pre>' + esc(MIT_TEXT) + '</pre></div>',
    buttons: [
      { label: 'opensource.org/licenses/MIT', onClick: () => api.invoke('shell:open', 'https://opensource.org/licenses/MIT') },
      { label: t('common.close'), kind: 'primary' }
    ]
  });
}

/* ------------------------------------------------------------------ */
/* 찾기 바                                                              */
/* ------------------------------------------------------------------ */
function toggleFind(show) {
  const bar = $('#findbar');
  const visible = show === undefined ? bar.classList.contains('hidden') : show;
  bar.classList.toggle('hidden', !visible);
  if (visible) $('#find-input').focus();
  else {
    const tab = activeTab();
    if (tab) tab.term.focus();
  }
}

function doFind(dir) {
  const tab = activeTab();
  if (!tab || !tab.search) return;
  const q = $('#find-input').value;
  if (!q) return;
  const opts = { caseSensitive: false, incremental: false };
  if (dir < 0) tab.search.findPrevious(q, opts);
  else tab.search.findNext(q, opts);
}

/* ------------------------------------------------------------------ */
/* 설정 적용                                                            */
/* ------------------------------------------------------------------ */
function applySettings() {
  applyTheme();
  for (const tab of state.tabs.values()) {
    tab.term.options.fontFamily = terminalFont();
    tab.term.options.fontSize = state.settings.fontSize;
    tab.term.options.scrollback = state.settings.scrollback;
    tab.term.options.cursorBlink = !!state.settings.cursorBlink;
    if (tab.fit) {
      try { tab.fit.fit(); } catch { /* noop */ }
    }
  }
  renderQuickBar();
  renderStatus();
}

function applyI18n() {
  document.documentElement.lang = state.lang;
  for (const el of $$('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  $('#find-input').placeholder = t('common.search');
  renderSessions();
  renderQuickBar();
  renderStatus();
  renderTabs();
  if (!state.fullSupport) {
    toast(t('language.uiOnlyNotice'), 'warn', 8000);
  }
}

/* ------------------------------------------------------------------ */
/* SSH 이벤트                                                           */
/* ------------------------------------------------------------------ */
function handleSshEvent(ev) {
  const tab = state.tabs.get(ev.id);
  if (!tab) return;

  if (ev.type === 'data') {
    tab.term.write(ev.data);
    if (ev.encoding && ev.encoding !== tab.encoding) {
      tab.encoding = ev.encoding;
      if (tab.id === state.activeTab) renderStatus();
    }
    return;
  }

  if (ev.type === 'hostkey') {
    if (ev.state === 'new') toast(t('msg.hostKeyNew', { fingerprint: ev.fingerprint }), 'info', 8000);
    else if (ev.state === 'changed') toast(t('msg.hostKeyChanged'), 'error', 15000);
    return;
  }

  if (ev.type === 'status') {
    tab.status = ev.status;
    if (ev.encoding) tab.encoding = ev.encoding;

    if (ev.status === 'connected') {
      tab.connectedAt = ev.connectedAt || Date.now();
      tab.cfg = { host: ev.host, port: ev.port, username: ev.username };
      if (tab.fit) {
        try {
          tab.fit.fit();
          api.send('ssh:resize', tab.id, tab.term.cols, tab.term.rows);
        } catch { /* noop */ }
      }
      if (!koreanGlyphAvailable(terminalFont())) toast(t('msg.fontMissing'), 'warn', 9000);
    } else if (ev.status === 'error') {
      const detail = ev.message || '';
      if (/All configured authentication methods failed/i.test(detail)) toast(t('msg.authFailed'), 'error');
      else if (/ENOTFOUND|ECONNREFUSED|EHOSTUNREACH|ETIMEDOUT/i.test(ev.code || detail)) toast(t('msg.hostUnreachable'), 'error');
      else if (detail === 'KEY_READ_FAILED') toast(t('msg.keyReadFailed'), 'error');
      else toast(t('msg.connectFailed', { detail }), 'error', 8000);
      tab.term.write('\r\n\x1b[31m*** ' + statusLabel(tab) + ': ' + detail + '\x1b[0m\r\n');
    } else if (ev.status === 'reconnecting') {
      tab.retryAttempt = ev.attempt;
      tab.retryMax = ev.max;
      tab.term.write('\r\n\x1b[33m*** ' + t('msg.reconnecting', { delay: Math.round((ev.delay || 2000) / 1000), attempt: ev.attempt, max: ev.max }) + '\x1b[0m\r\n');
    } else if (ev.status === 'give-up') {
      tab.term.write('\r\n\x1b[31m*** ' + t('msg.giveUp', { max: tab.retryMax || 5 }) + '\x1b[0m\r\n');
    } else if (ev.status === 'disconnected') {
      tab.connectedAt = null;
    }

    renderTabs();
    if (tab.id === state.activeTab) renderStatus();
  }
}

/* ------------------------------------------------------------------ */
/* 메뉴 액션                                                            */
/* ------------------------------------------------------------------ */
async function handleMenuAction(msg) {
  const tab = activeTab();
  const p = msg.payload || {};
  switch (msg.action) {
    case 'new-tab': createTab({}); break;
    case 'close-tab': if (tab) closeTab(tab.id); break;
    case 'new-connection': openConnectDialog(null, false); break;
    case 'save-session':
      if (tab && tab.cfg) openConnectDialog({ name: tab.name, host: tab.cfg.host, port: tab.cfg.port, username: tab.cfg.username, color: tab.color, icon: tab.icon }, true);
      else openConnectDialog(null, true);
      break;
    case 'import-sessions': {
      const r = await api.invoke('sessions:import');
      if (r.ok) {
        await reloadSessions();
        toast(t('msg.importDone', { count: r.count }), 'success');
      }
      break;
    }
    case 'export-sessions': {
      const r = await api.invoke('sessions:export');
      if (r.ok) toast(t('msg.exportDone'), 'success');
      break;
    }
    case 'copy': {
      if (!tab) break;
      const sel = tab.term.getSelection();
      if (!sel) {
        toast(t('msg.nothingSelected'), 'warn');
        break;
      }
      api.send('clipboard:write', sel);
      toast(t('msg.copied'), 'success', 1800);
      break;
    }
    case 'paste': {
      if (!tab || tab.status !== 'connected') break;
      const text = await api.invoke('clipboard:read');
      if (text) api.send('ssh:write', tab.id, text);
      break;
    }
    case 'select-all': if (tab) tab.term.selectAll(); break;
    case 'find': toggleFind(true); break;
    case 'clear': if (tab) tab.term.clear(); break;
    case 'theme':
      state.settings = await api.invoke('settings:set', { theme: p.theme });
      applySettings();
      break;
    case 'font-size': {
      const size = p.reset ? 14 : Math.min(20, Math.max(8, state.settings.fontSize + (p.delta || 0)));
      state.settings = await api.invoke('settings:set', { fontSize: size });
      applySettings();
      break;
    }
    case 'toggle-sidebar': $('#sidebar').classList.toggle('collapsed'); setTimeout(() => tab && tab.fit && tab.fit.fit(), 30); break;
    case 'toggle-quickbar':
      state.settings = await api.invoke('settings:set', { showQuickBar: !state.settings.showQuickBar });
      renderQuickBar();
      setTimeout(() => tab && tab.fit && tab.fit.fit(), 30);
      break;
    case 'refresh-terminal':
      if (tab) {
        tab.term.refresh(0, tab.term.rows - 1);
        if (tab.fit) tab.fit.fit();
      }
      break;
    case 'connect': openConnectDialog(null, false); break;
    case 'disconnect': if (tab) api.invoke('ssh:disconnect', tab.id); break;
    case 'reconnect': if (tab) api.invoke('ssh:reconnect', tab.id); break;
    case 'encoding':
      if (tab) {
        await api.invoke('ssh:encoding', tab.id, p.mode);
        tab.encoding = p.mode === 'auto' ? 'auto' : p.mode;
        renderStatus();
      }
      break;
    case 'settings': openSettingsDialog(); break;
    case 'quick-commands': openQuickCommandsDialog(); break;
    case 'master-password': openMasterPasswordDialog(); break;
    case 'help': openHelpDialog(); break;
    case 'license': openLicenseDialog(); break;
    case 'check-updates': checkUpdates(true); break;
    default: break;
  }
}

async function checkUpdates(verbose) {
  const r = await api.invoke('update:check');
  if (r.status === 'update-available') toast(t('msg.updateAvailable', { version: r.latest }), 'warn', 12000);
  else if (verbose && r.status === 'up-to-date') toast(t('msg.upToDate'), 'success');
  else if (verbose) toast(t('msg.updateCheckFailed'), 'error');
}

/* ------------------------------------------------------------------ */
/* 초기화                                                               */
/* ------------------------------------------------------------------ */
async function init() {
  if (!TerminalCtor) {
    document.body.innerHTML =
      '<div style="padding:40px;font-family:monospace">xterm.js not found. Run <b>npm install</b> first.</div>';
    return;
  }

  state.info = await api.invoke('app:info');
  state.settings = await api.invoke('settings:get');
  const bundle = await api.invoke('i18n:get');
  state.dict = bundle.dict;
  state.lang = bundle.lang;
  state.fullSupport = bundle.fullSupport;
  state.vault = await api.invoke('vault:status');
  state.fonts = await api.invoke('fonts:suggested');

  $('#welcome-version').textContent = state.info.name + ' v' + state.info.version;
  $('#st-brand').textContent = state.info.name + ' v' + state.info.version + ' · © 2026 Yeoulgame';

  applyTheme();
  applyI18n();
  applySettings();
  await reloadSessions();

  if (state.vault.masterEnabled && !state.vault.unlocked) openUnlockDialog();
  if (state.settings.checkUpdates) setTimeout(() => checkUpdates(false), 3000);

  // 이벤트 연결
  api.on('ssh:event', handleSshEvent);
  api.on('menu:action', handleMenuAction);
  api.on('i18n:changed', (b) => {
    state.dict = b.dict;
    state.lang = b.lang;
    state.fullSupport = b.fullSupport;
    applyI18n();
  });

  $('#btn-new-connection').addEventListener('click', () => openConnectDialog(null, false));
  $('#btn-welcome-connect').addEventListener('click', () => openConnectDialog(null, false));
  $('#btn-add-tab').addEventListener('click', () => createTab({}));
  $('#link-home').addEventListener('click', (e) => {
    e.preventDefault();
    api.invoke('shell:open', 'https://yeoulgame.com');
  });
  $('#find-next').addEventListener('click', () => doFind(1));
  $('#find-prev').addEventListener('click', () => doFind(-1));
  $('#find-close').addEventListener('click', () => toggleFind(false));
  $('#find-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doFind(e.shiftKey ? -1 : 1);
    if (e.key === 'Escape') toggleFind(false);
  });

  window.addEventListener('resize', () => {
    const tab = activeTab();
    if (tab && tab.fit) {
      try { tab.fit.fit(); } catch { /* noop */ }
    }
  });

  // 탭 전환 단축키 — 터미널 안쪽은 attachCustomKeyEventHandler 가 이미 처리하므로 여기서는 건너뛴다
  // (둘 다 반응하면 한 번에 두 칸씩 넘어간다)
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key !== 'Tab') return;
    const t = e.target;
    if (t && typeof t.closest === 'function' && t.closest('.term-host')) return;
    e.preventDefault();
    cycleTab(e.shiftKey);
  });

  setInterval(renderStatus, 1000);
}

document.addEventListener('DOMContentLoaded', init);
