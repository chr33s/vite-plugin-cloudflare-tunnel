#!/usr/bin/env node

import { execSync } from 'child_process';
import readline from 'readline';
import fs from 'fs';

function usage() {
  console.error('Usage: npm run set-secret -- <VAR_NAME>');
  console.error('Example: npm run set-secret -- DISCORD_PUBLIC_KEY');
}

const varName = process.argv[2];

if (!varName) {
  usage();
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});

rl.question(`Enter value for ${varName}: `, (value) => {
  rl.close();

  if (!value) {
    console.error('No value provided, aborting.');
    process.exit(1);
  }

  try {
    // Save secret to Cloudflare via wrangler (interactive confirmation suppressed by piping value)
    execSync(`echo "${value}" | wrangler secret put ${varName}`, { stdio: 'inherit', shell: '/bin/bash' });

    const devVarsPath = '.dev.vars';
    let content = '';
    if (fs.existsSync(devVarsPath)) {
      content = fs.readFileSync(devVarsPath, 'utf8');
      const line = `${varName}="${value}"`;
      if (new RegExp(`^${varName}=`, 'm').test(content)) {
        // Replace existing line
        content = content.replace(new RegExp(`^${varName}=.*`, 'm'), line);
      } else {
        // Append
        if (!content.endsWith('\n')) content += '\n';
        content += line + '\n';
      }
    } else {
      content = `${varName}="${value}"\n`;
    }

    fs.writeFileSync(devVarsPath, content);
    console.log(`✅ ${varName} stored in .dev.vars and Cloudflare secret updated.`);
  } catch (err) {
    console.error('Failed to set secret:', err);
    process.exit(1);
  }
});
