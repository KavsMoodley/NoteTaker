/* Shared Markdown renderer — used by the renderer (browser) and main process (export).
 * UMD: require() in Node, window.MarkdownRenderer in the browser. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MarkdownRenderer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function safeHref(url) {
    const u = String(url || '').trim();
    if (/^(https?:|mailto:)/i.test(u)) return u;
    if (u.charAt(0) === '#') return u;
    return '#';
  }

  function inlineMd(str) {
    return str
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, url) =>
        `<a href="${safeHref(url)}" target="_blank" rel="noopener">${text}</a>`);
  }

  function parseTableRow(line) {
    let s = line.trim();
    if (s.charAt(0) !== '|') return null;
    if (s.charAt(s.length - 1) !== '|') s += '|';
    return s
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim());
  }

  function isTableSeparator(cells) {
    return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
  }

  function alignFrom(cell) {
    if (!cell || cell.indexOf(':') === -1) return null;
    const l = cell.charAt(0) === ':';
    const r = cell.charAt(cell.length - 1) === ':';
    return l && r ? 'center' : r ? 'right' : 'left';
  }

  function renderMarkdown(src) {
    const lines = String(src || '').split('\n');
    let html = '';
    let listType = null;
    let pre = null;
    let table = null;

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
    const closeTable = () => {
      if (table === null) return;
      const rows = table;
      table = null;
      let header = null;
      let body = rows;
      let aligns = null;
      if (rows.length >= 2 && isTableSeparator(rows[1])) {
        header = rows[0];
        aligns = rows[1].map(alignFrom);
        body = rows.slice(2);
      }
      const cell = (text, i, tag) => {
        const style = aligns && aligns[i] ? ` style="text-align:${aligns[i]}"` : '';
        return `<${tag}${style}>${inlineMd(escapeHtml(text))}</${tag}>`;
      };
      html += '<table>\n';
      if (header) {
        html += '<thead><tr>' + header.map((c, i) => cell(c, i, 'th')).join('') + '</tr></thead>\n';
      }
      if (body.length) {
        html += '<tbody>\n';
        for (const row of body) {
          html += '<tr>' + row.map((c, i) => cell(c, i, 'td')).join('') + '</tr>\n';
        }
        html += '</tbody>\n';
      }
      html += '</table>\n';
    };

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');

      if (line.startsWith('```')) {
        closeTable();
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

      const row = parseTableRow(line);
      if (row !== null) {
        if (table === null && !isTableSeparator(row)) {
          closeList();
          table = [];
        }
        if (table !== null) {
          table.push(row);
          continue;
        }
      } else {
        closeTable();
      }

      const heading = line.match(/^(#{1,4})\s+(.*)/);
      if (heading) {
        closeList();
        const lvl = heading[1].length;
        html += `<h${lvl}>${inlineMd(escapeHtml(heading[2]))}</h${lvl}>\n`;
        continue;
      }

      const task = line.match(/^\s*([-*+]|\d+\.)\s+\[([ xX])\]\s+(.*)/);
      if (task) {
        const checked = task[2].toLowerCase() === 'x' ? ' checked' : '';
        const wanted = /^\s*\d+\./.test(line) ? 'ol' : 'ul';
        if (listType !== wanted) {
          closeList();
          listType = wanted;
          html += `<${wanted}>\n`;
        }
        html += `<li class="task"><input type="checkbox" disabled${checked}>${inlineMd(escapeHtml(task[3]))}</li>\n`;
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
    closeTable();
    closeList();
    if (!html.trim()) return '<p><em>Empty note</em></p>';
    return html;
  }

  return { renderMarkdown: renderMarkdown };
});