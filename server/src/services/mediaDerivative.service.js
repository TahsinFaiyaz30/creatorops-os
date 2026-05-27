import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

import env from '../config/env.js';
import { UPLOAD_ROOT } from './media.service.js';

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const ensureDir = async dir => {
  await fs.mkdir(dir, { recursive: true });
};

const getDerivativeBase = ({ workspaceId, jobId }) => path.join(UPLOAD_ROOT, String(workspaceId), 'derivatives', String(jobId));

const toPublicUrl = ({ workspaceId, jobId, filename }) =>
  `${env.publicBaseUrl}/uploads/${workspaceId}/derivatives/${jobId}/${filename}`;

const getTargetBytes = value => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  return Math.floor(bytes);
};

const getAssetId = asset => String(asset._id || asset.mediaAssetId || '');

const getTargetForAsset = ({ asset, mediaTargets }) => {
  const assetId = getAssetId(asset);
  return mediaTargets.find(target => {
    if (target.mediaAssetId && assetId && String(target.mediaAssetId) === assetId) return true;
    return (
      target.originalName === asset.originalName &&
      target.mimeType === asset.mimeType &&
      Number(target.currentBytes || target.size || 0) === Number(asset.size || 0)
    );
  });
};

const createCompressionError = ({ asset, targetBytes, actualBytes }) =>
  createHttpError(
    `${asset.originalName || 'Media'} could not be compressed below the provider API limit of ${targetBytes} bytes${actualBytes ? ` (best output was ${actualBytes} bytes)` : ''}.`,
    400,
    'MEDIA_COMPRESSION_TARGET_UNREACHABLE'
  );

const getImageAttempts = ({ level }) => {
  const baseQuality = Math.max(42, 82 - level * 16);
  const baseEdge = Math.max(960, 2400 - level * 480);
  return [
    { quality: baseQuality, maxEdge: baseEdge },
    { quality: 72, maxEdge: 1920 },
    { quality: 64, maxEdge: 1600 },
    { quality: 56, maxEdge: 1280 },
    { quality: 48, maxEdge: 1080 },
    { quality: 40, maxEdge: 900 },
    { quality: 34, maxEdge: 720 },
    { quality: 28, maxEdge: 540 },
    { quality: 22, maxEdge: 360 },
    { quality: 18, maxEdge: 240 }
  ];
};

const compressImage = async ({ asset, outputPath, level, targetBytes }) => {
  let bestBytes = 0;

  for (const attempt of getImageAttempts({ level })) {
    await fs.rm(outputPath, { force: true });
    await sharp(asset.localPath)
      .rotate()
      .resize({ width: attempt.maxEdge, height: attempt.maxEdge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: attempt.quality, mozjpeg: true })
      .toFile(outputPath);

    const stat = await fs.stat(outputPath);
    bestBytes = bestBytes === 0 ? stat.size : Math.min(bestBytes, stat.size);
    if (!targetBytes || stat.size <= targetBytes) return stat;
  }

  throw createCompressionError({ asset, targetBytes, actualBytes: bestBytes });
};

const runFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(createHttpError('Video compression is unavailable because ffmpeg is not installed.', 500, 'MEDIA_COMPRESSION_UNAVAILABLE'));
      return;
    }

    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(createHttpError(stderr || 'Video compression failed.', 500, 'MEDIA_COMPRESSION_FAILED'));
    });
  });

const inspectVideoDurationSeconds = assetPath =>
  new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(createHttpError('Video compression is unavailable because ffmpeg is not installed.', 500, 'MEDIA_COMPRESSION_UNAVAILABLE'));
      return;
    }

    const child = spawn(ffmpegPath, ['-i', assetPath], { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', () => {
      const match = stderr.match(/Duration:\s+(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
      if (!match) {
        reject(createHttpError('Could not read video duration before compression.', 400, 'MEDIA_DURATION_UNAVAILABLE'));
        return;
      }
      const [, hours, minutes, seconds] = match;
      const duration = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(createHttpError('Video duration is invalid for compression.', 400, 'MEDIA_DURATION_UNAVAILABLE'));
        return;
      }
      resolve(duration);
    });
  });

