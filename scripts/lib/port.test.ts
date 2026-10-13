import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { portConflictHint } from './port.ts';

// The whole reason this function exists is that only one of its branches can be verified by running it on
// any given machine. Pin both, including that neither leaks the other platform's command.
describe('portConflictHint', () => {
  const win = portConflictHint(5173, 'win32');
  const mac = portConflictHint(5173, 'darwin');
  const linux = portConflictHint(5173, 'linux');

  test('windows names PowerShell commands', () => {
    assert.match(win, /Get-NetTCPConnection -LocalPort 5173/);
    assert.match(win, /Stop-Process -Id/);
  });

  test('windows does not suggest lsof or kill', () => {
    assert.doesNotMatch(win, /lsof/);
    assert.doesNotMatch(win, /\bkill\b/);
  });

  test('macOS and linux name posix commands', () => {
    for (const hint of [mac, linux]) {
      assert.match(hint, /lsof -nP -iTCP:5173 -sTCP:LISTEN/);
      assert.match(hint, /kill <pid>/);
    }
  });

  test('posix does not suggest PowerShell', () => {
    assert.doesNotMatch(mac, /Stop-Process|Get-NetTCPConnection/);
  });

  test('carries the port it was given', () => {
    assert.match(portConflictHint(4321, 'win32'), /4321/);
    assert.match(portConflictHint(4321, 'darwin'), /4321/);
  });
});
