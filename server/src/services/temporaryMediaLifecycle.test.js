import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateTemporaryUploadHardDeleteAt,
  createTemporaryMediaCleanupStats,
  assertTemporaryMediaAvailableForAction,
  hasLifecycleDeadlinePassed,
  resolveTemporaryAssetHardDeleteAt
} from './temporaryMediaLifecycle.js';

test('hard-delete deadline starts from temporary upload start', () => {
  const startedAt = new Date('2026-07-01T00:00:00.000Z');
  const deadline = calculateTemporaryUploadHardDeleteAt({
    startedAt,
    hardDeleteSeconds: 30 * 24 * 60 * 60
  });

  assert.equal(deadline.toISOString(), '2026-07-31T00:00:00.000Z');
});

test('completed media keeps the upload-start deadline instead of resetting at asset creation', () => {
  const deadline = resolveTemporaryAssetHardDeleteAt({
    assetCreatedAt: new Date('2026-07-05T00:00:00.000Z'),
    uploadStartedAt: new Date('2026-07-01T00:00:00.000Z'),
    hardDeleteSeconds: 30 * 24 * 60 * 60
  });

  assert.equal(deadline.toISOString(), '2026-07-31T00:00:00.000Z');
});

test('existing asset deadline wins when already persisted', () => {
  const deadline = resolveTemporaryAssetHardDeleteAt({
    assetHardDeleteAt: new Date('2026-07-15T00:00:00.000Z'),
    assetCreatedAt: new Date('2026-07-05T00:00:00.000Z'),
    uploadStartedAt: new Date('2026-07-01T00:00:00.000Z'),
    hardDeleteSeconds: 30 * 24 * 60 * 60
  });

  assert.equal(deadline.toISOString(), '2026-07-15T00:00:00.000Z');
});

test('deadline comparison treats equality as expired', () => {
  assert.equal(
    hasLifecycleDeadlinePassed({
      deadline: new Date('2026-07-31T00:00:00.000Z'),
      now: new Date('2026-07-31T00:00:00.000Z')
    }),
    true
  );
});

test('cleanup stats carry last run and all operation counts', () => {
  const stats = createTemporaryMediaCleanupStats({
    now: new Date('2026-07-31T00:00:00.000Z'),
    expiredUploadSessions: 2,
    prunedUploadSessions: 3,
    hardDeletedMediaAssets: 4,
    hardDeleteAffectedJobs: 5,
    retryDeletedMediaAssets: 6
  });

  assert.deepEqual(
    {
      lastRunAt: stats.lastRunAt.toISOString(),
      expiredUploadSessions: stats.expiredUploadSessions,
      prunedUploadSessions: stats.prunedUploadSessions,
      hardDeletedMediaAssets: stats.hardDeletedMediaAssets,
      hardDeleteAffectedJobs: stats.hardDeleteAffectedJobs,
      retryDeletedMediaAssets: stats.retryDeletedMediaAssets
    },
    {
      lastRunAt: '2026-07-31T00:00:00.000Z',
      expiredUploadSessions: 2,
      prunedUploadSessions: 3,
      hardDeletedMediaAssets: 4,
      hardDeleteAffectedJobs: 5,
      retryDeletedMediaAssets: 6
    }
  );
});

test('retry and resume are blocked after temporary media expiry', () => {
  assert.throws(
    () => assertTemporaryMediaAvailableForAction({
      temporaryMediaExpiredAt: new Date('2026-07-31T00:00:00.000Z'),
      action: 'retried'
    }),
    error => error.code === 'TEMPORARY_MEDIA_EXPIRED' && error.statusCode === 400
  );
});
