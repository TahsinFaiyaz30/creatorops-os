import { processDueJobs } from '../services/schedule.service.js';

let intervalId = null;

export const startPublishingWorker = ({ intervalMs = 10000 } = {}) => {
  if (intervalId) {
    return intervalId;
  }

  const tick = async () => {
    try {
      await processDueJobs();
    } catch (error) {
      console.error('Publishing worker tick failed:', error.message);
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
