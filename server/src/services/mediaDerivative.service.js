import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

import {
  createMediaObjectKey,
  createStoredObjectReadStream,
  deleteStoredObject,
  getStoredObjectBuffer,
  getStoredObjectUrl,
  putStoredObjectFromBuffer
} from './mediaStorage.service.js';

const createHttpError = (message, statusCode, code = '') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

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

const runFfmpegToBuffer = args =>
  new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(createHttpError('Video compression is unavailable because ffmpeg is not installed.', 500, 'MEDIA_COMPRESSION_UNAVAILABLE'));
      return;
    }

    const child = spawn(ffmpegPath, args, { windowsHide: true });
    const output = [];
    let stderr = '';

    child.stdout.on('data', chunk => output.push(Buffer.from(chunk)));
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve(Buffer.concat(output));
        return;
      }
      reject(createHttpError(stderr || 'Media compression failed.', 500, 'MEDIA_COMPRESSION_FAILED'));
    });
  });

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

const compressImageFromCloud = async ({ asset, level, targetBytes }) => {
  let bestBytes = 0;
  const sourceBuffer = await getStoredObjectBuffer({ objectKey: asset.objectKey });

  for (const attempt of getImageAttempts({ level })) {
    const buffer = await sharp(sourceBuffer)
      .rotate()
      .resize({ width: attempt.maxEdge, height: attempt.maxEdge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: attempt.quality, mozjpeg: true })
      .toBuffer();
    bestBytes = bestBytes === 0 ? buffer.length : Math.min(bestBytes, buffer.length);
    if (!targetBytes || buffer.length <= targetBytes) return buffer;
  }

  throw createCompressionError({ asset, targetBytes, actualBytes: bestBytes });
};

