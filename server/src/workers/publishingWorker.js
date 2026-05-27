import { processDuePublishJobs, processTemporaryPublishMediaCleanup } from '../services/publish.service.js';

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
      await processDuePublishJobs();
      await processTemporaryPublishMediaCleanup();
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
