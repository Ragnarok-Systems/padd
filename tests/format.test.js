// Tests for the pure markdown-formatting transforms exposed on window.applyFormat.
// Each case is: {name, input: {value, start, end}, format, expected: {value, start, end}}.
//
// Run: node tests/format.test.js

const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const assert = require('assert');

const HTML_PATH = path.join(__dirname, '..', 'frontend', 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

const vc = new VirtualConsole();
vc.on('jsdomError', () => {});
const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  virtualConsole: vc,
  pretendToBeVisual: true,
  beforeParse(window) {
    window.__TAURI__ = {
      core: { invoke: () => new Promise(() => {}) },
      event: { listen: () => Promise.resolve(() => {}) },
      window: { getCurrentWindow: () => ({ onDragDropEvent: () => Promise.resolve() }) },
    };
    window.marked = { use: () => {}, parse: (s) => s };
    window.hljs = { getLanguage: () => null, highlight: () => ({ value: '' }), highlightAuto: () => ({ value: '' }) };
  },
});

// Caret marker used in tests: '|' marks caret position; '[' and ']' mark selection.
function parse(input) {
  // Accepts forms like "hello |world" (caret) or "hello [world]" (selection).
  if (input.includes('[') && input.includes(']')) {
    const start = input.indexOf('[');
    const end = input.indexOf(']') - 1; // -1 because [ was already removed when we count
    const value = input.replace('[', '').replace(']', '');
    return { value, start, end };
  }
  const start = input.indexOf('|');
  const value = input.replace('|', '');
  return { value, start, end: start };
}

function format(state) {
  if (state.start === state.end) {
    return state.value.slice(0, state.start) + '|' + state.value.slice(state.start);
  }
  return state.value.slice(0, state.start) + '[' + state.value.slice(state.start, state.end) + ']' + state.value.slice(state.end);
}

let passed = 0;
let failed = 0;

function check(name, input, fmt, expected) {
  const inState = parse(input);
  const r = dom.window.applyFormat(fmt, inState.value, inState.start, inState.end);
  const actual = format(r);
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${name}`);
    console.error(`  input:    ${JSON.stringify(input)}`);
    console.error(`  format:   ${fmt}`);
    console.error(`  expected: ${JSON.stringify(expected)}`);
    console.error(`  actual:   ${JSON.stringify(actual)}`);
  }
}

// Bold — selection lands on the inner text after wrap (Typora/VSCode convention).
check('bold wraps selection',         'say [hello] world',    'bold',     'say **[hello]** world');
check('bold inserts placeholder',     'say |world',           'bold',     'say **[bold text]**world');
check('bold toggles off (inner)',     'say [**hello**] world','bold',     'say [hello] world');
check('bold toggles off (outer)',     'say **[hello]** world','bold',     'say [hello] world');

// Italic
check('italic wraps selection',       '[foo]',                'italic',   '*[foo]*');
check('italic placeholder',           '|',                    'italic',   '*[italic text]*');

// Strike
check('strike wraps',                 '[gone]',               'strike',   '~~[gone]~~');

// Inline code
check('inline code wraps',            '[x = 1]',              'code',     '`[x = 1]`');

// Headings (line-level — apply to current line regardless of selection)
check('h1 prefixes line',             'Title|',               'h1',      '# Title|');
check('h1 toggles off existing',      '# Title|',             'h1',      'Title|');
check('h2 stacks atop existing',      'Title|',               'h2',      '## Title|');

// Lists
check('bullet prefixes line',         'task|',                'bullet',  '- task|');
check('bullet toggles off',           '- task|',              'bullet',  'task|');
check('numbered prefixes',            'task|',                'numbered','1. task|');
check('task list prefixes',           'thing|',               'task',    '- [ ] thing|');

// Multi-line list selection
check('bullet across multiple lines', '[one\ntwo\nthree]',    'bullet',  '- [one\n- two\n- three]');

// Quote
check('quote prefixes',               'wisdom|',              'quote',   '> wisdom|');

// Link
check('link wraps text selection',    'click [here] now',     'link',    'click [[here]](url) now');
check('link recognises URL selection','see [https://x.com] now','link',  'see [text]([https://x.com]) now');
check('link placeholder when empty',  'see |now',             'link',    'see [[link text]](url)now');

// Image
check('image wraps text selection',   '[logo]',               'image',   '![[logo]](image-url)');

// Code block
check('codeblock inserts at caret',   'before|after',         'codeblock','before\n```\n[code]\n```\nafter');
check('codeblock with selection uses it', 'see [foo bar] now', 'codeblock','see \n```\n[foo bar]\n```\n now');
check('codeblock multi-line selection', 'before [line1\nline2] after','codeblock','before \n```\n[line1\nline2]\n```\n after');

// Mermaid
check('mermaid inserts diagram',      '|',                    'mermaid', '```mermaid\n[graph TD]\n  A --> B\n```');
check('mermaid with selection uses it','see [graph TD\n  X --> Y] now','mermaid','see \n```mermaid\n[graph TD\n  X --> Y]\n```\n now');

// HR
check('hr inserts horizontal rule',   'before|after',         'hr',      'before\n---|\nafter');

// --- Diff correctness ---
// Each format operation must produce a SINGLE minimal contiguous edit,
// otherwise execCommand can't represent it as one undoable step and Ctrl+Z
// would either undo nothing or undo too much.
const { computeMinimalDiff } = dom.window;

function checkDiff(name, oldValue, newValue) {
  const diff = computeMinimalDiff(oldValue, newValue);
  if (oldValue === newValue) {
    if (diff !== null) { failed++; console.error(`FAIL: ${name} — expected null diff for identical inputs`); return; }
    passed++; return;
  }
  if (!diff) { failed++; console.error(`FAIL: ${name} — diff was null but values differ`); return; }
  // Verify applying the diff reconstructs newValue
  const reconstructed =
    oldValue.slice(0, diff.replaceStart) + diff.replacement + oldValue.slice(diff.replaceEnd);
  if (reconstructed !== newValue) {
    failed++;
    console.error(`FAIL: ${name} — diff doesn't reconstruct newValue`);
    console.error(`  expected: ${JSON.stringify(newValue)}`);
    console.error(`  got:      ${JSON.stringify(reconstructed)}`);
    return;
  }
  // Verify minimality: the diff region's edges must NOT match between old and new.
  // (If they did, prefix/suffix scanning failed to advance.)
  const oldChunk = oldValue.slice(diff.replaceStart, diff.replaceEnd);
  if (
    diff.replacement.length > 0 && oldChunk.length > 0 &&
    diff.replacement[0] === oldChunk[0]
  ) {
    failed++;
    console.error(`FAIL: ${name} — diff isn't minimal (shared head char)`);
    return;
  }
  if (
    diff.replacement.length > 0 && oldChunk.length > 0 &&
    diff.replacement[diff.replacement.length - 1] === oldChunk[oldChunk.length - 1]
  ) {
    failed++;
    console.error(`FAIL: ${name} — diff isn't minimal (shared tail char)`);
    return;
  }
  passed++;
}

