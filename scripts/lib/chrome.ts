// Minimal headless-Chrome driver over CDP. No dependency: Node has had a global WebSocket since 22, and
// Chrome's DevTools HTTP endpoint is enough to open a tab -- puppeteer would pull in a browser download
// for what is 80 lines here.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// CHROME_PATH wins, so a machine with Chrome somewhere unusual can still run the check.
const CANDIDATES = [
  process.env['CHROME_PATH'],
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env['LOCALAPPDATA'] ?? ''}/Google/Chrome/Application/chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

export const findChrome = (): string | undefined =>
  CANDIDATES.find((path): path is string => typeof path === 'string' && path !== '' && existsSync(path));

export type PageProblem = { kind: 'exception' | 'console' | 'log'; text: string };

type Browser = {
  open: (url: string, settleMs: number) => Promise<PageProblem[]>;
  // Runs `expression` (awaited) in a fresh tab on `url` and returns its value. For questions about the browser
  // itself, such as whether WebGPU has an adapter: that needs a secure context, so `url` is a loopback page,
  // never about:blank.
  evaluate: (url: string, expression: string) => Promise<unknown>;
  close: () => void;
};

// `software`: WebGL on SwiftShader. Without these three the page gets no WebGL context at all on a machine with
// no usable GPU, and every sketch "fails". It also leaves WebGPU with no adapter (2026-10-17).
// `gpu`: the machine's GPU, for WebGPU sketches. SwiftShader's WebGPU (--use-webgpu-adapter=swiftshader) gets an
// adapter but fails on a healthy sketch's canvas texture ("Invalid Texture ... CreateView", then Device Lost), so
// it cannot stand in (docs/decisions/0008, 2026-10-17).
export type ChromeMode = 'software' | 'gpu';

export const chromeArgs = (mode: ChromeMode, profile: string): string[] => [
  '--headless=new',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  ...(mode === 'software' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'] : []),
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--mute-audio',
  'about:blank',
];

const waitFor = (stream: NodeJS.ReadableStream, pattern: RegExp, timeoutMs: number) =>
  new Promise<string>((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${pattern}`)), timeoutMs);
    stream.on('data', (chunk) => {
      buffer += chunk;
      const hit = buffer.match(pattern);
      if (hit) {
        clearTimeout(timer);
        resolve(hit[0]);
      }
    });
  });

export const launchChrome = async (executable: string, mode: ChromeMode = 'software'): Promise<Browser> => {
  const profile = mkdtempSync(join(tmpdir(), 'lab-check-'));
  const child = spawn(executable, chromeArgs(mode, profile));
  child.stderr.setEncoding('utf8');
  const line = await waitFor(child.stderr, /ws:\/\/127\.0\.0\.1:\d+\//, 20_000);
  const origin = `http://${new URL(line).host}`;

  const open = async (url: string, settleMs: number): Promise<PageProblem[]> => {
    const created = await fetch(`${origin}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
    const target = (await created.json()) as { id: string; webSocketDebuggerUrl: string };
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const problems: PageProblem[] = [];
    let id = 0;
    const send = (method: string, params: object = {}) => socket.send(JSON.stringify({ id: ++id, method, params }));

    await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as { method?: string; params?: Record<string, unknown> };
      const params = message.params;
      if (message.method === 'Runtime.exceptionThrown') {
        const details = params?.['exceptionDetails'] as { text?: string; exception?: { description?: string } };
        problems.push({ kind: 'exception', text: details?.exception?.description ?? details?.text ?? 'exception' });
      }
      if (message.method === 'Runtime.consoleAPICalled' && params?.['type'] === 'error') {
        const args = (params['args'] as { value?: unknown; description?: string }[]) ?? [];
        problems.push({ kind: 'console', text: args.map((a) => a.description ?? String(a.value)).join(' ') });
      }
      if (message.method === 'Log.entryAdded') {
        const entry = params?.['entry'] as { level?: string; text?: string; url?: string };
        // The url matters: "404 Not Found" alone is undiagnosable, and which file 404'd is the whole answer.
        if (entry?.level === 'error') {
          problems.push({ kind: 'log', text: `${entry.text ?? 'log error'}${entry.url ? ` <${entry.url}>` : ''}` });
        }
      }
    });

    send('Runtime.enable');
    send('Log.enable');
    send('Page.enable');
    send('Page.navigate', { url });
    await new Promise((resolve) => setTimeout(resolve, settleMs));
    socket.close();
    await fetch(`${origin}/json/close/${target.id}`);
    return problems;
  };

  const evaluate = async (url: string, expression: string): Promise<unknown> => {
    const created = await fetch(`${origin}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
    const target = (await created.json()) as { id: string; webSocketDebuggerUrl: string };
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
    // The tab was opened on `url`; give it a moment to commit the navigation before evaluating in it.
    await new Promise((resolve) => setTimeout(resolve, 500));
    const value = await new Promise<unknown>((resolve) => {
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as { id?: number; result?: { result?: { value?: unknown } } };
        if (message.id === 1) resolve(message.result?.result?.value);
      });
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    });
    socket.close();
    await fetch(`${origin}/json/close/${target.id}`);
    return value;
  };

  return {
    open,
    evaluate,
    close: () => {
      child.kill();
      // Best effort: on Windows Chrome still holds the profile for a moment after kill, and failing to
      // delete a temp directory must not fail the check that just passed.
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        // left behind in the OS temp directory; harmless
      }
    },
  };
};
