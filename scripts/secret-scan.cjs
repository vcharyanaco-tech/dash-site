const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0').filter(Boolean);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:ghp|github_pat|sk|xox[baprs])_[A-Za-z0-9_-]{12,}/,
  /\bpassword\s*[:=]\s*['"`](?!password|secret|process\.env)[A-Za-z0-9@#$%_-]{8,}['"`]/i,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*['"`][A-Za-z0-9+/=_-]{16,}['"`]/i
];
const ignored = new Set(['dash-site-improvement-prompt.md']);
const findings = [];

for (const file of tracked) {
  if (ignored.has(file) || file.includes('node_modules/') || file.startsWith('data/')) continue;
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (err) { continue; }
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) {
      findings.push(file + ' matches ' + pattern);
      break;
    }
  }
}

if (findings.length) {
  console.error('Potential secrets found in tracked files:\n' + findings.join('\n'));
  process.exit(1);
}
console.log('Secret scan passed (' + tracked.length + ' tracked files checked).');
