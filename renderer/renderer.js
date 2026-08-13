const api = window.notesAPI;

const state = {
  notes: [],
  currentId: null,
  query: '',
  saveTimer: null,
  searchTimer: null,
  searchResults: new Map(),
  mode: 'split',
  folderFilter: null,
  pinnedOnly: false,
  tagFilter: null,
  matchIdx: -1,
  folders: [],
  view: 'notes',
  lastView: 'notes',
  aiOpen: false,
  aiRequest: false,
  aiHistory: [],
  settings: {
    theme: 'dark',
    accent: '#6c5ce7',
    bg: 'gradient',
    fontSize: 15,
    sidebarWidth: 280,
    panelOpen: true,
    geminiKey: '',
    geminiModel: 'gemini-3.6-flash',
    view: 'notes',
    viewMode: 'split'
  }
};

const els = {
  app: document.getElementById('app'),
  noteList: document.getElementById('note-list'),
  search: document.getElementById('search'),
  newNote: document.getElementById('new-note'),
  emptyState: document.getElementById('empty-state'),
  editorArea: document.getElementById('editor-area'),
  noteTitle: document.getElementById('note-title'),
  noteContent: document.getElementById('note-content'),
  preview: document.getElementById('preview'),
  editorBody: document.getElementById('editor-body'),
  contentHint: document.getElementById('content-hint'),
  segBtns: Array.from(document.querySelectorAll('.seg-btn')),
  segThumb: document.getElementById('seg-thumb'),
  pinBtn: document.getElementById('pin-btn'),
  exportBtn: document.getElementById('export-btn'),
  deleteBtn: document.getElementById('delete-btn'),
  wordCount: document.getElementById('word-count'),
  charCount: document.getElementById('char-count'),
  updatedAt: document.getElementById('updated-at'),
  saveState: document.getElementById('save-state'),
  toast: document.getElementById('toast'),
  fontRange: document.getElementById('font-size'),
  folderSelect: document.getElementById('folder-select'),
  tagsInput: document.getElementById('tags-input'),
  sidebarNav: document.getElementById('sidebar-nav'),
  folderNav: document.getElementById('folder-nav'),
  tagNav: document.getElementById('tag-nav'),
  tagsDivider: document.getElementById('tags-divider'),
  navAll: document.getElementById('nav-all'),
  welcomeCreate: document.getElementById('welcome-create'),
  folderAddBtn: document.getElementById('folder-add-btn'),
  folderNewRow: document.getElementById('folder-new-row'),
  folderNewInput: document.getElementById('folder-new-input'),
  abBtns: Array.from(document.querySelectorAll('.ab-btn')),
  viewNotesHead: document.getElementById('view-notes-head'),
  viewSearchHead: document.getElementById('view-search-head'),
  viewPinnedHead: document.getElementById('view-pinned-head'),
  paletteView: document.getElementById('palette-view'),
  sidebarResize: document.getElementById('sidebar-resize'),
  sidebarToggle: document.getElementById('sidebar-toggle'),
  searchBig: document.getElementById('search-big'),
  searchClear: document.getElementById('search-clear'),
  searchCount: document.getElementById('search-count'),
  pinnedCount: document.getElementById('pinned-count'),
  aiToggle: document.getElementById('ai-toggle'),
  aiPanel: document.getElementById('ai-panel'),
  aiChat: document.getElementById('ai-chat'),
  aiInput: document.getElementById('ai-input'),
  aiSend: document.getElementById('ai-send'),
  aiClose: document.getElementById('ai-close'),
  aiKey: document.getElementById('ai-key'),
  aiModel: document.getElementById('ai-model'),
  aiTest: document.getElementById('ai-test'),
  aiTestStatus: document.getElementById('ai-test-status')
};

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 480;

function clampSidebarWidth(w) {
  const n = parseInt(w, 10);
  if (isNaN(n)) return 280;
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, n));
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applySettings() {
  const s = state.settings;
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.dataset.bg = s.bg;
  const root = document.documentElement.style;
  root.setProperty('--accent', s.accent);
  root.setProperty('--accent-soft', hexToRgba(s.accent, 0.18));
  root.setProperty('--accent-glow', hexToRgba(s.accent, 0.45));
  root.setProperty('--sidebar-w', clampSidebarWidth(s.sidebarWidth) + 'px');
  els.app.classList.toggle('sidebar-hidden', !s.panelOpen);
  els.aiKey.value = s.geminiKey || '';
  els.aiModel.value = s.geminiModel || 'gemini-3.6-flash';
  els.noteContent.style.fontSize = s.fontSize + 'px';
  els.fontRange.value = s.fontSize;

  document.getElementById('theme-dark').classList.toggle('active', s.theme === 'dark');
  document.getElementById('theme-light').classList.toggle('active', s.theme === 'light');
  document.getElementById('bg-gradient').classList.toggle('active', s.bg === 'gradient');
  document.getElementById('bg-plain').classList.toggle('active', s.bg === 'plain');
  document.querySelectorAll('.swatch').forEach((sw) => {
    sw.classList.toggle('active', sw.dataset.color === s.accent);
  });
}

