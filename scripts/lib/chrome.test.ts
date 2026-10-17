import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { chromeArgs } from './chrome.ts';

// The two modes of the artifact check (decision 0008). Pinned because each half was learned the hard way:
// software mode without SwiftShader gets no WebGL context on a GPU-less machine, and SwiftShader in gpu mode
// leaves WebGPU with no adapter, so a broken WebGPU sketch passes in silence (2026-10-17).
describe('chromeArgs', () => {
  const software = chromeArgs('software', '/tmp/p');
  const gpu = chromeArgs('gpu', '/tmp/p');

  test('software renders WebGL on SwiftShader', () => {
    for (const flag of ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'])
      assert.ok(software.includes(flag), flag);
  });
  test('gpu mode keeps the GPU and SwiftShader out', () => {
    assert.equal(
      gpu.some((flag) => /swiftshader|--disable-gpu/.test(flag)),
      false,
    );
  });
  test('both are headless and debuggable', () => {
    for (const args of [software, gpu]) {
      assert.ok(args.includes('--headless=new'));
      assert.ok(args.includes('--remote-debugging-port=0'));
    }
  });
});
