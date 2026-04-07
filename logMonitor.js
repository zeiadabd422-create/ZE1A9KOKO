#!/usr/bin/env node

/**
 * LOG MONITOR - Real-time log filtering and analysis
 * 
 * Usage:
 *   node logMonitor.js
 *   node logMonitor.js session
 *   node logMonitor.js error
 *   node logMonitor.js queue
 *   node logMonitor.js cooldown
 */

const fs = require('fs');
const readline = require('readline');

const filterType = process.argv[2];

console.log(`
╔════════════════════════════════════════════════════════════════════════════════╗
║                      GATEWAY LOG MONITOR                                       ║
║                    Monitoring console.log output                               ║
╚════════════════════════════════════════════════════════════════════════════════╝

FILTERS:
  session  - Show only [SESSION] logs
  error    - Show only [ERROR] logs
  queue    - Show only [QUEUE] logs
  cooldown - Show only [ABUSE:COOLDOWN] logs
  parsed   - Show only [PARSED] logs
  step     - Show only [STEP] logs
  success  - Show only [SUCCESS] logs

USAGE:
  npm start | node logMonitor.js [filter]

EXAMPLES:
  # Monitor sessions:
  npm start | node logMonitor.js session

  # Monitor errors:
  npm start | node logMonitor.js error

  # Monitor queue (no filter):
  npm start | node logMonitor.js queue

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

const logPatterns = {
  session: /\[SESSION/,
  error: /\[ERROR/,
  queue: /\[QUEUE/,
  cooldown: /\[ABUSE:COOLDOWN/,
  parsed: /\[PARSED/,
  step: /\[STEP/,
  success: /\[SUCCESS/,
  interaction: /\[INTERACTION/,
};

let lineCount = 0;
let matchCount = 0;

rl.on('line', (line) => {
  lineCount++;
  
  // Apply filter if specified
  if (filterType && logPatterns[filterType]) {
    if (!logPatterns[filterType].test(line)) {
      return;
    }
  }

  matchCount++;
  
  // Color output based on type
  let colored = line;
  if (line.includes('[ERROR]')) {
    colored = colors.red + line + colors.reset;
  } else if (line.includes('[SESSION]')) {
    colored = colors.blue + line + colors.reset;
  } else if (line.includes('[QUEUE]')) {
    colored = colors.cyan + line + colors.reset;
  } else if (line.includes('[ABUSE:COOLDOWN]')) {
    colored = colors.yellow + line + colors.reset;
  } else if (line.includes('[STEP]')) {
    colored = colors.magenta + line + colors.reset;
  } else if (line.includes('[SUCCESS]')) {
    colored = colors.green + line + colors.reset;
  }

  console.log(colored);
});

rl.on('close', () => {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Total lines: ${lineCount}, Filtered matches: ${matchCount}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});
