// Drives frontend/index.html in JSDOM to verify the Open-button reentrancy guard.
//
// What we're characterizing: when a user clicks Open, waits for the file
// dialog to appear, clicks Open again while the dialog is up, then picks a
// file, exactly ONE dialog invocation should happen. A second invocation
// would mean a second dialog pops up after the first closes — the actual
// bug being chased.
//
// Run: node tests/open-button.test.js

const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const assert = require('assert');

const HTML_PATH = path.join(__dirname, '..', 'frontend', 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

function makeMocks() {
  let invokeCalls = [];
  let pendingDialog = null;
  let initialFileResolver = null;

  const invoke = (cmd, args) => {
    invokeCalls.push({ cmd, args });
    if (cmd === 'open_file_dialog') {
      return new Promise((resolve) => { pendingDialog = resolve; });
    }
    if (cmd === 'get_initial_file') {
      return new Promise((resolve) => { initialFileResolver = resolve; });
    }
    return Promise.resolve(null);
  };

  return {
    invoke,
    invokeCalls,
    resolveDialog: (v) => { const r = pendingDialog; pendingDialog = null; r(v); },
    resolveInitialFile: (v) => { initialFileResolver && initialFileResolver(v); },
    isDialogOpen: () => pendingDialog !== null,
  };
}

function buildDom(mocks) {
  const vc = new VirtualConsole();
  vc.on('error', (err) => console.error('JSDOM error:', err));
  // Suppress noise but surface real errors:
  vc.on('jsdomError', (err) => {
    const msg = String(err && err.message || err);
    if (msg.includes('Could not load') || msg.includes('Not implemented')) return;
    console.error('jsdomError:', msg);
  });

  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    virtualConsole: vc,
    pretendToBeVisual: true,
    beforeParse(window) {
      window.__TAURI__ = {
        core: { invoke: mocks.invoke },
        event: { listen: () => Promise.resolve(() => {}) },
        window: { getCurrentWindow: () => ({ onDragDropEvent: () => Promise.resolve() }) },
      };
      // External <script src> won't be fetched; provide minimal stubs for
      // anything the inline script touches at startup.
      window.marked = {
        use: () => {},
        parse: (s) => `<p>${s}</p>`,
      };
      window.hljs = {
        getLanguage: () => null,
        highlight: () => ({ value: '' }),
        highlightAuto: () => ({ value: '' }),
      };
    },
  });
  return dom;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function flush() {
  // Let microtasks + a couple macrotasks drain so the inline async code
  // (init() IIFE, click handlers' awaits) settles.
  for (let i = 0; i < 5; i++) await sleep(0);
}