function updateSetting(patch) {
  if (patch.accent && patch.accent !== state.settings.accent) {
    document.body.classList.remove('accent-pulse');
    void document.body.offsetWidth;
    document.body.classList.add('accent-pulse');
  }
  Object.assign(state.settings, patch);
  applySettings();
  api.setSettings(state.settings);
}

/* ---------------- Panel views (#active) ---------------- */

function switchView(view, opts) {
  opts = opts || {};
  state.view = view;
  setPanelOpen(true);
  els.abBtns.forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  els.viewNotesHead.classList.toggle('hidden', view !== 'notes');
  els.viewSearchHead.classList.toggle('hidden', view !== 'search');
  els.viewPinnedHead.classList.toggle('hidden', view !== 'pinned');
  els.paletteView.classList.toggle('hidden', view !== 'palette');
  els.sidebarNav.classList.toggle('hidden', view === 'palette');
  els.noteList.classList.toggle('hidden', view === 'palette');
  if (view === 'search') {
    syncSearchInputs();
    updateSearchCount();
  }
  if (opts.focus) {
    setTimeout(() => {
      if (view === 'search') els.searchBig.focus();
      if (view === 'notes') els.search.focus();
    }, 50);
  }
  updateSetting({ view });
}

function togglePalette() {
  switchView(state.view === 'palette' ? state.lastView : 'palette');
}

function setPanelOpen(open) {
  updateSetting({ panelOpen: !!open });
  els.app.classList.toggle('sidebar-hidden', !open);
}

function togglePanel() {
  setPanelOpen(!state.settings.panelOpen);
}

function syncSearchInputs() {
  els.searchBig.value = state.query;
  els.search.value = state.query;
}

function updateSearchCount() {
  const n = state.searchResults.size;
  els.searchCount.textContent = n === 0 ? 'No matches' : n + ' note' + (n === 1 ? '' : 's') + ' found';
}

function updatePinnedCount() {
  const n = state.notes.filter((x) => x.pinned).length;
  els.pinnedCount.textContent = n === 0 ? 'Nothing pinned — 📌 to keep one here' : n + ' pinned';
}

/* ---------------- AI assistant ---------------- */

function openAIPanel() {
  state.aiOpen = true;
  els.app.classList.add('ai-open');
  if (els.aiChat.children.length === 0) aiShowEmpty();
}

function closeAIPanel() {
  state.aiOpen = false;
  els.app.classList.remove('ai-open');
}

function toggleAIPanel() {
  state.aiOpen ? closeAIPanel() : openAIPanel();
}

function aiShowEmpty() {
  els.aiChat.innerHTML = '';
  const hint = document.createElement('div');
  hint.className = 'ai-msg ai-ai';
  hint.innerHTML =
    '<b>👋 Welcome to the AI assistant.</b><p>Select any text in a note and press ' +
    '<b>Ctrl+Shift+A</b> to look it up, or ask a question below.</p>';
  const cta = document.createElement('button');
  cta.className = 'btn btn-primary';
  cta.textContent = '🔑 Add free API key';
  cta.addEventListener('click', () => {
    switchView('palette');
    setTimeout(() => {
      const section = document.getElementById('ai-section');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => els.aiKey.focus(), 350);
    }, 150);
  });
  hint.appendChild(cta);
  els.aiChat.appendChild(hint);
}

function getSelectionText() {
  const ta = els.noteContent;
  if (ta.selectionStart === ta.selectionEnd) return '';
  return ta.value.substring(ta.selectionStart, ta.selectionEnd);
}

function aiAddBubble(role, html, cls) {
  const msg = document.createElement('div');
  msg.className = 'ai-msg ' + role + (cls ? ' ' + cls : '');
  msg.innerHTML = html;
  els.aiChat.appendChild(msg);
  els.aiChat.scrollTop = els.aiChat.scrollHeight;
  return msg;
}

