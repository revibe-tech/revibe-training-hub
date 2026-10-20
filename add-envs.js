const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error(`No .env.local next to this script (${envPath}). Add your NEXT_PUBLIC_* keys there first.`);
  process.exit(1);
}
const envContent = fs.readFileSync(envPath, 'utf8');

const vars = [];
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed.startsWith('NEXT_PUBLIC_')) {
    const parts = trimmed.split('=');
    const name = parts[0].trim();
    let value = parts.slice(1).join('=').trim();
    // Remove quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    vars.push({ name, value });
  }
});

console.log(`Parsed ${vars.length} environment variables.`);
if (!vars.length) {
  console.error('No NEXT_PUBLIC_* lines found in .env.local.');
  process.exit(1);
}

const targets = ['production', 'preview', 'development'];

// Resolves to null on success, or the CLI's last error line.
function runVercel(args, stdinValue) {
  return new Promise((resolve) => {
    const child = execFile('vercel', args, { timeout: 30000 }, (error, _stdout, stderr) => {
      resolve(error ? (String(stderr || '').trim().split('\n').pop() || error.message) : null);
    });
    // Vercel prompts for the value on stdin when --value is omitted, which
    // avoids passing the secret through a shell-interpolated argv string.
    if (stdinValue !== undefined && child.stdin) {
      child.stdin.end(stdinValue);
    }
  });
}

async function main() {
  const failed = [];
  for (const v of vars) {
    for (const target of targets) {
      process.stdout.write(`Adding ${v.name} to ${target}... `);
      // Pass args as an array (no shell interpolation) and stream the value
      // on stdin so secrets containing quotes, $, or ` are safe. One at a
      // time: parallel `vercel env add` calls trip over each other.
      const problem = await runVercel(['env', 'add', v.name, target, '--yes', '--force'], v.value);
      console.log(problem ? `failed: ${problem}` : 'done');
      if (problem) failed.push(`${v.name} (${target})`);
    }
  }

  const total = vars.length * targets.length;
  if (failed.length) {
    console.error(`\n${failed.length} of ${total} failed: ${failed.join(', ')}.`);
    console.error('Check the errors above (e.g. run `vercel login` and `vercel link` in this folder), then run this again.');
    process.exit(1);
  }
  console.log(`\nAll ${total} set in Vercel (production, preview and development).`);
}

main();

