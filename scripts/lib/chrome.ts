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

// Headless Chrome without a GPU says so, loudly and in several ways. Those messages are about the machine
// running the check, not about the sketch, so they must not read as a broken artifact.
//
// Deliberately an allowlist of known phrases rather than "mentions WebGL": a real shader failure also
// mentions WebGL ("THREE.WebGLProgram: Shader Error ... VALIDATE_STATUS false"), and swallowing that would
// make this check worse than useless -- it would be a green light over a broken build.
// Kept deliberately short, and only for messages about *getting a context at all*. Nothing was guessed
// in from memory: on this machine headless Chrome with --use-angle=swiftshader produces none of these,
// so the list exists for GPU-less machines. Extend it when a real environment actually prints something,
// never pre-emptively -- every entry here is a hole in the check.
const ENVIRONMENT_PHRASES = [
  'Could not create a WebGL context',
  'Automatic fallback to software WebGL',
  'WebGL is disabled',
  'WebGL unavailable',
];

// Anything naming the shader pipeline is the sketch's own problem, whatever else it says.
const SKETCH_PHRASES = ['Shader Error', 'WebGLProgram', 'compile', 'VALIDATE_STATUS', 'gl.getProgramInfoLog'];

export const isEnvironmentProblem = (problem: PageProblem): boolean => {
  if (SKETCH_PHRASES.some((phrase) => problem.text.includes(phrase))) return false;
  return ENVIRONMENT_PHRASES.some((phrase) => problem.text.includes(phrase));
};

type Browser = {
  open: (url: string, settleMs: number) => Promise<PageProblem[]>;
  close: () => void;
};

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

export const launchChrome = async (executable: string): Promise<Browser> => {
  const profile = mkdtempSync(join(tmpdir(), 'lab-check-'));
  const child = spawn(executable, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    // Software WebGL. Without these three the page gets no context at all and every sketch "fails".
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--mute-audio',
    'about:blank',
  ]);
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
      const message = JSON.parse(String(event.data)) as { method?: string; params?: Record<string, never> };
      const params = message.params as Record<string, never> | undefined;
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

  return {
    open,
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
