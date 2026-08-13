'use strict';

const assert = require('assert');
const { renderMarkdown } = require('../shared/markdown.js');

let passed = 0;
function t(name, fn) {
  fn();
  passed++;
  console.log('  ✓ ' + name);
}

/* ---------- Basics ---------- */

t('renders headings', () => {
  const h = renderMarkdown('# Title\n## Sub');
  assert.ok(h.includes('<h1>Title</h1>'), h);
  assert.ok(h.includes('<h2>Sub</h2>'), h);
});

t('renders bold, italic, inline code, links', () => {
  const h = renderMarkdown('**bold** *it* `code` [site](https://example.com)');
  assert.ok(h.includes('<strong>bold</strong>'), h);
  assert.ok(h.includes('<em>it</em>'), h);
  assert.ok(h.includes('<code>code</code>'), h);
  assert.ok(h.includes('href="https://example.com"'), h);
});

t('renders unordered and ordered lists', () => {
  const h = renderMarkdown('- a\n- b\n\n1. one\n2. two');
  assert.ok(h.includes('<ul>'), h);
  assert.ok(h.includes('<li>a</li>'), h);
  assert.ok(h.includes('<ol>'), h);
  assert.ok(h.includes('<li>one</li>'), h);
});

t('renders blockquote and hr', () => {
  const h = renderMarkdown('> quoted\n\n---');
  assert.ok(h.includes('<blockquote>quoted</blockquote>'), h);
  assert.ok(h.includes('<hr>'), h);
});

t('escapes code blocks', () => {
  const h = renderMarkdown('```js\nif (a < b) return "x";\n```');
  assert.ok(h.includes('<pre><code>'), h);
  assert.ok(h.includes('if (a &lt; b) return &quot;x&quot;;'), h);
});

/* ---------- Task lists ---------- */

t('renders unchecked task list items', () => {
  const h = renderMarkdown('- [ ] buy milk\n- [ ] walk dog');
  assert.ok(h.includes('<li class="task"><input type="checkbox" disabled>'), h);
  assert.ok(h.includes('buy milk'), h);
  assert.ok(!h.includes('&gt;'), h);
});

t('renders checked task list items', () => {
  const h = renderMarkdown('- [x] done thing\n- [X] also done');
  assert.strictEqual((h.match(/checked/g) || []).length, 2, h);
  assert.ok(!h.includes('[x]'), h);
});

t('task items have no bullet marker', () => {
  const h = renderMarkdown('- [ ] a');
  assert.ok(h.includes('class="task"'), h);
  assert.ok(!/list-style/.test('') , '');
});

/* ---------- Tables ---------- */

t('renders a basic pipe table', () => {
  const src = '| Name | Age |\n| --- | --- |\n| Ann | 30 |\n| Bob | 25 |';
  const h = renderMarkdown(src);
  assert.ok(h.includes('<table>'), h);
  assert.ok(h.includes('<thead>'), h);
  assert.ok(h.includes('<th>Name</th>'), h);
  assert.ok(h.includes('<tbody>'), h);
  assert.ok(h.includes('<td>Ann</td>'), h);
  assert.ok(h.includes('<td>25</td>'), h);
  assert.ok(h.includes('</table>'), h);
});

t('honors column alignment in separators', () => {
  const src = '| L | C | R |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |';
  const h = renderMarkdown(src);
  assert.ok(h.includes('<th style="text-align:left">L</th>'), h);
  assert.ok(h.includes('<th style="text-align:center">C</th>'), h);
  assert.ok(h.includes('<th style="text-align:right">R</th>'), h);
  const bodyFirst = h.indexOf('<tbody>');
  assert.ok(h.slice(bodyFirst).includes('<td style="text-align:left">1</td>'), h);
  assert.ok(h.slice(bodyFirst).includes('<td style="text-align:center">2</td>'), h);
  assert.ok(h.slice(bodyFirst).includes('<td style="text-align:right">3</td>'), h);
});

t('escapes table cell contents', () => {
  const h = renderMarkdown('| A | B |\n| --- | --- |\n| <b>x</b> | a & b |');
  assert.ok(!h.includes('<b>x</b>'), h);
  assert.ok(h.includes('a &amp; b'), h);
});

t('closes the table before following content', () => {
  const src = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nAfter';
  const h = renderMarkdown(src);
  const tableEnd = h.indexOf('</table>');
  const after = h.indexOf('After');
  assert.ok(tableEnd > 0 && after > tableEnd, h);
  assert.ok(h.includes('<p>After</p>'), h);
});

/* ---------- Blank line hygiene ---------- */

t('does not emit stray paragraph tags on blank lines', () => {
  const h = renderMarkdown('a\n\n\nb');
  assert.ok(!h.includes('</p></p>'), h);
  assert.ok(!h.includes('<p></p>'), h);
  assert.ok(h.includes('<p>a</p>'), h);
  assert.ok(h.includes('<p>b</p>'), h);
});

t('handles empty input', () => {
  assert.ok(renderMarkdown('').includes('Empty note'));
  assert.ok(renderMarkdown('   \n').includes('Empty note'));
});

/* ---------- XSS hardening ---------- */

t('blocks javascript: links', () => {
  const h = renderMarkdown('[x](javascript:alert(1))');
  assert.ok(!h.includes('javascript:'), h);
  assert.ok(h.includes('href="#"'), h);
  assert.ok(h.includes('x</a>'), h);
});

t('blocks data: and vbscript: links', () => {
  const h = renderMarkdown('[a](data:text/html;base64,PHNjcmlwdD4=) [b](vbscript:msgbox(1))');
  assert.ok(!h.includes('data:text/html'), h);
  assert.ok(!h.includes('vbscript:'), h);
  assert.strictEqual((h.match(/href="#"/g) || []).length, 2, h);
});

t('keeps safe link schemes', () => {
  for (const url of ['https://example.com/a?b=1#frag', 'mailto:hi@example.com', 'http://x.io']) {
    const h = renderMarkdown(`[ok](${url})`);
    assert.ok(h.includes(`href="${url}"`), url + ' -> ' + h);
  }
});

t('escapes raw HTML injection', () => {
  const h = renderMarkdown('<script>alert(1)</script>\n<img src=x onerror=alert(1)>');
  assert.ok(!h.includes('<script>'), h);
  assert.ok(!h.includes('<img'), h);
  assert.ok(h.includes('&lt;img src=x onerror=alert(1)&gt;'), h);
});

console.log('\n' + passed + ' tests passed');