const getVideoAttempts = ({ level, targetBytes, durationSeconds }) => {
  if (!targetBytes) {
    const crf = Math.min(34, 25 + level * 3);
    const width = level >= 2 ? 1280 : 1920;
    return [{ width, crf, audioKbps: 128 }];
  }

  const totalKbps = Math.max(80, Math.floor((targetBytes * 8 * 0.9) / durationSeconds / 1000));
  const audioKbps = totalKbps > 500 ? 96 : totalKbps > 220 ? 64 : 0;
  const videoKbps = Math.max(60, totalKbps - audioKbps);
  return [
    { width: 1920, videoKbps: Math.floor(videoKbps * 0.9), audioKbps },
    { width: 1280, videoKbps: Math.floor(videoKbps * 0.75), audioKbps },
    { width: 1080, videoKbps: Math.floor(videoKbps * 0.65), audioKbps },
    { width: 720, videoKbps: Math.floor(videoKbps * 0.52), audioKbps: Math.min(audioKbps, 64) },
    { width: 540, videoKbps: Math.floor(videoKbps * 0.4), audioKbps: Math.min(audioKbps, 48) },
    { width: 480, videoKbps: Math.floor(videoKbps * 0.32), audioKbps: 0 },
    { width: 360, videoKbps: Math.floor(videoKbps * 0.24), audioKbps: 0 }
  ].map(attempt => ({
    ...attempt,
    videoKbps: Math.max(40, attempt.videoKbps)
  }));
};

const compressVideo = async ({ asset, outputPath, level, targetBytes }) => {
  const durationSeconds = targetBytes ? await inspectVideoDurationSeconds(asset.localPath) : null;
  let bestBytes = 0;

  for (const attempt of getVideoAttempts({ level, targetBytes, durationSeconds })) {
    await fs.rm(outputPath, { force: true });
    const args = [
      '-y',
      '-i',
      asset.localPath,
      '-vf',
      `scale=${attempt.width}:-2`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast'
    ];

    if (targetBytes) {
      args.push(
        '-b:v',
        `${attempt.videoKbps}k`,
        '-maxrate',
        `${attempt.videoKbps}k`,
        '-bufsize',
        `${Math.max(attempt.videoKbps * 2, 128)}k`
      );
    } else {
      args.push('-crf', String(attempt.crf));
    }

    if (attempt.audioKbps > 0) {
      args.push('-c:a', 'aac', '-b:a', `${attempt.audioKbps}k`);
    } else {
      args.push('-an');
    }

    args.push('-movflags', '+faststart', outputPath);
    await runFfmpeg(args);

    const stat = await fs.stat(outputPath);
    bestBytes = bestBytes === 0 ? stat.size : Math.min(bestBytes, stat.size);
    if (!targetBytes || stat.size <= targetBytes) return stat;
  }

  throw createCompressionError({ asset, targetBytes, actualBytes: bestBytes });
};

const getGifAttempts = () => [
  { width: 960, fps: 15 },
  { width: 720, fps: 12 },
  { width: 540, fps: 10 },
  { width: 360, fps: 8 },
  { width: 240, fps: 6 }
];

const compressGif = async ({ asset, outputPath, targetBytes }) => {
  let bestBytes = 0;

  for (const attempt of getGifAttempts()) {
    await fs.rm(outputPath, { force: true });
    await runFfmpeg([
      '-y',
      '-i',
      asset.localPath,
      '-vf',
      `fps=${attempt.fps},scale=${attempt.width}:-1:flags=lanczos`,
      '-loop',
      '0',
      outputPath
    ]);

    const stat = await fs.stat(outputPath);
    bestBytes = bestBytes === 0 ? stat.size : Math.min(bestBytes, stat.size);
    if (!targetBytes || stat.size <= targetBytes) return stat;
  }

  throw createCompressionError({ asset, targetBytes, actualBytes: bestBytes });
};

