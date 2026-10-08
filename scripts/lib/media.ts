// ffmpeg / ffprobe / sharp for lab:add. Defaults follow docs/spec/publish-pipeline.md「録画の既定フォーマット」.
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import sharp from 'sharp';
import type { MediaEntry } from './content.ts';

const run = (cmd: string, args: string[]) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`${cmd} not found. Install it with: brew install ffmpeg (docs/setup.md)`);
    }
    const stderr = String((error as { stderr?: string }).stderr ?? '').trim().split('\n').slice(-5).join('\n');
    throw new Error(`${cmd} failed:\n${stderr}`);
  }
};

export const probeVideo = (path: string): MediaEntry => {
  const out = JSON.parse(
    run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', path]),
  ) as { streams: { width: number; height: number }[]; format: { duration: string } };
  const stream = out.streams[0];
  if (!stream) throw new Error(`${path}: no video stream`);
  return {
    width: stream.width,
    height: stream.height,
    bytes: statSync(path).size,
    durationSec: Math.round(Number(out.format.duration) * 100) / 100,
  };
};

// H.264 / yuv420p / no audio / faststart (playback starts before the whole file arrives). fps and size are kept.
export const encodeVideo = (input: string, output: string) => {
  run('ffmpeg', [
    '-y', '-v', 'error', '-i', input,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-an', '-movflags', '+faststart', output,
  ]);
};

// One frame from the middle of the clip (the start of a loop is often blank), as PNG for sharp.
export const extractFrame = (video: string, durationSec: number, output: string) => {
  run('ffmpeg', ['-y', '-v', 'error', '-ss', String(durationSec / 2), '-i', video, '-frames:v', '1', output]);
};

export const toWebp = async (input: string, output: string): Promise<MediaEntry> => {
  const info = await sharp(input).webp({ quality: 85 }).toFile(output);
  return { width: info.width, height: info.height, bytes: info.size };
};