function aiAsk(question, selection) {
  if (state.aiRequest) return;
  if (!state.settings.geminiKey) {
    switchView('palette');
    showToast('Add your free Gemini API key in Palette → AI assistant');
    return;
  }
  openAIPanel();
  if (els.aiChat.children.length > 0 && els.aiChat.firstElementChild.classList.contains('ai-ai') &&
      els.aiChat.childElementCount === 1) {
    els.aiChat.innerHTML = '';
  }
  const q = question.trim() || 'Explain this';
  aiAddBubble('ai-user', escapeHtml(q));
  const loading = aiAddBubble('ai-ai', '<span class="ai-spinner"></span>Thinking…', 'ai-loading');

  state.aiRequest = true;
  els.aiInput.disabled = true;
  els.aiSend.disabled = true;

  let acc = '';
  let started = false;
  state.aiChunk = (text) => {
    if (!started) {
      started = true;
      loading.classList.remove('ai-loading');
      loading.innerHTML = '';
    }
    acc += text;
    loading.textContent = acc;
    els.aiChat.scrollTop = els.aiChat.scrollHeight;
  };
  state.aiDone = (res) => {
    els.aiInput.disabled = false;
    els.aiSend.disabled = false;
    state.aiRequest = false;
    if (res.ok) {
      loading.innerHTML = window.MarkdownRenderer.renderMarkdown(acc);
      state.aiHistory.push({ role: 'user', text: q });
      state.aiHistory.push({ role: 'model', text: acc });
    } else {
      loading.className = 'ai-msg ai-err';
      loading.innerHTML = escapeHtml('⚠ ' + res.error);
      showToast(res.error);
    }
  };
  api.askAI({
    question: q,
    selection: selection || null,
    history: state.aiHistory,
    model: state.settings.geminiModel
  });
}

/* ---------------- View mode (#1) ---------------- */

function renderPreview() {
  els.preview.innerHTML = window.MarkdownRenderer.renderMarkdown(els.noteContent.value);
  highlightPreview();
}

function highlightPreview() {
  const q = state.query.trim();
  if (q.length < 2) return;
  const re = new RegExp(escapeRegExp(q), 'gi');
  const walker = document.createTreeWalker(els.preview, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parent = node.parentNode;
    if (parent.tagName === 'MARK') continue;
    re.lastIndex = 0;
    if (!re.test(node.data)) continue;
    const frag = document.createDocumentFragment();
    let last = 0;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(node.data)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(node.data.slice(last, m.index)));
      const mark = document.createElement('mark');
      mark.textContent = node.data.slice(m.index, m.index + m[0].length);
      frag.appendChild(mark);
      last = m.index + m[0].length;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    if (last < node.data.length) frag.appendChild(document.createTextNode(node.data.slice(last)));
    parent.replaceChild(frag, node);
  }
}

function setMode(mode, persist) {
  state.mode = mode;
  els.editorBody.className = 'mode-' + mode;
  els.segBtns.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  requestAnimationFrame(positionSegThumb);
  if (state.currentId && mode !== 'editor') renderPreview();
  updateHint();
  if (persist) updateSetting({ viewMode: mode });
}

function positionSegThumb() {
  const active = els.segBtns.find((b) => b.dataset.mode === state.mode);
  if (!active || !els.segThumb || active.offsetWidth === 0) return;
  els.segThumb.style.left = active.offsetLeft + 'px';
  els.segThumb.style.width = active.offsetWidth + 'px';
}
window.addEventListener('resize', positionSegThumb);

function updateHint() {
  const on = !!state.currentId && els.noteContent.value.length === 0 && state.mode !== 'preview';
  els.editorBody.classList.toggle('show-hint', on);
}

function cycleMode() {
  const order = ['split', 'editor', 'preview'];
  const next = order[(order.indexOf(state.mode) + 1) % order.length];
  setMode(next, true);
}

/* ---------------- Notes ---------------- */

