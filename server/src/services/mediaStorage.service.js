import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

import env from '../config/env.js';

export const STORAGE_PROVIDERS = ['s3'];

let s3Client = null;

const getS3Config = () => env.mediaStorage.s3;

const getS3Client = () => {
  if (s3Client) return s3Client;
  const config = getS3Config();
  s3Client = new S3Client({
    region: config.region || 'auto',
    endpoint: config.endpoint || undefined,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
  return s3Client;
};

export const getMediaStorageProvider = () => env.mediaStorage.provider;

export const isObjectStorageEnabled = () => getMediaStorageProvider() === 's3';

const sanitizeSegment = value =>
  String(value || 'media')
    .trim()
    .replace(/[^a-z0-9._-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'media';

const joinObjectKey = segments => segments.filter(Boolean).map(sanitizeSegment).join('/');

export const createMediaObjectKey = ({ workspaceId, storageIntent = 'library', kind = 'originals', id = '', filename = '' }) => {
  const prefix = env.mediaStorage.s3.keyPrefix;
  return [
    prefix,
    joinObjectKey([
      'workspaces',
      workspaceId,
      storageIntent === 'temporary_publish' ? 'temporary-publish' : 'library',
      kind,
      id || Date.now(),
      filename || 'media'
    ])
  ]
    .filter(Boolean)
    .join('/');
};

const toPublicObjectUrl = objectKey => {
  const publicBaseUrl = env.mediaStorage.s3.publicBaseUrl;
  if (!publicBaseUrl) return '';
  const encodedKey = objectKey
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `${publicBaseUrl}/${encodedKey}`;
};

export const getStoredObjectUrl = async ({ storageProvider = getMediaStorageProvider(), objectKey }) => {
  if (!objectKey) return '';
  if (storageProvider !== 's3') return '';
  const publicUrl = toPublicObjectUrl(objectKey);
  if (publicUrl) return publicUrl;
  const config = getS3Config();
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey
    }),
    { expiresIn: env.mediaStorage.signedUrlExpiresSeconds }
  );
};

export const createResumableObjectUpload = async ({ objectKey, mimeType, metadata = {} }) => {
  if (!isObjectStorageEnabled()) throw new Error('MEDIA_STORAGE_PROVIDER=s3 is required for media uploads.');
  const config = getS3Config();
  const response = await getS3Client().send(
    new CreateMultipartUploadCommand({
      Bucket: config.bucket,
      Key: objectKey,
      ContentType: mimeType,
      Metadata: Object.fromEntries(
        Object.entries(metadata)
          .filter(([, value]) => value !== undefined && value !== null && value !== '')
          .map(([key, value]) => [key, String(value)])
      )
    })
  );
  return {
    storageProvider: 's3',
    objectKey,
    multipartUploadId: response.UploadId,
    publicUrl: await getStoredObjectUrl({ storageProvider: 's3', objectKey })
  };
};

export const uploadResumableObjectPart = async ({ session, partNumber, chunk }) => {
  const config = getS3Config();
  const response = await getS3Client().send(
    new UploadPartCommand({
      Bucket: config.bucket,
      Key: session.objectKey,
      UploadId: session.multipartUploadId,
      PartNumber: partNumber,
      Body: chunk,
      ContentLength: chunk.length
    })
  );
  return {
    partNumber,
    etag: response.ETag,
    size: chunk.length
  };
};

export const completeResumableObjectUpload = async session => {
  const config = getS3Config();
  const parts = [...(session.multipartParts || [])]
    .sort((a, b) => a.partNumber - b.partNumber)
    .map(part => ({
      PartNumber: part.partNumber,
      ETag: part.etag
    }));

  await getS3Client().send(
    new CompleteMultipartUploadCommand({
      Bucket: config.bucket,
      Key: session.objectKey,
      UploadId: session.multipartUploadId,
      MultipartUpload: { Parts: parts }
    })
  );
};

export const abortResumableObjectUpload = async session => {
  if (!session.multipartUploadId || !session.objectKey) return;
  const config = getS3Config();
  await getS3Client()
    .send(
      new AbortMultipartUploadCommand({
        Bucket: config.bucket,
        Key: session.objectKey,
        UploadId: session.multipartUploadId
      })
    )
    .catch(() => {});
};

export const deleteStoredObject = async ({ objectKey = '' }) => {
  if (!objectKey) return;
  const config = getS3Config();
  await getS3Client()
    .send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: objectKey
      })
    )
    .catch(() => {});
};

export const createStoredObjectReadStream = async ({ objectKey, start = null, end = null }) => {
  const config = getS3Config();
  const range = Number.isFinite(start) && Number.isFinite(end) ? `bytes=${start}-${end}` : undefined;
  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Range: range
    })
  );
  return response.Body;
};

export const getStoredObjectBuffer = async ({ objectKey, start = null, end = null }) => {
  const stream = await createStoredObjectReadStream({ objectKey, start, end });
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export const putStoredObjectFromBuffer = async ({ buffer, objectKey, mimeType }) => {
  const config = getS3Config();
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: mimeType,
      ContentLength: buffer.length
    })
  );
  return {
    storageProvider: 's3',
    objectKey,
    publicUrl: await getStoredObjectUrl({ storageProvider: 's3', objectKey })
  };
};

export const streamToBuffer = async stream => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export const bufferToStream = buffer => Readable.from(buffer);
