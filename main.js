const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const errLog = path.join(app.getPath('userData'), 'renderer-errors.log');

function logRendererError(data) {
  try {
    fs.appendFileSync(errLog, `[${new Date().toISOString()}] ${data.msg} (line ${data.line})\n`);
  } catch (err) {}
}

ipcMain.on('renderer-error', (_event, data) => logRendererError(data));

let notesIndex = [];
let notesDir;
let foldersList = [];

function notesDirEnsure() {
  notesDir = path.join(app.getPath('userData'), 'notes');
  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir, { recursive: true });
  }
  return notesDir;
}

function foldersFilePath() {
  return path.join(notesDirEnsure(), 'folders.json');
}

function loadFoldersList() {
  const file = foldersFilePath();
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      foldersList = Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      foldersList = [];
    }
  }
}

function saveFoldersList() {
  fs.writeFileSync(foldersFilePath(), JSON.stringify(foldersList, null, 2));
}

function sanitizeFolderName(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .slice(0, 30);
}

function registerFolder(name) {
  const clean = sanitizeFolderName(name);
  if (clean && !foldersList.includes(clean)) {
    foldersList.push(clean);
    saveFoldersList();
  }
  return foldersList;
}

function loadIndex() {
  const indexFile = path.join(notesDirEnsure(), 'index.json');
  if (fs.existsSync(indexFile)) {
    try {
      notesIndex = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    } catch (err) {
      notesIndex = [];
    }
  }
  let changed = false;
  notesIndex = notesIndex.map((n) => {
    if (n.folder === undefined || n.tags === undefined) {
      changed = true;
      return { folder: '', tags: [], ...n };
    }
    return n;
  });
  if (changed) saveIndex();
}

function saveIndex() {
  fs.writeFileSync(path.join(notesDirEnsure(), 'index.json'), JSON.stringify(notesIndex, null, 2));
}

function notePath(id) {
  return path.join(notesDirEnsure(), `${id}.md`);
}