function filteredNotes() {
  let list = state.notes;
  if (state.pinnedOnly) list = list.filter((n) => n.pinned);
  if (state.folderFilter !== null) list = list.filter((n) => (n.folder || '') === state.folderFilter);
  if (state.tagFilter) list = list.filter((n) => n.tags && n.tags.includes(state.tagFilter));
  const q = state.query.trim().toLowerCase();
  if (q) {
    list = list.filter((n) => state.searchResults.has(n.id));
    list = list.slice().sort(
      (a, b) => (state.searchResults.get(b.id) || 0) - (state.searchResults.get(a.id) || 0)
    );
  }
  return list;
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function highlightText(text, q) {
  if (!q) return escapeHtml(text);
  const esc = escapeHtml(text);
  return esc.replace(new RegExp(escapeRegExp(q), 'gi'), (m) => `<mark>${m}</mark>`);
}

function snippet(text) {
  const clean = (text || '')
    .replace(/[#*_`>~\-\[\]()!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > 110 ? clean.slice(0, 110) + '…' : clean;
}

function navEmpty(container, icon, title, sub, btnLabel, onBtn) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'empty-list compact';
  const i = document.createElement('div');
  i.className = 'empty-list-icon';
  i.textContent = icon;
  const t = document.createElement('div');
  t.className = 'empty-list-title';
  t.textContent = title;
  const s = document.createElement('div');
  s.className = 'empty-list-sub';
  s.textContent = sub;
  wrap.append(i, t, s);
  if (btnLabel && onBtn) {
    const b = document.createElement('button');
    b.className = 'btn btn-primary btn-sm';
    b.textContent = btnLabel;
    b.addEventListener('click', onBtn);
    wrap.appendChild(b);
  }
  container.appendChild(wrap);
}

function renderList() {
  els.noteList.innerHTML = '';
  const list = filteredNotes();
  if (list.length === 0) {
    const wrap = document.createElement('div');
    wrap.className = 'empty-list';
    const filtering = state.query || state.folderFilter !== null || state.pinnedOnly || state.tagFilter;
    if (filtering) {
      const icon = document.createElement('div');
      icon.className = 'empty-list-icon';
      icon.textContent = '🔍';
      const title = document.createElement('div');
      title.className = 'empty-list-title';
      title.textContent = state.query ? 'No notes found' : 'Nothing here yet';
      const sub = document.createElement('div');
      sub.className = 'empty-list-sub';
      sub.textContent = state.query
        ? `No notes match "${state.query.trim()}". Try different keywords or clear the search.`
        : 'No notes match the current filter. Try clearing a filter.';
      wrap.append(icon, title, sub);
      if (state.query) {
        const clear = document.createElement('button');
        clear.className = 'btn btn-ghost btn-sm';
        clear.textContent = '✕ Clear search';
        clear.addEventListener('click', () => {
          els.searchBig.value = '';
          els.search.value = '';
          state.query = '';
          state.searchResults.clear();
          renderList();
          renderNav();
          els.searchBig.focus();
        });
        wrap.appendChild(clear);
      }
    } else {
      const icon = document.createElement('div');
      icon.className = 'empty-list-icon';
      icon.textContent = '📭';
      const title = document.createElement('div');
      title.className = 'empty-list-title';
      title.textContent = 'No notes yet';
      const sub = document.createElement('div');
      sub.className = 'empty-list-sub';
      sub.textContent = 'Your note list will live here.';
      const cta = document.createElement('button');
      cta.className = 'btn btn-primary';
      cta.textContent = '＋ Create one';
      cta.addEventListener('click', () => createNote(false));
      wrap.append(icon, title, sub, cta);
    }
    els.noteList.appendChild(wrap);
    return;
  }
  const q = state.query.trim();
  list.forEach((note, i) => {
    const item = document.createElement('div');
    item.className = 'note-item' + (note.id === state.currentId ? ' active' : '');
    item.dataset.id = note.id;
    item.style.animationDelay = Math.min(i * 25, 300) + 'ms';

    const avatar = document.createElement('div');
    avatar.className = 'note-avatar';
    const first = (note.title || '').trim().charAt(0);
    avatar.textContent = first ? first.toUpperCase() : '📝';

    const meta = document.createElement('div');
    meta.className = 'note-meta';
    const title = document.createElement('div');
    title.className = 'note-title';
    title.innerHTML = highlightText(note.title || 'Untitled', q);
    const time = document.createElement('div');
    time.className = 'note-time';
    const hits = state.searchResults.get(note.id);
    time.textContent = q && hits ? `${hits} match${hits === 1 ? '' : 'es'} · ` + formatTime(note.updatedAt)
      : formatTime(note.updatedAt);
    meta.appendChild(title);
    meta.appendChild(time);

    if (note.content && !q) {
      const preview = document.createElement('div');
      preview.className = 'note-preview';
      preview.textContent = snippet(note.content);
      meta.appendChild(preview);
    }

    item.appendChild(avatar);
    item.appendChild(meta);
    if (note.pinned) {
      const pin = document.createElement('span');
      pin.className = 'pin-badge';
      pin.textContent = '📌';
      item.appendChild(pin);
    }

    item.addEventListener('click', () => selectNote(note.id));
    els.noteList.appendChild(item);
  });
}

function renderNav() {
  const tags = new Map();
  for (const n of state.notes) {
    (n.tags || []).forEach((t) => tags.set(t, (tags.get(t) || 0) + 1));
  }

  els.navAll.classList.toggle('active', state.folderFilter === null && !state.pinnedOnly && !state.tagFilter);
  updatePinnedCount();

  els.folderNav.innerHTML = '';
  const addItem = (label, value, count, icon) => {
    const btn = document.createElement('button');
    btn.className = 'nav-item' + (state.folderFilter === value ? ' active' : '');
    btn.innerHTML = `${icon} ${escapeHtml(label)}<span class="nav-count">${count}</span>`;
    btn.addEventListener('click', () => {
      state.folderFilter = state.folderFilter === value ? null : value;
      renderNav();
      renderList();
    });
    els.folderNav.appendChild(btn);
  };
  const countIn = (name) => state.notes.filter((n) => (n.folder || '') === name).length;
  const noFolder = state.notes.filter((n) => !n.folder).length;
  if (noFolder > 0) addItem('No folder', '', noFolder, '🗂');
  if (state.folders.length === 0 && noFolder === 0) {
    navEmpty(els.folderNav, '📁', 'No folders yet', 'Group notes into folders to keep your sidebar tidy.', 'Create folder', () => {
      els.folderNewRow.classList.remove('hidden');
      els.folderNewInput.focus();
    });
  } else {
    for (const name of state.folders) addItem(name, name, countIn(name), '📁');
  }

  els.tagsDivider.hidden = tags.size === 0;
  els.tagNav.innerHTML = '';
  if (tags.size === 0) {
    const hint = document.createElement('div');
    hint.className = 'tag-empty-hint';
    hint.textContent = 'No tags yet — add tags like #idea in the editor, then manage notes here.';
    els.tagNav.appendChild(hint);
  }
  for (const [tag, count] of tags) {
    const chip = document.createElement('button');
    chip.className = 'tag-chip' + (state.tagFilter === tag ? ' active' : '');
    chip.textContent = `#${tag} ${count}`;
    chip.addEventListener('click', () => {
      state.tagFilter = state.tagFilter === tag ? null : tag;
      renderNav();
      renderList();
    });
    els.tagNav.appendChild(chip);
  }
}

function renderFolderSelect(note) {
  const folders = [...new Set(state.notes.map((n) => n.folder).filter(Boolean))];
  els.folderSelect.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'No folder';
  els.folderSelect.appendChild(none);
  for (const f of folders) {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    els.folderSelect.appendChild(opt);
  }
  els.folderSelect.value = note ? (note.folder || '') : '';
}

async function selectNote(id) {
  flushSave();
  state.currentId = id;
  if (!id) {
    els.emptyState.classList.remove('hidden');
    els.editorArea.classList.add('hidden');
    renderList();
    return;
  }
  els.emptyState.classList.add('hidden');
  els.editorArea.classList.remove('hidden');

  const note = state.notes.find((n) => n.id === id);
  const content = (await api.read(id)) || '';
  els.noteTitle.value = note.title;
  els.noteContent.value = content;
  els.tagsInput.value = (note.tags || []).join(', ');
  renderFolderSelect(note);
  updateStats(content, note);
  updatePinButton(note.pinned);
  updateHint();
  els.preview.scrollTop = 0;
  state.matchIdx = -1;
  if (state.mode !== 'editor') renderPreview();
  jumpToMatch(1, true);
  renderList();
}

function updatePinButton(pinned) {
  els.pinBtn.textContent = pinned ? '📌' : '📍';
  els.pinBtn.title = pinned ? 'Unpin note' : 'Pin note';
  els.pinBtn.classList.toggle('active', pinned);
}

function updateStats(content, note) {
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  els.wordCount.textContent = `${words} word${words === 1 ? '' : 's'}`;
  els.charCount.textContent = `${content.length} chars`;
  els.updatedAt.textContent = note && note.updatedAt ? `Edited ${formatTime(note.updatedAt)}` : '';
}

async function loadNotes() {
  state.notes = await api.list();
  renderNav();
  renderList();
  if (state.query.trim()) {
    const res = await api.search(state.query);
    state.searchResults = new Map(res.map((r) => [r.id, r.matches]));
    renderList();
  }
  if (state.currentId && !state.notes.some((n) => n.id === state.currentId)) {
    selectNote(null);
  } else if (!state.currentId && state.notes.length > 0) {
    selectNote(state.notes[0].id);
  }
}

async function createNote(quiet) {
  const note = await api.create();
  await loadNotes();
  selectNote(note.id);
  els.noteContent.focus();
  if (!quiet) showToast('Note created');
}

/* ---------------- Save (#4) ---------------- */

function markSaving() {
  els.saveState.textContent = 'Saving';
  els.saveState.className = 'save-state saving';
}

function markSaved() {
  els.saveState.textContent = '✓ Saved';
  els.saveState.className = 'save-state';
  void els.saveState.offsetWidth;
  els.saveState.classList.add('saved');
}

function scheduleSave() {
  markSaving();
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(flushSave, 800);
}

async function flushSave() {
  clearTimeout(state.saveTimer);
  const id = state.currentId;
  if (!id) return;
  const title = els.noteTitle.value.trim() || 'Untitled Note';
  const updated = await api.save(id, els.noteContent.value);
  if (updated) {
    const note = state.notes.find((n) => n.id === id);
    note.title = updated.title;
    note.updatedAt = updated.updatedAt;
    updateStats(els.noteContent.value, note);
    if (title !== updated.title) {
      els.noteTitle.value = updated.title;
    }
    renderList();
  }
  markSaved();
}

/* ---------------- Search (#3) ---------------- */

function jumpToMatch(dir, silentFirst) {
  const q = state.query.trim();
  if (!q || !state.currentId) return;
  const content = els.noteContent.value;
  const re = new RegExp(escapeRegExp(q.toLowerCase()), 'g');
  const matches = [];
  let m;
  while ((m = re.exec(content.toLowerCase())) !== null) matches.push(m.index);
  if (!matches.length) return;

  if (silentFirst) {
    state.matchIdx = 0;
  } else {
    state.matchIdx = (state.matchIdx + (dir > 0 ? 1 : -1) + matches.length) % matches.length;
  }
  const start = matches[state.matchIdx];
  els.noteContent.focus();
  els.noteContent.setSelectionRange(start, start + q.length);
  if (state.mode !== 'editor') {
    const marks = els.preview.querySelectorAll('mark');
    const target = marks[state.matchIdx];
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  showToast(`Match ${state.matchIdx + 1} of ${matches.length}`);
}

function onSearchInput() {
  state.query = els.searchBig.value || els.search.value;
  syncSearchInputs();
  clearTimeout(state.searchTimer);
  if (state.query.trim()) {
    state.searchTimer = setTimeout(async () => {
      const res = await api.search(state.query);
      state.searchResults = new Map(res.map((r) => [r.id, r.matches]));
      updateSearchCount();
      renderList();
      if (state.currentId) jumpToMatch(1, true);
    }, 250);
  } else {
    state.searchResults.clear();
    updateSearchCount();
  }
  renderList();
  renderNav();
}

/* ---------------- Toast ---------------- */

let toastTimer = null;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  requestAnimationFrame(() => els.toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
    setTimeout(() => els.toast.classList.add('hidden'), 300);
  }, 2200);
}

/* ---------------- Export (#5) ---------------- */

function showExportMenu() {
  const menu = document.createElement('div');
  menu.style.cssText = `
    position: fixed; z-index: 90; background: var(--bg-elevated);
    border: 1px solid var(--border); border-radius: 10px; padding: 4px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.35); min-width: 170px;
  `;
  const rect = els.exportBtn.getBoundingClientRect();
  menu.style.top = rect.bottom + 6 + 'px';
  menu.style.right = Math.max(12, window.innerWidth - rect.right) + 'px';

  const close = () => {
    menu.remove();
    window.removeEventListener('click', close, true);
  };

  const formats = [
    { fmt: 'md', label: 'Markdown (.md)' },
    { fmt: 'html', label: 'HTML (.html)' },
    { fmt: 'pdf', label: 'PDF (.pdf)' },
    { fmt: 'txt', label: 'Plain text (.txt)' }
  ];
  for (const { fmt, label } of formats) {
    const item = document.createElement('button');
    item.className = 'btn btn-ghost';
    item.style.cssText = 'display:block;width:100%;text-align:left;margin:2px 0;';
    item.textContent = label;
    item.addEventListener('click', async () => {
      close();
      const res = await api.export(state.currentId, fmt);
      if (res.ok) showToast(`Exported to ${res.filePath}`);
      else if (res.error !== 'canceled') showToast(`Export failed: ${res.error}`);
    });
    menu.appendChild(item);
  }
  document.body.appendChild(menu);
  setTimeout(() => window.addEventListener('click', close, true), 0);
}

/* ---------------- Markdown helper (Ctrl+B / Ctrl+I, #6) ---------------- */

function wrapSelection(open, close) {
  const t = els.noteContent;
  const { selectionStart: s, selectionEnd: e } = t;
  const sel = t.value.slice(s, e);
  if (sel) {
    t.setRangeText(open + sel + close, s, e, 'end');
  } else {
    t.setRangeText(open + close, s, e, 'start');
    t.selectionStart = s + open.length;
    t.selectionEnd = s + open.length;
  }
  t.focus();
  t.dispatchEvent(new Event('input'));
}

/* ---------------- Events ---------------- */

els.newNote.addEventListener('click', () => createNote(false));
els.welcomeCreate.addEventListener('click', () => createNote(false));
els.search.addEventListener('input', onSearchInput);
els.noteTitle.addEventListener('input', scheduleSave);
els.noteContent.addEventListener('input', () => {
  updateStats(els.noteContent.value, { updatedAt: null });
  if (state.mode !== 'editor') renderPreview();
  updateHint();
  scheduleSave();
});
els.segBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode, true)));
els.pinBtn.addEventListener('click', async () => {
  const note = state.notes.find((n) => n.id === state.currentId);
  if (!note) return;
  const updated = await api.pin(note.id, !note.pinned);
  if (updated) {
    note.pinned = updated.pinned;
    updatePinButton(updated.pinned);
    renderList();
    renderNav();
    showToast(updated.pinned ? 'Note pinned — pinned notes sort to top' : 'Note unpinned');
  }
});
els.deleteBtn.addEventListener('click', async () => {
  const id = state.currentId;
  if (!id) return;
  const ok = await api.del(id);
  if (ok) {
    state.currentId = null;
    showToast('Note deleted');
    await loadNotes();
  }
});
els.exportBtn.addEventListener('click', showExportMenu);

