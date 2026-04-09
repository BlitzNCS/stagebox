const readline = require('readline');

let rl = null;

function getRL() {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  return rl;
}

function close() {
  if (rl) {
    rl.close();
    rl = null;
  }
}

// Print a section header
function header(text) {
  const line = '='.repeat(text.length + 4);
  console.log(`\n${line}`);
  console.log(`  ${text}`);
  console.log(line);
}

// Print a sub-header
function subheader(text) {
  console.log(`\n--- ${text} ---\n`);
}

// Print a status line
function ok(text) { console.log(`  [OK]   ${text}`); }
function fail(text) { console.log(`  [FAIL] ${text}`); }
function warn(text) { console.log(`  [WARN] ${text}`); }
function info(text) { console.log(`  [INFO] ${text}`); }
function step(n, text) { console.log(`\n  Step ${n}: ${text}`); }

// Ask a yes/no question
function confirm(question) {
  return new Promise(resolve => {
    getRL().question(`  ${question} (y/n) > `, answer => {
      resolve(answer.trim().toLowerCase().startsWith('y'));
    });
  });
}

// Ask for free-form input
function ask(question, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  return new Promise(resolve => {
    getRL().question(`  ${question}${suffix} > `, answer => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

// Show a numbered menu, return the chosen index
function menu(question, options) {
  return new Promise(resolve => {
    console.log(`\n  ${question}\n`);
    options.forEach((opt, i) => console.log(`    [${i + 1}] ${opt}`));
    console.log();
    getRL().question('  Choose > ', answer => {
      const idx = parseInt(answer.trim(), 10) - 1;
      resolve(idx >= 0 && idx < options.length ? idx : 0);
    });
  });
}

// Wait for user to press Enter
function pause(message) {
  return new Promise(resolve => {
    getRL().question(`  ${message || 'Press Enter to continue...'}`, () => resolve());
  });
}

// Print a warning box
function warningBox(lines) {
  const maxLen = Math.max(...lines.map(l => l.length));
  const border = '*'.repeat(maxLen + 6);
  console.log(`\n  ${border}`);
  lines.forEach(l => console.log(`  *  ${l.padEnd(maxLen)}  *`));
  console.log(`  ${border}\n`);
}

module.exports = { header, subheader, ok, fail, warn, info, step, confirm, ask, menu, pause, warningBox, close };