function makeSnippet(text) {
  return (text || '')
    .replace(/[#*_`>~\-\[\]()!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readonlyNote(entry) {
  let snippet = entry.snippet || '';
  if (!snippet) {
    try {
      const file = notePath(entry.id);
      if (notesDir && fs.existsSync(file)) {
        snippet = makeSnippet(fs.readFileSync(file, 'utf8'));
      }
    } catch (err) {}
  }
  return {
    id: entry.id,
    title: entry.title,
    pinned: entry.pinned,
    folder: entry.folder || '',
    tags: entry.tags || [],
    updatedAt: entry.updatedAt,
    snippet: snippet.slice(0, 140)
  };
}

ipcMain.handle('notes:list', () => {
  loadIndex();
  return notesIndex
    .slice()
    .sort((a, b) => b.pinned - a.pinned || b.updatedAt - a.updatedAt)
    .map(readonlyNote);
});

ipcMain.handle('notes:read', (_event, id) => {
  const file = notePath(id);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
});

ipcMain.handle('notes:create', () => {
  const id = crypto.randomUUID();
  const now = Date.now();
  const entry = { id, title: 'Untitled Note', pinned: false, folder: '', tags: [], updatedAt: now };
  notesIndex.push(entry);
  fs.writeFileSync(notePath(id), '');
  saveIndex();
  return readonlyNote(entry);
});

ipcMain.handle('notes:save', (_event, id, content) => {
  const entry = notesIndex.find((n) => n.id === id);
  if (!entry) return false;
  fs.writeFileSync(notePath(id), content);
  const firstLine = content.split('\n').find((l) => l.trim().length > 0) || 'Untitled Note';
  entry.title = firstLine.replace(/^#+\s*/, '').trim().slice(0, 60) || 'Untitled Note';
  entry.snippet = makeSnippet(content);
  entry.updatedAt = Date.now();
  saveIndex();
  return readonlyNote(entry);
});

ipcMain.handle('notes:pin', (_event, id, pinned) => {
  const entry = notesIndex.find((n) => n.id === id);
  if (!entry) return false;
  entry.pinned = Boolean(pinned);
  entry.updatedAt = Date.now();
  saveIndex();
  return readonlyNote(entry);
});

ipcMain.handle('notes:rename', (_event, id, newTitle) => {
  const entry = notesIndex.find((n) => n.id === id);
  if (!entry) return false;
  entry.title = newTitle.slice(0, 60) || 'Untitled Note';
  entry.updatedAt = Date.now();
  saveIndex();
  return readonlyNote(entry);
});

ipcMain.handle('notes:setFolder', (_event, id, folder) => {
  const entry = notesIndex.find((n) => n.id === id);
  if (!entry) return false;
  entry.folder = sanitizeFolderName(folder);
  registerFolder(entry.folder);
  saveIndex();
  return readonlyNote(entry);
});

ipcMain.handle('notes:addFolder', (_event, name) => {
  return registerFolder(name);
});

ipcMain.handle('notes:listFolders', () => {
  return foldersList;
});

ipcMain.handle('notes:setTags', (_event, id, tags) => {
  const entry = notesIndex.find((n) => n.id === id);
  if (!entry) return false;
  const seen = new Set();
  entry.tags = (Array.isArray(tags) ? tags : [])
    .map((t) => String(t).trim().toLowerCase().replace(/^#/, '').slice(0, 20))
    .filter((t) => t && !seen.has(t) && seen.add(t))
    .slice(0, 8);
  saveIndex();
  return readonlyNote(entry);
});

ipcMain.handle('notes:delete', async (_event, id) => {
  const entry = notesIndex.find((n) => n.id === id);
  if (!entry) return false;
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Delete', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    title: 'Delete note',
    message: `Delete "${entry.title}"?`,
    detail: 'This cannot be undone.'
  });
  if (response !== 0) return false;
  notesIndex = notesIndex.filter((n) => n.id !== id);
  try {
    fs.unlinkSync(notePath(id));
  } catch (err) {}
  saveIndex();
  return true;
});

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

ipcMain.handle('notes:search', (_event, query) => {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const re = new RegExp(escapeRegExp(q), 'g');
  const results = [];
  for (const n of notesIndex) {
    let content = '';
    const file = notePath(n.id);
    if (fs.existsSync(file)) content = fs.readFileSync(file, 'utf8');
    const matches = (n.title.toLowerCase() + '\n' + content.toLowerCase()).match(re);
    if (matches && matches.length > 0) {
      results.push({ id: n.id, matches: matches.length });
    }
  }
  return results;
});

const EXPORT_META = {
  md: { name: 'Markdown', ext: 'md' },
  txt: { name: 'Text file', ext: 'txt' },
  html: { name: 'HTML', ext: 'html' },
  pdf: { name: 'PDF', ext: 'pdf' }
};

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMd(str) {
  return str
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

function renderMarkdownHtml(src) {
  const lines = src.split('\n');
  let html = '';
  let listType = null;
  let pre = null;

  const closePre = () => {
    if (pre !== null) {
      html += '</pre></code>\n';
      pre = null;
    }
  };
  const closeList = () => {
    if (listType) {
      html += `</${listType}>\n`;
      listType = null;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    if (line.startsWith('```')) {
      if (pre === null) {
        closeList();
        pre = line.slice(3).trim() || 'text';
        html += '<pre><code>';
        continue;
      } else {
        closePre();
        continue;
      }
    }
    if (pre !== null) {
      html += escapeHtml(line) + '\n';
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)/);
    if (heading) {
      closeList();
      const lvl = heading[1].length;
      html += `<h${lvl}>${inlineMd(escapeHtml(heading[2]))}</h${lvl}>\n`;
      continue;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const isOl = /^\s*\d+\./.test(line);
      const wanted = isOl ? 'ol' : 'ul';
      if (listType !== wanted) {
        closeList();
        listType = wanted;
        html += `<${wanted}>\n`;
      }
      html += `<li>${inlineMd(escapeHtml(line.replace(/^\s*([-*+]|\d+\.)\s+/, '')))}</li>\n`;
      continue;
    }
    closeList();

    if (line.trim() === '') {
      html += '</p>\n';
      continue;
    }
    if (line.trim() === '---' || line.trim() === '***') {
      html += '<hr>\n';
      continue;
    }
    const quote = line.match(/^>\s?(.*)/);
    if (quote) {
      html += `<blockquote>${inlineMd(escapeHtml(quote[1]))}</blockquote>\n`;
      continue;
    }
    html += `<p>${inlineMd(escapeHtml(line))}</p>\n`;
  }
  closePre();
  closeList();
  if (!html.trim()) return '<p><em>Empty note</em></p>';
  return html;
}

function htmlDoc(title, bodyHtml) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 46rem; margin: 2.5rem auto; padding: 0 1.5rem; color: #1c2030; line-height: 1.7; }
  h1, h2, h3, h4 { color: #4c3fd1; margin: 1.2rem 0 0.4rem; }
  p { margin: 0.5rem 0; }
  ul, ol { margin: 0.5rem 0 0.5rem 1.5rem; }
  code { background: #f0f1f6; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.88em; }
  pre { background: #f0f1f6; border: 1px solid #e0e2ec; padding: 0.9rem; border-radius: 8px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #6c5ce7; padding-left: 1rem; color: #5a6072; margin: 0.7rem 0; }
  a { color: #6c5ce7; }
  img { max-width: 100%; border-radius: 8px; }
  hr { border: none; border-top: 1px solid #e0e2ec; margin: 1.2rem 0; }
  table { border-collapse: collapse; } th, td { border: 1px solid #e0e2ec; padding: 0.35rem 0.7rem; }
</style></head><body>${bodyHtml}</body></html>`;
}

async function renderPdfBuffer(htmlString) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true }
  });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlString));
    return await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true });
  } finally {
    win.destroy();
  }
}

ipcMain.handle('notes:export', async (_event, id, format) => {
  const entry = notesIndex.find((n) => n.id === id);
  if (!entry) return { ok: false, error: 'Note not found' };
  const meta = EXPORT_META[format];
  if (!meta) return { ok: false, error: 'Unsupported format' };

  const safeName = entry.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'Note';
  const options = {
    defaultPath: path.join(app.getPath('documents'), `${safeName}.${meta.ext}`),
    filters: [{ name: meta.name, extensions: [meta.ext] }]
  };
  const { canceled, filePath } = await dialog.showSaveDialog(options);
  if (canceled || !filePath) return { ok: false, error: 'canceled' };

  const content = fs.existsSync(notePath(id)) ? fs.readFileSync(notePath(id), 'utf8') : '';
  let data;
  if (format === 'pdf') {
    data = await renderPdfBuffer(htmlDoc(entry.title, renderMarkdownHtml(content)));
  } else if (format === 'html') {
    data = htmlDoc(entry.title, renderMarkdownHtml(content));
  } else {
    data = content;
  }
  fs.writeFileSync(filePath, data);
  return { ok: true, filePath };
});

ipcMain.handle('settings:get', () => {
  const file = path.join(notesDirEnsure(), 'settings.json');
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return {};
  }
});

ipcMain.handle('settings:set', (_event, settings) => {
  fs.writeFileSync(path.join(notesDirEnsure(), 'settings.json'), JSON.stringify(settings, null, 2));
  return true;
});

/* ---------------- AI assistant (Gemini free tier) ---------------- */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_SYSTEM = `You are the AI assistant inside NoteTaker, a local note-taking app.
The user selects a word, phrase, or passage from their note and asks you to look it up or explain its context.
Be concise, accurate, and friendly. For word lookups give: meaning, common usage, and its role in the note's context.
When asked for context, explain what the passage is about and how the pieces connect.
Format answers with short paragraphs and occasional bullet lists. Use markdown sparingly.`;

function readSettings() {
  const file = path.join(notesDirEnsure(), 'settings.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return {};
  }
}

async function streamGemini(model, contents, system, onDelta) {
  const key = readSettings().geminiKey;
  if (!key) {
    throw new Error('No Gemini API key set. Add your free key in Palette > AI assistant.');
  }
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 }
    })
  });
  if (!res.ok) {
    let msg = `Gemini error (HTTP ${res.status})`;
    try {
      const body = JSON.parse(await res.text());
      msg = (body.error && body.error.message) || msg;
    } catch (err) {}
    if (res.status === 429) {
      msg = 'Free-tier rate limit reached — wait a minute and try again.';
    }
    throw new Error(msg);
  }
  const decoder = new TextDecoder();
  let buf = '';
  let acc = '';
  const handle = (line) => {
    const t = line.trim();
    if (!t.startsWith('data:')) return;
    const json = t.slice(5).trim();
    if (!json || json === '[DONE]') return;
    try {
      const obj = JSON.parse(json);
      const parts = obj.candidates && obj.candidates[0] && obj.candidates[0].content && obj.candidates[0].content.parts;
      if (parts) {
        for (const p of parts) {
          if (p.text) {
            acc += p.text;
            onDelta(p.text);
          }
        }
      }
    } catch (err) {}
  };
  for await (const raw of res.body) {
    buf += decoder.decode(raw, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) handle(line);
  }
  if (buf.trim()) handle(buf);
  if (!acc.trim()) throw new Error('Empty response from Gemini. Try again.');
  return acc;
}

function sanitizeHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter((m) => m && m.role && m.text && (m.role === 'user' || m.role === 'model'))
    .slice(-6)
    .map((m) => ({ role: m.role, parts: [{ text: String(m.text).slice(0, 6000) }] }));
}

ipcMain.handle('ai:ask', async (event, payload) => {
  try {
    const s = readSettings();
    const model = String(payload.model || s.geminiModel || 'gemini-3.6-flash').trim() || 'gemini-3.6-flash';
    const selection = String(payload.selection || '').trim();
    const question = String(payload.question || '').trim() || 'Explain this';
    const selectionBlock = selection
      ? `Selected text from the user's note:\n"""\n${selection.slice(0, 6000)}\n"""\n\n`
      : '';
    const contents = [
      ...sanitizeHistory(payload.history),
      { role: 'user', parts: [{ text: `${selectionBlock}Question: ${question}` }] }
    ];
    await streamGemini(model, contents, GEMINI_SYSTEM, (t) => event.sender.send('ai:chunk', t));
    event.sender.send('ai:done', { ok: true });
  } catch (err) {
    event.sender.send('ai:done', { ok: false, error: err.message });
  }
});

ipcMain.handle('ai:test', async () => {
  try {
    const s = readSettings();
    const model = String(s.geminiModel || 'gemini-3.6-flash').trim() || 'gemini-3.6-flash';
    await streamGemini(
      model,
      [{ role: 'user', parts: [{ text: 'Reply with exactly: OK' }] }],
      'You reply with one word.',
      () => {}
    );
    return { ok: true, model };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#12141a',
    title: 'NoteTaker',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  const mainLog = path.join(app.getPath('userData'), 'main.log');
  const log = (m) => { try { fs.appendFileSync(mainLog, `[${new Date().toISOString()}] ${m}\n`); } catch (err) {} };
  win.webContents.on('did-finish-load', () => {
    log('did-finish-load ' + win.webContents.getURL());
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => log('did-fail-load ' + code + ' ' + desc));
  win.webContents.on('render-process-gone', (_e, details) => log('render-process-gone ' + JSON.stringify(details)));
  win.webContents.on('preload-error', (_e, p, err) => log('preload-error ' + p + ' ' + err.message));
  return win;
}

app.whenReady().then(() => {
  notesDirEnsure();
  loadIndex();
  loadFoldersList();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});