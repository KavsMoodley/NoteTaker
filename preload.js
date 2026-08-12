const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notesAPI', {
  list: () => ipcRenderer.invoke('notes:list'),
  read: (id) => ipcRenderer.invoke('notes:read', id),
  create: () => ipcRenderer.invoke('notes:create'),
  save: (id, content) => ipcRenderer.invoke('notes:save', id, content),
  pin: (id, pinned) => ipcRenderer.invoke('notes:pin', id, pinned),
  rename: (id, title) => ipcRenderer.invoke('notes:rename', id, title),
  setFolder: (id, folder) => ipcRenderer.invoke('notes:setFolder', id, folder),
  setTags: (id, tags) => ipcRenderer.invoke('notes:setTags', id, tags),
  addFolder: (name) => ipcRenderer.invoke('notes:addFolder', name),
  listFolders: () => ipcRenderer.invoke('notes:listFolders'),
  del: (id) => ipcRenderer.invoke('notes:delete', id),
  search: (query) => ipcRenderer.invoke('notes:search', query),
  export: (id, format) => ipcRenderer.invoke('notes:export', id, format),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  askAI: (payload) => ipcRenderer.invoke('ai:ask', payload),
  testAI: () => ipcRenderer.invoke('ai:test'),
  onAIChunk: (cb) => ipcRenderer.on('ai:chunk', (_event, text) => cb(text)),
  onAIDone: (cb) => ipcRenderer.on('ai:done', (_event, result) => cb(result))
});

window.addEventListener('error', (e) => {
  try {
    ipcRenderer.send('renderer-error', { msg: e.message, line: e.lineno, col: e.colno });
  } catch (err) {}
});
window.addEventListener('unhandledrejection', (e) => {
  try {
    ipcRenderer.send('renderer-error', { msg: 'REJECTION: ' + (e.reason && e.reason.stack ? e.reason.stack : e.reason), line: 0 });
  } catch (err) {}
});