/* Sidebar drag-resize */
els.sidebarResize.addEventListener('mousedown', (e) => {
  e.preventDefault();
  document.body.classList.add('resizing');
  const startX = e.clientX;
  const start = clampSidebarWidth(state.settings.sidebarWidth);

  const move = (ev) => {
    const w = clampSidebarWidth(start + (ev.clientX - startX));
    document.documentElement.style.setProperty('--sidebar-w', w + 'px');
  };
  const up = () => {
    document.body.classList.remove('resizing');
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    const w = clampSidebarWidth(state.settings.sidebarWidth);
    const sav = document.documentElement.style.getPropertyValue('--sidebar-w').replace('px', '');
    updateSetting({ sidebarWidth: parseInt(sav, 10) || w });
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
});

async function refreshFolders() {
  state.folders = await api.listFolders();
  renderNav();
  renderFolderSelect(state.notes.find((n) => n.id === state.currentId) || null);
}

els.folderAddBtn.addEventListener('click', () => {
  const showing = !els.folderNewRow.classList.contains('hidden');
  els.folderNewRow.classList.toggle('hidden', showing);
  if (!showing) {
    els.folderNewInput.value = '';
    els.folderNewInput.focus();
  }
});
els.folderNewInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Escape') {
    els.folderNewRow.classList.add('hidden');
  } else if (e.key === 'Enter') {
    const name = els.folderNewInput.value.trim();
    els.folderNewRow.classList.add('hidden');
    if (!name) return;
    await api.addFolder(name);
    await refreshFolders();
    showToast(`Folder "${name}" created`);
  }
});
els.folderNewInput.addEventListener('blur', () => {
  els.folderNewRow.classList.add('hidden');
});

