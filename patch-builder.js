// Fast binary patch: replace -snld with -snl in app-builder.exe
const fs = require('fs');
const path = require('path');

const exePath = path.join(__dirname, 'node_modules', 'app-builder-bin', 'win', 'x64', 'app-builder.exe');
const backupPath = exePath + '.bak';

// Restore clean backup
if (fs.existsSync(backupPath)) {
  fs.copyFileSync(backupPath, exePath);
  console.log('Restored from backup');
} else {
  fs.copyFileSync(exePath, backupPath);
  console.log('Created backup');
}

const buf = fs.readFileSync(exePath);
// -snld = 2D 73 6E 6C 64
const search = Buffer.from([0x2D, 0x73, 0x6E, 0x6C, 0x64]);
// -snl  = 2D 73 6E 6C 20 (trailing space to keep same length)
const replace = Buffer.from([0x2D, 0x73, 0x6E, 0x6C, 0x20]);

let count = 0;
let pos = 0;
while ((pos = buf.indexOf(search, pos)) !== -1) {
  replace.copy(buf, pos);
  console.log(`Patched at offset ${pos}`);
  count++;
  pos += search.length;
}

if (count > 0) {
  fs.writeFileSync(exePath, buf);
  console.log(`Done: patched ${count} occurrence(s)`);
} else {
  console.log('ERROR: Pattern not found');
}

