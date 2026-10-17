// HDRI -> a small Radiance .hdr that can be committed next to a sketch.
//
//   node scripts/prep-hdri.ts <in.exr|in.hdr> <out.hdr> [width]
//
// Why downsample at all: an environment map is consumed through PMREMGenerator, which blurs it into a
// roughness pyramid. The high frequencies never reach the screen, so a 1k source is paying download and
// decode for data that is filtered away. 512 wide is already beyond what a roughness >= 0.25 surface can
// show. The source stays out of the repo; this committed output is the artifact, and this script is how it
// can be made again (an unreproducible committed binary is the kind of thing that rots).
//
// Why RGBE and not EXR: RGBELoader is a fraction of EXRLoader's size, and 8 bits of mantissa per channel
// with a shared exponent is more precision than a blurred reflection can carry.
import { readFileSync, writeFileSync } from 'node:fs';
import { FloatType } from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

type Image = { width: number; height: number; rgb: Float32Array };

const read = (path: string): Image => {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  // FloatType on purpose. Both loaders default to half floats, and half has ~3 decimal digits -- enough
  // for the sketch, but it would put a quantisation step between the pixels this script writes and the
  // pixels it reads back to verify them, which makes the verification unable to tell a real encoder bug
  // from the format's own rounding. (It did: the round-trip check first failed at 100% because of this.)
  const loader = path.toLowerCase().endsWith('.exr') ? new EXRLoader() : new HDRLoader();
  loader.type = FloatType;
  const { width, height, data } = loader.parse(ab);
  if (width === undefined || height === undefined || !data) throw new Error(`prep-hdri: could not decode ${path}`);
  // Drop alpha, which an environment map has no use for.
  const rgb = new Float32Array(width * height * 3);
  for (let i = 0, n = width * height; i < n; i++) {
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = data[i * 4 + c]!;
  }
  return { width, height, rgb };
};

// Box filter over an integer factor. Averaging in linear light is what makes this energy-preserving: a
// bright window averaged down stays as bright in total as it was, which is the whole point of an HDRI.
const downsample = (src: Image, width: number): Image => {
  if (width === src.width) return src;
  const f = src.width / width;
  if (!Number.isInteger(f) || src.height % f !== 0) {
    throw new Error(`${src.width}x${src.height} does not divide evenly into width ${width}`);
  }
  const height = src.height / f;
  const rgb = new Float32Array(width * height * 3);
  const inv = 1 / (f * f);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < f; dy++) {
        for (let dx = 0; dx < f; dx++) {
          const s = ((y * f + dy) * src.width + (x * f + dx)) * 3;
          r += src.rgb[s]!;
          g += src.rgb[s + 1]!;
          b += src.rgb[s + 2]!;
        }
      }
      const d = (y * width + x) * 3;
      rgb[d] = r * inv;
      rgb[d + 1] = g * inv;
      rgb[d + 2] = b * inv;
    }
  }
  return { width, height, rgb };
};

// Radiance RGBE: one shared exponent for the three channels, so the stored mantissas are relative to the
// brightest of them. frexp by hand -- JS has no frexp, and Math.log2 at a power of two rounds the wrong way.
const encodePixel = (r0: number, g0: number, b0: number, out: Uint8Array, at: number) => {
  // Clamped at zero first. An EXR may hold slightly negative values (a filtered or colour-converted
  // source rings below black), and light cannot be negative. Letting one through is not a small error:
  // assigning a negative number to a Uint8Array wraps it, so -3 is stored as 253 and a black pixel comes
  // back as the brightest thing in the image.
  const r = Math.max(r0, 0);
  const g = Math.max(g0, 0);
  const b = Math.max(b0, 0);
  const m = Math.max(r, g, b);
  if (m < 1e-32) {
    out[at] = 0;
    out[at + 1] = 0;
    out[at + 2] = 0;
    out[at + 3] = 0;
    return;
  }
  let e = 0;
  let f = m;
  while (f >= 1) {
    f /= 2;
    e++;
  }
  while (f < 0.5) {
    f *= 2;
    e--;
  }
  const s = (f * 256) / m;
  out[at] = Math.min(255, r * s);
  out[at + 1] = Math.min(255, g * s);
  out[at + 2] = Math.min(255, b * s);
  out[at + 3] = e + 128;
};