els.folderSelect.addEventListener('change', async () => {
  const id = state.currentId;
  if (!id) return;
  const updated = await api.setFolder(id, els.folderSelect.value);
  const note = state.notes.find((n) => n.id === id);
  if (updated && note) {
    note.folder = updated.folder;
    await refreshFolders();
    renderList();
    showToast(updated.folder ? `Moved to "${updated.folder}"` : 'Folder removed');
  }
});
els.tagsInput.addEventListener('change', async () => {
  const id = state.currentId;
  if (!id) return;
  const raw = els.tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean);
  const updated = await api.setTags(id, raw);
  const note = state.notes.find((n) => n.id === id);
  if (updated && note) {
    note.tags = updated.tags;
    els.tagsInput.value = updated.tags.join(', ');
    renderNav();
    showToast(`Tags: ${updated.tags.length ? updated.tags.map((t) => '#' + t).join(' ') : 'none'}`);
  }
});

els.abBtns.forEach((b) => b.addEventListener('click', () => {
  if (!b.dataset.view) return;
  if (b.dataset.view === state.view) {
    togglePanel();
    return;
  }
  state.lastView = state.view;
  switchView(b.dataset.view);
}));
els.aiToggle.addEventListener('click', toggleAIPanel);
els.aiClose.addEventListener('click', closeAIPanel);
els.aiSend.addEventListener('click', () => {
  const text = els.aiInput.value;
  if (!text.trim()) return;
  els.aiInput.value = '';
  aiAsk(text, getSelectionText());
});
els.aiInput.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    els.aiSend.click();
  }
});
els.aiKey.addEventListener('change', () => updateSetting({ geminiKey: els.aiKey.value.trim() }));
els.aiModel.addEventListener('change', () => {
  const m = els.aiModel.value.trim();
  updateSetting({ geminiModel: m || 'gemini-3.6-flash' });
});
els.aiTest.addEventListener('click', async () => {
  els.aiTestStatus.className = 'ai-test-status';
  els.aiTestStatus.textContent = 'Testing…';
  els.aiTest.disabled = true;
  const res = await api.testAI();
  els.aiTest.disabled = false;
  if (res.ok) {
    els.aiTestStatus.className = 'ai-test-status ok';
    els.aiTestStatus.textContent = `✓ Connected — ${res.model} is responding.`;
  } else {
    els.aiTestStatus.className = 'ai-test-status err';
    els.aiTestStatus.textContent = '✗ ' + res.error;
  }
});
els.sidebarToggle.addEventListener('click', togglePanel);
els.searchBig.addEventListener('input', () => onSearchInput());
els.searchClear.addEventListener('click', () => {
  els.searchBig.value = '';
  els.search.value = '';
  state.query = '';
  state.searchResults.clear();
  renderList();
  renderNav();
  els.searchBig.focus();
});
document.getElementById('theme-dark').addEventListener('click', () => updateSetting({ theme: 'dark' }));
document.getElementById('theme-light').addEventListener('click', () => updateSetting({ theme: 'light' }));
document.getElementById('bg-gradient').addEventListener('click', () => updateSetting({ bg: 'gradient' }));
document.getElementById('bg-plain').addEventListener('click', () => updateSetting({ bg: 'plain' }));

