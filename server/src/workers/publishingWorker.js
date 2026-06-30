import { processDuePublishJobs, processTemporaryPublishMediaCleanup } from '../services/publish.service.js';
import { recordTemporaryMediaCleanupRun } from '../services/systemSettings.service.js';

const sumCleanupStats = (runs, field) => runs.reduce((total, run) => total + Number(run?.[field] || 0), 0);

const summarizeCleanupRuns = runs => ({
  lastRunAt: new Date(),
  expiredUploadSessions: sumCleanupStats(runs, 'expiredUploadSessions'),
  prunedUploadSessions: sumCleanupStats(runs, 'prunedUploadSessions'),
  hardDeletedMediaAssets: sumCleanupStats(runs, 'hardDeletedMediaAssets'),
  hardDeleteAffectedJobs: sumCleanupStats(runs, 'hardDeleteAffectedJobs'),
  retryDeletedMediaAssets: sumCleanupStats(runs, 'retryDeletedMediaAssets')
});

let intervalId = null;
let tickInProgress = false;

export const startPublishingWorker = ({ intervalMs = 10000 } = {}) => {
  if (intervalId) {
    return intervalId;
  }

  const tick = async () => {
    if (tickInProgress) return;
    tickInProgress = true;
    try {
      const cleanupBefore = await processTemporaryPublishMediaCleanup({ recordRun: false });
      await processDuePublishJobs();
      const cleanupAfter = await processTemporaryPublishMediaCleanup({ recordRun: false });
      await recordTemporaryMediaCleanupRun(summarizeCleanupRuns([cleanupBefore, cleanupAfter]));
    } catch (error) {
      console.error('Publishing worker tick failed:', error.message);
    } finally {
      tickInProgress = false;
    }
  };

  intervalId = setInterval(tick, intervalMs);
  tick();

  console.log(`Publishing worker started with ${intervalMs}ms interval`);
  return intervalId;
};

export const stopPublishingWorker = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};