// New-style RLE, one scanline at a time, the four components stored as separate planes. Runs of 4 or more
// equal bytes become (count | 0x80, byte); everything else is a literal block. Flat (non-RLE) output would
// be simpler but three's RGBELoader detects RLE by sniffing the first bytes of a scanline, so a flat file
// whose first pixel happens to start 0x02 0x02 is read as garbage.
const rleScanline = (plane: Uint8Array, width: number, out: number[]) => {
  let i = 0;
  while (i < width) {
    let run = 1;
    while (i + run < width && run < 127 && plane[i + run] === plane[i]) run++;
    if (run >= 4) {
      out.push(run | 0x80, plane[i]!);
      i += run;
      continue;
    }
    // Literal: extend until a run of 4 would start, or the 128-byte block is full.
    let len = 1;
    while (
      i + len < width &&
      len < 128 &&
      !(
        i + len + 3 < width &&
        plane[i + len] === plane[i + len + 1] &&
        plane[i + len] === plane[i + len + 2] &&
        plane[i + len] === plane[i + len + 3]
      )
    ) {
      len++;
    }
    out.push(len);
    for (let k = 0; k < len; k++) out.push(plane[i + k]!);
    i += len;
  }
};

const writeHdr = (img: Image, path: string) => {
  const { width, height } = img;
  const header = `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`;
  const body: number[] = [];
  const pixel = new Uint8Array(4);
  const planes = [new Uint8Array(width), new Uint8Array(width), new Uint8Array(width), new Uint8Array(width)];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 3;
      encodePixel(img.rgb[s]!, img.rgb[s + 1]!, img.rgb[s + 2]!, pixel, 0);
      for (let c = 0; c < 4; c++) planes[c]![x] = pixel[c]!;
    }
    body.push(2, 2, (width >> 8) & 0xff, width & 0xff);
    for (const plane of planes) rleScanline(plane, width, body);
  }
  writeFileSync(path, Buffer.concat([Buffer.from(header, 'ascii'), Buffer.from(body)]));
};

const [input, output, widthArg] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: node scripts/prep-hdri.ts <in.exr|in.hdr> <out.hdr> [width]');
  process.exit(1);
}

const source = read(input);
const scaled = downsample(source, widthArg ? Number(widthArg) : source.width);
writeHdr(scaled, output);

// Round-trip through the loader the sketch will actually use. Writing a file three cannot read is a silent
// failure -- the sketch just renders without reflections -- so the check belongs here, not in a review.
//
// The error is measured against the PIXEL'S OWN brightest channel, not against the channel being compared.
// That is what RGBE's accuracy actually is: the three channels share one exponent, so each is stored as
// 8 bits relative to the brightest of them and a channel 256x dimmer than its neighbours quantises to
// zero. Comparing a channel to itself calls that a 100% error (it did) and reports a correct encoder as
// broken; the format's real quantum is one part in 256 OF THE PIXEL.
const back = read(output);
let worst = 0;
for (let i = 0, n = scaled.width * scaled.height; i < n; i++) {
  const peak = Math.max(scaled.rgb[i * 3]!, scaled.rgb[i * 3 + 1]!, scaled.rgb[i * 3 + 2]!, 1e-6);
  for (let c = 0; c < 3; c++) {
    worst = Math.max(worst, Math.abs(scaled.rgb[i * 3 + c]! - back.rgb[i * 3 + c]!) / peak);
  }
}
const bytes = readFileSync(output).length;
console.log(
  `${source.width}x${source.height} -> ${scaled.width}x${scaled.height}  ` +
    `${(bytes / 1024).toFixed(0)} KB  worst error ${(worst * 100).toFixed(2)}% of the pixel (RGBE quantum: 0.39%)`,
);
if (back.width !== scaled.width || back.height !== scaled.height) {
  throw new Error(`round-trip changed the size: wrote ${scaled.width}x${scaled.height}, read ${back.width}x${back.height}`);
}
// 1/256 of the pixel is the format's own quantum; twice that leaves room for the exponent boundary.
if (worst > 2 / 256) throw new Error(`round-trip error ${(worst * 100).toFixed(2)}% is above the RGBE quantum -- the encoder is wrong`);
