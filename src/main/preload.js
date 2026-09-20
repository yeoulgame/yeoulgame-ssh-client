/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 * https://opensource.org/licenses/MIT
 *
 * preload.js - contextBridge 로 최소 권한 API 만 노출 (채널 허용 목록 방식)
 */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const INVOKE_CHANNELS = [
  'app:info',
  'i18n:get',
  'i18n:set',
  'settings:get',
  'settings:set',
  'sessions:list',
  'sessions:save',
  'sessions:delete',
  'sessions:duplicate',
  'sessions:reorder',
  'sessions:export',
  'sessions:import',
  'vault:status',
  'vault:unlock',
  'vault:setMaster',
  'vault:lock',
  'ssh:connect',
  'ssh:encoding',
  'ssh:disconnect',
  'ssh:reconnect',
  'ssh:close',
  'ssh:forgetHostKey',
  'dialog:pickKeyFile',
  'shell:open',
  'clipboard:read',
  'update:check',
  'window:about',
  'window:closeAbout',
  'fonts:suggested'
];

const SEND_CHANNELS = ['ssh:write', 'ssh:resize', 'clipboard:write'];
const ON_CHANNELS = ['ssh:event', 'menu:action', 'i18n:changed'];

contextBridge.exposeInMainWorld('yeoul', {
  invoke(channel, ...args) {
    if (!INVOKE_CHANNELS.includes(channel)) {
      return Promise.reject(new Error('BLOCKED_CHANNEL: ' + channel));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  send(channel, ...args) {
    if (!SEND_CHANNELS.includes(channel)) return;
    ipcRenderer.send(channel, ...args);
  },
  on(channel, listener) {
    if (!ON_CHANNELS.includes(channel)) return () => {};
    const handler = (_event, ...args) => listener(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  }
});
