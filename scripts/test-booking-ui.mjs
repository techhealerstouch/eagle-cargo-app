#!/usr/bin/env node

/**
 * Runner Script for Booking UI Tests (Sender & Guest)
 * 
 * Usage:
 *   node scripts/test-booking-ui.mjs
 *   npm run test:ui
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('\n============================================================');
console.log('   🦅 Eagle Cargo - Booking UI Automated Test Suite');
console.log('   Testing: Sender Booking (/book) & Guest Booking (/guest/book)');
console.log('============================================================\n');

const vitestMjs = path.join(projectRoot, 'node_modules', 'vitest', 'vitest.mjs');
const testFile = path.join('resources', 'js', 'tests', 'booking-ui.test.tsx');

const args = [vitestMjs, 'run', testFile, '--reporter=default'];

const child = spawn(process.execPath, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
  },
});

child.on('close', (code) => {
  console.log('\n============================================================');
  if (code === 0) {
    console.log('  ✅ SUCCESS: All Booking Sender and Guest UI tests passed!');
  } else {
    console.log(`  ❌ FAILURE: Some tests failed with exit code ${code}.`);
  }
  console.log('============================================================\n');
  process.exit(code ?? 1);
});