export const createCompressedMediaAssets = async ({ workspaceId, jobId, platform, mediaAssets = [], mediaTargets = [], level = 1 }) => {
  const baseDir = getDerivativeBase({ workspaceId, jobId });
  await ensureDir(baseDir);

  const derivativePaths = [];
  const compressedAssets = [];

  try {
    for (const asset of mediaAssets) {
      const rawAsset = typeof asset.toObject === 'function' ? asset.toObject() : asset;
      const target = getTargetForAsset({ asset, mediaTargets });
      const targetBytes = getTargetBytes(target?.maxBytes);

      if (!asset.localPath || !targetBytes || Number(asset.size || 0) <= targetBytes) {
        compressedAssets.push(asset);
        continue;
      }

      if (asset.mediaType === 'image' && asset.mimeType === 'image/gif') {
        const filename = `${platform}-${asset._id || Date.now()}-${level}.gif`;
        const outputPath = path.join(baseDir, filename);
        derivativePaths.push(outputPath);
        const stat = await compressGif({ asset, outputPath, targetBytes });
        compressedAssets.push({
          ...rawAsset,
          localPath: outputPath,
          publicUrl: toPublicUrl({ workspaceId, jobId, filename }),
          originalName: `${path.parse(asset.originalName || 'image').name}-compressed.gif`,
          mimeType: 'image/gif',
          mediaType: 'image',
          size: stat.size,
          isDerivative: true,
          compressionTargetBytes: targetBytes
        });
        continue;
      }

      if (asset.mediaType === 'image') {
        const filename = `${platform}-${asset._id || Date.now()}-${level}.jpg`;
        const outputPath = path.join(baseDir, filename);
        derivativePaths.push(outputPath);
        const stat = await compressImage({ asset, outputPath, level, targetBytes });
        compressedAssets.push({
          ...rawAsset,
          localPath: outputPath,
          publicUrl: toPublicUrl({ workspaceId, jobId, filename }),
          originalName: `${path.parse(asset.originalName || 'image').name}-compressed.jpg`,
          mimeType: 'image/jpeg',
          mediaType: 'image',
          size: stat.size,
          isDerivative: true,
          compressionTargetBytes: targetBytes
        });
        continue;
      }

      if (asset.mediaType === 'video') {
        const filename = `${platform}-${asset._id || Date.now()}-${level}.mp4`;
        const outputPath = path.join(baseDir, filename);
        derivativePaths.push(outputPath);
        const stat = await compressVideo({ asset, outputPath, level, targetBytes });
        compressedAssets.push({
          ...rawAsset,
          localPath: outputPath,
          publicUrl: toPublicUrl({ workspaceId, jobId, filename }),
          originalName: `${path.parse(asset.originalName || 'video').name}-compressed.mp4`,
          mimeType: 'video/mp4',
          mediaType: 'video',
          size: stat.size,
          isDerivative: true,
          compressionTargetBytes: targetBytes
        });
        continue;
      }

      compressedAssets.push(asset);
    }
  } catch (error) {
    await Promise.allSettled(derivativePaths.map(filePath => fs.rm(filePath, { force: true })));
    await fs.rm(baseDir, { recursive: true, force: true });
    throw error;
  }

  return { mediaAssets: compressedAssets, derivativePaths };
};

export const deleteDerivativeFiles = async (paths = []) => {
  await Promise.allSettled(paths.map(filePath => fs.rm(filePath, { force: true })));
  const dirs = [...new Set(paths.map(filePath => path.dirname(filePath)))];
  await Promise.allSettled(dirs.map(dir => fs.rm(dir, { recursive: true, force: true })));
};