async function run() {
  const mocks = makeMocks();
  const dom = buildDom(mocks);
  const { window } = dom;
  const { document } = window;

  await flush();
  // Resolve the get_initial_file promise with null so init() completes.
  mocks.resolveInitialFile(null);
  await flush();

  const openBtn = document.getElementById('open-btn');
  assert.ok(openBtn, 'open button must exist');
  assert.strictEqual(openBtn.disabled, false, 'open btn starts enabled');

  // --- Click 1: dialog should open ---
  openBtn.click();
  await flush();

  const dialogInvokes1 = mocks.invokeCalls.filter((c) => c.cmd === 'open_file_dialog').length;
  assert.strictEqual(dialogInvokes1, 1, 'click 1 triggers exactly 1 dialog invoke');
  assert.strictEqual(openBtn.disabled, true, 'after click 1, open btn is disabled');
  assert.ok(mocks.isDialogOpen(), 'dialog should be open');

  // --- Click 2 while dialog is open: must NOT enqueue another dialog ---
  openBtn.click();
  openBtn.click();
  openBtn.click();
  await flush();

  const dialogInvokes2 = mocks.invokeCalls.filter((c) => c.cmd === 'open_file_dialog').length;
  assert.strictEqual(
    dialogInvokes2,
    1,
    `clicks while dialog is open must NOT cause a 2nd invoke (saw ${dialogInvokes2})`,
  );
  assert.strictEqual(openBtn.disabled, true, 'open btn stays disabled while dialog open');

  // --- Resolve dialog with no selection (user cancelled) ---
  mocks.resolveDialog(null);
  await flush();
  await sleep(350); // wait past the lockout window

  assert.strictEqual(openBtn.disabled, false, 'after lockout, open btn is re-enabled');
  const dialogInvokes3 = mocks.invokeCalls.filter((c) => c.cmd === 'open_file_dialog').length;
  assert.strictEqual(dialogInvokes3, 1, 'no extra invoke fires after dialog closes');

  // --- New click after close should work (single dialog) ---
  openBtn.click();
  await flush();
  const dialogInvokes4 = mocks.invokeCalls.filter((c) => c.cmd === 'open_file_dialog').length;
  assert.strictEqual(dialogInvokes4, 2, 'fresh click after close opens a fresh dialog');
  assert.strictEqual(openBtn.disabled, true, 'open btn disabled again');

  // --- Resolve with a file: should add a tab, then re-enable after lockout ---
  mocks.resolveDialog({
    filePath: '/tmp/hello.md',
    dirUrl: 'file:///tmp/',
    name: 'hello.md',
    content: '# Hi',
    mtime: 1,
  });
  await flush();
  await sleep(350);

  assert.strictEqual(openBtn.disabled, false, 'after file selected + lockout, open btn re-enabled');

  // --- Now do the user's exact reproduction: click, wait, click during dialog ---
  openBtn.click();
  await flush();
  const beforeReResolve = mocks.invokeCalls.filter((c) => c.cmd === 'open_file_dialog').length;
  assert.strictEqual(openBtn.disabled, true);

  // Simulate the user mashing the button while the dialog is open
  for (let i = 0; i < 10; i++) openBtn.click();
  await flush();
  const duringDialog = mocks.invokeCalls.filter((c) => c.cmd === 'open_file_dialog').length;
  assert.strictEqual(
    duringDialog,
    beforeReResolve,
    `mashing during open dialog must not enqueue (was ${beforeReResolve}, now ${duringDialog})`,
  );

  // Now resolve dialog with a file
  mocks.resolveDialog({
    filePath: '/tmp/hello2.md',
    dirUrl: 'file:///tmp/',
    name: 'hello2.md',
    content: '# Hi 2',
    mtime: 2,
  });
  await flush();
  await sleep(350);

  const afterClose = mocks.invokeCalls.filter((c) => c.cmd === 'open_file_dialog').length;
  assert.strictEqual(
    afterClose,
    beforeReResolve,
    `NO extra dialog must fire after resolving with a file (had ${beforeReResolve}, now ${afterClose})`,
  );
  assert.strictEqual(openBtn.disabled, false, 'open btn is re-enabled after resolve+lockout');

  // --- Direct concurrent-call test: bypasses the button entirely. ---
  // This exercises the in-function `openDialogInFlight` guard. If JSDOM
  // happened to suppress clicks on disabled buttons (it does, per spec) the
  // earlier tests wouldn't have exercised this guard — WebView2 may NOT
  // suppress, in which case the flag is our last line of defence.
  const directOpenPickedFile = window.openPickedFile;
  assert.strictEqual(typeof directOpenPickedFile, 'function', 'openPickedFile is exposed on window');

  const before = mocks.invokeCalls.filter((c) => c.cmd === 'open_file_dialog').length;
  // Fire 5 concurrent calls — only the first should reach invoke.
  const ps = [
    directOpenPickedFile(),
    directOpenPickedFile(),
    directOpenPickedFile(),
    directOpenPickedFile(),
    directOpenPickedFile(),
  ];
  await flush();
  const duringConcurrent = mocks.invokeCalls.filter((c) => c.cmd === 'open_file_dialog').length;
  assert.strictEqual(
    duringConcurrent - before,
    1,
    `5 concurrent openPickedFile() calls must produce 1 invoke (got ${duringConcurrent - before})`,
  );

  // Resolve. After resolve, ALL 5 promises should settle and no extra invoke should fire.
  mocks.resolveDialog(null);
  await Promise.all(ps);
  await flush();
  await sleep(350);
  const afterConcurrent = mocks.invokeCalls.filter((c) => c.cmd === 'open_file_dialog').length;
  assert.strictEqual(
    afterConcurrent,
    duringConcurrent,
    `no extra invokes after concurrent batch resolves (was ${duringConcurrent}, now ${afterConcurrent})`,
  );

  // --- Queued-click race test ---
  // Simulates the actual WebView2 bug the user hit: a click was queued at
  // the OS input layer while the dialog was open and gets dispatched as a
  // DOM click AFTER the dialog closes. If openPickedFile re-enables
  // synchronously, that queued click would open a second dialog.
  const queuedBefore = mocks.invokeCalls.filter((c) => c.cmd === 'open_file_dialog').length;
  openBtn.click();                          // T0: open
  await flush();
  assert.strictEqual(openBtn.disabled, true, 'btn disabled while dialog open');
  mocks.resolveDialog({                     // T1: user picks file
    filePath: '/tmp/raced.md',
    dirUrl: 'file:///tmp/',
    name: 'raced.md',
    content: '# Raced',
    mtime: 3,
  });
  await flush();
  // T2: queued click fires NOW, before the 250ms re-enable timer.
  // Button is still disabled / flag still true → must be a no-op.
  openBtn.click();
  await flush();
  const queuedAfter = mocks.invokeCalls.filter((c) => c.cmd === 'open_file_dialog').length;
  assert.strictEqual(
    queuedAfter - queuedBefore,
    1,
    `queued click immediately after dialog resolve must NOT open another dialog (saw ${queuedAfter - queuedBefore} new invokes)`,
  );
  assert.strictEqual(openBtn.disabled, true, 'btn stays disabled during the post-resolve lockout window');

  // After the lockout expires the button must come back.
  await sleep(350);
  assert.strictEqual(openBtn.disabled, false, 'btn re-enables after the lockout window');

  console.log('All assertions passed.');
  console.log('Total open_file_dialog invokes:', queuedAfter);
  dom.window.close();
}

run().catch((err) => {
  console.error('TEST FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
