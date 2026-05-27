import { spawn } from 'child_process';

import ffmpegPath from 'ffmpeg-static';

const parseDurationSeconds = text => {
  const match = text.match(/Duration:\s+(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
};

const parseVideoDimensions = text => {
  const candidates = [...text.matchAll(/Video:[^\n]*?\s(\d{2,5})x(\d{2,5})(?:[\s,]|$)/g)];
  const match = candidates.at(-1);
  if (!match) return { width: null, height: null };
  return { width: Number(match[1]), height: Number(match[2]) };
};

export const inspectVideoMetadata = localPath =>
  new Promise(resolve => {
    if (!ffmpegPath || !localPath) {
      resolve({ width: null, height: null, durationSeconds: null, aspectRatioOriginal: null });
      return;
    }

    const child = spawn(ffmpegPath, ['-i', localPath], { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', () => {
      resolve({ width: null, height: null, durationSeconds: null, aspectRatioOriginal: null });
    });
    child.on('close', () => {
      const { width, height } = parseVideoDimensions(stderr);
      resolve({
        width,
        height,
        durationSeconds: parseDurationSeconds(stderr),
        aspectRatioOriginal: width && height ? width / height : null
      });
    });
  });
