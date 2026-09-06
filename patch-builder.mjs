import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';

const exePath = 'D:\\Meow\\node_modules\\app-builder-bin\\win\\x64\\app-builder.exe';
const backupPath = exePath + '.bak';

// Restore clean backup
if (existsSync(backupPath)) {
  copyFileSync(backupPath, exePath);
  console.log('Restored from backup');
}

const buf = readFileSync(exePath);

// Find '-snld' = 2D 73 6E 6C 64
// Replace 'd' (0x64) with null (0x00) so the Go string "-snld" becomes "-snl\0"
// When passed to 7za.exe on Windows, CreateProcess arg parsing stops at null
// Actually a better approach: find the 5-byte string at our known offset
const offset = 9019367;
const expected = Buffer.from([0x2D, 0x73, 0x6E, 0x6C, 0x64]); // -snld
const actual = buf.slice(offset, offset + 5);

console.log('At offset', offset, ':', actual.toString('hex'), '=', actual.toString());

if (actual.equals(expected)) {
  // Replace 'd' (last byte, 0x64) with '\r' (0x0D) -- carriage return
  // 7-zip will see "-snl\r" and may treat it as just "-snl" with trailing whitespace
  // Actually, let's replace with 0x00 (null) to terminate the string
  buf[offset + 4] = 0x00;
  writeFileSync(exePath, buf);
  console.log('Patched: replaced d(0x64) with null(0x00) at offset', offset + 4);
} else {
  // Already patched with space - replace the space back to null
  const alreadyPatched = Buffer.from([0x2D, 0x73, 0x6E, 0x6C, 0x20]); // -snl<space>
  if (actual.equals(alreadyPatched)) {
    buf[offset + 4] = 0x00;
    writeFileSync(exePath, buf);
    console.log('Re-patched: replaced space(0x20) with null(0x00) at offset', offset + 4);
  } else {
    console.log('Unexpected bytes, searching...');
    // Full search for -snld
    const search = Buffer.from([0x2D, 0x73, 0x6E, 0x6C, 0x64]);
    let pos = 0, count = 0;
    while ((pos = buf.indexOf(search, pos)) !== -1) {
      buf[pos + 4] = 0x00;
      console.log('Patched at', pos);
      count++;
      pos += 5;
    }
    if (count > 0) writeFileSync(exePath, buf);
    console.log('Done:', count, 'patches');
  }
}