const inspectVideoDurationSeconds = async asset => {
  if (Number(asset.durationSeconds) > 0) return Number(asset.durationSeconds);
  const objectUrl = await getStoredObjectUrl({ storageProvider: asset.storageProvider, objectKey: asset.objectKey });
  return new Promise((resolve, reject) => {
    if (!ffmpegPath || !objectUrl) {
      reject(createHttpError('Could not read video duration before compression.', 400, 'MEDIA_DURATION_UNAVAILABLE'));
      return;
    }
    const child = spawn(ffmpegPath, ['-i', objectUrl], { windowsHide: true });
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
};

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

const compressVideo = async ({ asset, level, targetBytes }) => {
  const objectUrl = await getStoredObjectUrl({ storageProvider: asset.storageProvider, objectKey: asset.objectKey });
  const durationSeconds = targetBytes ? await inspectVideoDurationSeconds(asset) : null;
  let bestBytes = 0;

  for (const attempt of getVideoAttempts({ level, targetBytes, durationSeconds })) {
    const args = [
      '-y',
      '-i',
      objectUrl,
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

    args.push('-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov', 'pipe:1');
    const buffer = await runFfmpegToBuffer(args);
    bestBytes = bestBytes === 0 ? buffer.length : Math.min(bestBytes, buffer.length);
    if (!targetBytes || buffer.length <= targetBytes) return buffer;
  }

  throw createCompressionError({ asset, targetBytes, actualBytes: bestBytes });
};

const compressGif = async ({ asset, targetBytes }) => {
  const objectUrl = await getStoredObjectUrl({ storageProvider: asset.storageProvider, objectKey: asset.objectKey });
  const attempts = [
    { width: 960, fps: 15 },
    { width: 720, fps: 12 },
    { width: 540, fps: 10 },
    { width: 360, fps: 8 },
    { width: 240, fps: 6 }
  ];
  let bestBytes = 0;

  for (const attempt of attempts) {
    const buffer = await runFfmpegToBuffer([
      '-y',
      '-i',
      objectUrl,
      '-vf',
      `fps=${attempt.fps},scale=${attempt.width}:-1:flags=lanczos`,
      '-loop',
      '0',
      '-f',
      'gif',
      'pipe:1'
    ]);
    bestBytes = bestBytes === 0 ? buffer.length : Math.min(bestBytes, buffer.length);
    if (!targetBytes || buffer.length <= targetBytes) return buffer;
  }

  throw createCompressionError({ asset, targetBytes, actualBytes: bestBytes });
};

const storeDerivative = async ({ workspaceId, jobId, filename, mimeType, buffer }) => {
  const objectKey = createMediaObjectKey({
    workspaceId,
    storageIntent: 'temporary_publish',
    kind: 'derivatives',
    id: jobId,
    filename
  });
  return putStoredObjectFromBuffer({
    buffer,
    objectKey,
    mimeType
  });
};

const createPreparedDerivative = ({ rawAsset, stored, originalName, mimeType, mediaType, size, targetBytes }) => ({
  ...rawAsset,
  publicUrl: stored.publicUrl,
  storageProvider: stored.storageProvider,
  objectKey: stored.objectKey || '',
  originalName,
  mimeType,
  mediaType,
  size,
  isDerivative: true,
  compressionTargetBytes: targetBytes,
  createReadStream: options => createStoredObjectReadStream({ objectKey: stored.objectKey, ...options }),
  readBuffer: options => getStoredObjectBuffer({ objectKey: stored.objectKey, ...options })
});

export const createCompressedMediaAssets = async ({ workspaceId, jobId, platform, mediaAssets = [], mediaTargets = [], level = 1 }) => {
  const derivativeRefs = [];
  const compressedAssets = [];

  try {
    for (const asset of mediaAssets) {
      const rawAsset = typeof asset.toObject === 'function' ? asset.toObject() : asset;
      const target = getTargetForAsset({ asset, mediaTargets });
      const targetBytes = getTargetBytes(target?.maxBytes);

      if (!asset.objectKey || !targetBytes || Number(asset.size || 0) <= targetBytes) {
        compressedAssets.push(asset);
        continue;
      }

      if (asset.mediaType === 'image' && asset.mimeType === 'image/gif') {
        const filename = `${platform}-${asset._id || Date.now()}-${level}.gif`;
        const buffer = await compressGif({ asset, targetBytes });
        const stored = await storeDerivative({ workspaceId, jobId, filename, mimeType: 'image/gif', buffer });
        derivativeRefs.push(stored);
        compressedAssets.push(createPreparedDerivative({
          rawAsset,
          stored,
          originalName: `${String(asset.originalName || 'image').replace(/\.[^.]+$/, '')}-compressed.gif`,
          mimeType: 'image/gif',
          mediaType: 'image',
          size: buffer.length,
          targetBytes
        }));
        continue;
      }

      if (asset.mediaType === 'image') {
        const filename = `${platform}-${asset._id || Date.now()}-${level}.jpg`;
        const buffer = await compressImageFromCloud({ asset, level, targetBytes });
        const stored = await storeDerivative({ workspaceId, jobId, filename, mimeType: 'image/jpeg', buffer });
        derivativeRefs.push(stored);
        compressedAssets.push(createPreparedDerivative({
          rawAsset,
          stored,
          originalName: `${String(asset.originalName || 'image').replace(/\.[^.]+$/, '')}-compressed.jpg`,
          mimeType: 'image/jpeg',
          mediaType: 'image',
          size: buffer.length,
          targetBytes
        }));
        continue;
      }

      if (asset.mediaType === 'video') {
        const filename = `${platform}-${asset._id || Date.now()}-${level}.mp4`;
        const buffer = await compressVideo({ asset, level, targetBytes });
        const stored = await storeDerivative({ workspaceId, jobId, filename, mimeType: 'video/mp4', buffer });
        derivativeRefs.push(stored);
        compressedAssets.push(createPreparedDerivative({
          rawAsset,
          stored,
          originalName: `${String(asset.originalName || 'video').replace(/\.[^.]+$/, '')}-compressed.mp4`,
          mimeType: 'video/mp4',
          mediaType: 'video',
          size: buffer.length,
          targetBytes
        }));
        continue;
      }

      compressedAssets.push(asset);
    }
  } catch (error) {
    await deleteDerivativeFiles(derivativeRefs);
    throw error;
  }

  return { mediaAssets: compressedAssets, derivativePaths: derivativeRefs };
};

export const deleteDerivativeFiles = async (refs = []) => {
  await Promise.allSettled(refs.map(ref => deleteStoredObject(ref)));
};