// computeMinimalDiff basic cases
checkDiff('diff identical',        'hello',     'hello');
checkDiff('diff single char',      'abc',       'axc');
checkDiff('diff append',           'abc',       'abcd');
checkDiff('diff prepend',          'bcd',       'abcd');
checkDiff('diff insert middle',    'ab',        'axyzb');
checkDiff('diff delete middle',    'abxyzc',    'abc');
checkDiff('diff full replacement', 'abc',       'xyz');

// For each format op, verify (oldValue → applyFormat(...).value) is a single contiguous diff.
function checkFormatDiff(name, input, fmtName) {
  const inState = parse(input);
  const r = dom.window.applyFormat(fmtName, inState.value, inState.start, inState.end);
  checkDiff(`${name}: format produces minimal diff`, inState.value, r.value);
}
checkFormatDiff('bold',      'say [hello] world',            'bold');
checkFormatDiff('italic',    '[foo]',                        'italic');
checkFormatDiff('strike',    '[gone]',                       'strike');
checkFormatDiff('h1',        'Title|',                       'h1');
checkFormatDiff('h2',        'Title|',                       'h2');
checkFormatDiff('bullet',    'task|',                        'bullet');
checkFormatDiff('bullet ml', '[one\ntwo\nthree]',            'bullet');
checkFormatDiff('numbered',  'task|',                        'numbered');
checkFormatDiff('task',      'thing|',                       'task');
checkFormatDiff('quote',     'wise|',                        'quote');
checkFormatDiff('code',      '[x = 1]',                      'code');
checkFormatDiff('codeblock', 'before|after',                 'codeblock');
checkFormatDiff('mermaid',   '|',                            'mermaid');
checkFormatDiff('hr',        'before|after',                 'hr');
checkFormatDiff('link',      'click [here]',                 'link');
checkFormatDiff('image',     '[logo]',                       'image');
checkFormatDiff('bold off',  'say [**hello**] world',        'bold');
checkFormatDiff('h1 off',    '# Title|',                     'h1');

console.log(`\n${passed} passed, ${failed} failed`);
dom.window.close();
process.exit(failed === 0 ? 0 : 1);