document.querySelectorAll('.swatch').forEach((sw) => {
  sw.addEventListener('click', () => {
    updateSetting({ accent: sw.dataset.color });
    ripple(sw);
  });
});
document.getElementById('custom-color').addEventListener('input', (e) => {
  updateSetting({ accent: e.target.value });
});

els.fontRange.addEventListener('input', (e) => updateSetting({ fontSize: parseInt(e.target.value, 10) }));
document.getElementById('font-minus').addEventListener('click', () => {
  updateSetting({ fontSize: Math.max(12, state.settings.fontSize - 1) });
});
document.getElementById('font-plus').addEventListener('click', () => {
  updateSetting({ fontSize: Math.min(22, state.settings.fontSize + 1) });
});

/* Ripple effect for interactive feedback */
function ripple(target) {
  const circ = document.createElement('span');
  const size = Math.max(target.offsetWidth, target.offsetHeight) * 1.4;
  const rect = target.getBoundingClientRect();
  circ.style.cssText = `
    position: absolute; width: ${size}px; height: ${size}px; pointer-events: none;
    left: ${rect.width / 2 - size / 2}px; top: ${rect.height / 2 - size / 2}px;
    border-radius: 50%; background: var(--accent); opacity: 0.55;
    transform: scale(0); animation: ripple 0.5s ease-out forwards; z-index: 0;
  `;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ripple { to { transform: scale(1); opacity: 0; } }
    .btn, .swatch { position: relative; overflow: hidden; }
  `;
  if (!document.getElementById('ripple-style')) {
    style.id = 'ripple-style';
    document.head.appendChild(style);
  }
  target.appendChild(circ);
  setTimeout(() => circ.remove(), 600);
}
document.querySelectorAll('.btn').forEach((btn) => {
  btn.addEventListener('click', () => ripple(btn));
});

/* ---------------- Keyboard shortcuts (#6) ---------------- */

document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (ctrl && e.shiftKey && k === 'n') {
    e.preventDefault();
    createNote(true);
  } else if (ctrl && !e.shiftKey && k === 'n') {
    e.preventDefault();
    createNote(false);
  } else if (ctrl && !e.shiftKey && k === 's') {
    e.preventDefault();
    flushSave();
    showToast('Saved');
  } else if (ctrl && !e.shiftKey && k === 'f') {
    e.preventDefault();
    state.lastView = state.view;
    switchView('search', { focus: true });
  } else if (ctrl && !e.shiftKey && k === 'p') {
    e.preventDefault();
    cycleMode();
  } else if (ctrl && e.shiftKey && k === 'p') {
    e.preventDefault();
    togglePalette();
  } else if (ctrl && !e.shiftKey && k >= '1' && k <= '4') {
    e.preventDefault();
    const map = { '1': 'notes', '2': 'search', '3': 'pinned', '4': 'palette' };
    if (map[k] !== state.view) state.lastView = state.view;
    switchView(map[k]);
  } else if (ctrl && e.shiftKey && k === 'b') {
    e.preventDefault();
    togglePanel();
  } else if (ctrl && !e.shiftKey && k === 'b') {
    e.preventDefault();
    wrapSelection('**', '**');
  } else if (ctrl && !e.shiftKey && k === 'i') {
    e.preventDefault();
    wrapSelection('*', '*');
  } else if (ctrl && e.shiftKey && k === 'a') {
    e.preventDefault();
    const sel = getSelectionText();
    if (sel) {
      aiAsk('Explain this selection and its context', sel);
    } else {
      toggleAIPanel();
      if (state.aiOpen) setTimeout(() => els.aiInput.focus(), 60);
    }
  } else if (e.key === 'F3') {
    e.preventDefault();
    jumpToMatch(e.shiftKey ? -1 : 1, false);
  } else if (e.key === 'Escape' && state.aiOpen && !state.aiRequest) {
    closeAIPanel();
  }
});

/* ---------------- Init ---------------- */

(async function init() {
  const saved = await api.getSettings();
  Object.assign(state.settings, saved, {
    view: saved.view || 'notes',
    panelOpen: saved.panelOpen !== false,
    sidebarWidth: clampSidebarWidth(saved.sidebarWidth),
    geminiKey: saved.geminiKey || '',
    geminiModel: saved.geminiModel || 'gemini-3.6-flash',
    viewMode: saved.viewMode || 'split'
  });
  applySettings();
  setMode(state.settings.viewMode, false);
  state.view = state.settings.view;
  state.lastView = state.view;
  switchView(state.view);
  api.onAIChunk((t) => { if (state.aiChunk) state.aiChunk(t); });
  api.onAIDone((r) => { if (state.aiDone) state.aiDone(r); });
  state.folders = await api.listFolders();
  await loadNotes();
})();