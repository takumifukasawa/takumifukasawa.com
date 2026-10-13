// How to find and stop whatever is holding a TCP port, in the shell the reader is actually in.
//
// This project is developed on two machines (Windows and macOS; docs/handoff.md has the "別の PC で再開する"
// section), so a hard-coded `lsof` is wrong half the time -- and the half that is wrong is the half the
// author cannot test by running it. That is also why this lives in lib/ with a test rather than inline in
// dev-lab.ts: the branch for the other platform would otherwise never be exercised at all.
//
// `platform` is passed in rather than read from `process` so both branches are reachable from a test.
export const portConflictHint = (port: number, platform: NodeJS.Platform = process.platform): string =>
  platform === 'win32'
    ? // PowerShell, which is the default shell on Windows 11. Git Bash mangles `taskkill /PID` into a path
      // unless the slashes are doubled, so a PowerShell-native pair avoids a trap that costs a few minutes.
      `Get-NetTCPConnection -LocalPort ${port} | Select-Object OwningProcess` + `, then: Stop-Process -Id <pid>`
    : `lsof -nP -iTCP:${port} -sTCP:LISTEN` + `, then: kill <pid>`;
