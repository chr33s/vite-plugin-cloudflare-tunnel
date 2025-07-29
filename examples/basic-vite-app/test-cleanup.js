#!/usr/bin/env node
/**
 * Test script to verify cloudflared process cleanup
 * This script starts a Vite dev server and then terminates it
 * in various ways to ensure cloudflared is properly cleaned up.
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
const sleep = promisify(setTimeout);

async function testCleanup(signal = 'SIGTERM') {
  console.log(`\n🧪 Testing cleanup with ${signal}...`);
  
  // Start Vite dev server
  const vite = spawn('npm', ['run', 'dev'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });
  
  console.log(`📦 Started Vite process (PID: ${vite.pid})`);
  
  // Monitor output
  vite.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('cloudflared')) {
      console.log(`🌐 ${output.trim()}`);
    }
  });
  
  vite.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('cloudflared')) {
      console.log(`⚠️  ${output.trim()}`);
    }
  });
  
  // Wait for tunnel to start
  console.log('⏳ Waiting for tunnel to start...');
  await sleep(10000);
  
  // Check for cloudflared processes before termination
  console.log('🔍 Checking for cloudflared processes before termination...');
  const beforePs = spawn('pgrep', ['-f', 'cloudflared'], { stdio: 'pipe' });
  beforePs.stdout.on('data', (data) => {
    const pids = data.toString().trim().split('\n').filter(Boolean);
    console.log(`📊 Found ${pids.length} cloudflared process(es): ${pids.join(', ')}`);
  });
  
  await sleep(2000);
  
  // Terminate the Vite process
  console.log(`🛑 Sending ${signal} to Vite process...`);
  vite.kill(signal);
  
  // Wait for cleanup
  console.log('⏳ Waiting for cleanup...');
  await sleep(5000);
  
  // Check for remaining cloudflared processes
  console.log('🔍 Checking for remaining cloudflared processes...');
  const afterPs = spawn('pgrep', ['-f', 'cloudflared'], { stdio: 'pipe' });
  
  let foundProcesses = false;
  afterPs.stdout.on('data', (data) => {
    const pids = data.toString().trim().split('\n').filter(Boolean);
    if (pids.length > 0) {
      console.log(`❌ Found ${pids.length} orphaned cloudflared process(es): ${pids.join(', ')}`);
      foundProcesses = true;
    }
  });
  
  afterPs.on('close', (code) => {
    if (code !== 0 && !foundProcesses) {
      console.log('✅ No orphaned cloudflared processes found!');
    }
  });
  
  await sleep(2000);
}

async function main() {
  console.log('🚀 Testing Cloudflare Tunnel Vite Plugin Process Cleanup');
  console.log('This test verifies that cloudflared processes are properly cleaned up');
  console.log('when the parent Vite process is terminated in various ways.\n');
  
  // Test different termination signals
  const signals = ['SIGTERM', 'SIGINT'];
  
  for (const signal of signals) {
    try {
      await testCleanup(signal);
    } catch (error) {
      console.error(`❌ Test failed for ${signal}:`, error.message);
    }
  }
  
  console.log('\n🏁 Cleanup tests completed!');
  console.log('💡 If you see orphaned processes, they indicate cleanup issues.');
}

// Handle our own cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted, cleaning up...');
  process.exit(0);
});

// Run the main function if this script is executed directly
main().catch(console.error); 