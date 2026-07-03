// Verifies each format operation produces exactly ONE execCommand call.
// In a real textarea this means each format is ONE undo step (Ctrl+Z works).
//
// JSDOM doesn't implement execCommand, but we stub it and assert call shape.

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

const { window } = dom;
const { document } = window;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  await sleep(20); // let inline script settle

  // Stub execCommand to record calls AND apply them (so editor.value reflects edits).
  const execCalls = [];
  document.execCommand = (cmd, ui, value) => {
    execCalls.push({ cmd, ui, value });
    if (cmd === 'insertText') {
      const editor = document.getElementById('editor');
      const s = editor.selectionStart;
      const e = editor.selectionEnd;
      editor.value = editor.value.slice(0, s) + (value || '') + editor.value.slice(e);
      const caret = s + (value || '').length;
      editor.setSelectionRange(caret, caret);
      editor.dispatchEvent(new window.Event('input', { bubbles: true }));
      return true;
    }
    return false;
  };

  const t = window.__paddTest;
  assert.ok(t && typeof t.runFormat === 'function', '__paddTest.runFormat exposed');
  assert.ok(typeof t.addOrFocusTab === 'function', '__paddTest.addOrFocusTab exposed');

  // Set up a tab in edit mode
  t.addOrFocusTab({
    filePath: '/tmp/test.md',
    dirUrl: 'file:///tmp/',
    name: 'test.md',
    content: '',
    mtime: 1,
  });
  const tab = t.getActiveTab();
  tab.mode = 'edit';

  const editor = document.getElementById('editor');
  // Force editor visible + populated regardless of renderActiveTab state.
  editor.classList.remove('hidden');

  function setEditorState(value, start, end) {
    editor.value = value;
    editor.setSelectionRange(start, end || start);
  }

  function runAndCheck(label, fmtName, initial, expected) {
    execCalls.length = 0;
    // Parse marker string like "hello [world]"
    let start, end, value;
    if (initial.includes('[') && initial.includes(']')) {
      start = initial.indexOf('[');
      end = initial.indexOf(']') - 1;
      value = initial.replace('[', '').replace(']', '');
    } else {
      start = initial.indexOf('|');
      end = start;
      value = initial.replace('|', '');
    }
    setEditorState(value, start, end);
    t.runFormat(fmtName);
    assert.strictEqual(
      execCalls.length, 1,
      `${label}: expected 1 execCommand call, got ${execCalls.length}`,
    );
    assert.strictEqual(
      execCalls[0].cmd, 'insertText',
      `${label}: expected insertText, got ${execCalls[0].cmd}`,
    );
    // And the final editor value should match.
    // The expected string uses one of: a single '|' for caret position, or
    // '[' + ']' wrapping the selected text. Strip only those markers — NOT
    // any literal '['/']' that may legitimately appear in markdown output
    // (e.g. task lists "- [ ] foo" or link syntax "[text](url)").
    if (expected !== undefined) {
      let expectedValue;
      if (expected.includes('|')) {
        expectedValue = expected.replace('|', '');
      } else {
        expectedValue = expected.replace('[', '').replace(']', '');
      }
      const actualValue = editor.value;
      assert.strictEqual(
        actualValue, expectedValue,
        `${label}: editor value mismatch\n  expected: ${JSON.stringify(expectedValue)}\n  actual:   ${JSON.stringify(actualValue)}`,
      );
    }
  }

  runAndCheck('bold',      'bold',      'say [hello] world',  'say **[hello]** world');
  runAndCheck('italic',    'italic',    '[foo]',              '*[foo]*');
  runAndCheck('strike',    'strike',    '[gone]',             '~~[gone]~~');
  runAndCheck('code',      'code',      '[x]',                '`[x]`');
  runAndCheck('h1',        'h1',        'Title|',             '# Title|');
  runAndCheck('h2',        'h2',        'Title|',             '## Title|');
  runAndCheck('h3',        'h3',        'Title|',             '### Title|');
  runAndCheck('bullet',    'bullet',    'task|',              '- task|');
  runAndCheck('numbered',  'numbered',  'task|',              '1. task|');
  runAndCheck('task',      'task',      'thing|',             '- [ ] thing|');
  runAndCheck('quote',     'quote',     'wise|',              '> wise|');
  runAndCheck('link',      'link',      'click [here]',       'click [[here]](url)');
  runAndCheck('image',     'image',     '[logo]',             '![[logo]](image-url)');
  runAndCheck('codeblock', 'codeblock', 'before|after',       'before\n```\ncode\n```\nafter');
  runAndCheck('mermaid',   'mermaid',   '|',                  '```mermaid\ngraph TD\n  A --> B\n```');
  runAndCheck('hr',        'hr',        'before|after',       'before\n---\nafter');
  runAndCheck('bold off',  'bold',      'say [**hello**] world','say [hello] world');

  console.log(`All ${17} format ops produce exactly one execCommand call (one undo step each).`);
  window.close();
}

run().catch((err) => {
  console.error('TEST FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
