// cronJobB.mjs

import cron from 'node-cron';
import { updateRuneHolders } from './runes.js';
import { updateTrendingRunes } from './TrendingRunes.js';
import { updateRuneActivity } from './RuneActivity.js';

let isRunesFetchRunning = false;
let isTrendingRunesRunning = false;
let isRuneActivityRunning = false;

const TIMEOUTS = {
  RUNES_UPDATE: 1800000,           // 30 minutes for rune holders update
  TRENDING_RUNES_UPDATE: 600000,   // 10 minutes for trending runes
  RUNES_ACTIVITY_UPDATE: 600000    // 10 minutes for rune activity update
};

const withTimeout = (promise, timeoutMs, operationName) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} operation timed out`)), timeoutMs)
    )
  ]);
};

async function handleTimeout(error) {
  if (error.message.includes('timed out')) {
    console.log(`[${new Date().toISOString()}] Timeout occurred - initiating cleanup`);
    await cleanupConnections();
  }
}

async function cleanupConnections() {
  try {
    console.log(`[${new Date().toISOString()}] Cleaning up connections`);
    // Add any cleanup logic here if needed
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error during cleanup:`, error);
  }
}

// Fetch and post runes (holders info)
async function fetchAndPostRunes() {
  if (isRunesFetchRunning) {
    console.log(`[${new Date().toISOString()}] Runes fetch already running. Skipping.`);
    return;
  }

  isRunesFetchRunning = true;
  console.log(`[${new Date().toISOString()}] Starting runes fetch process`);

  try {
    const runesToTrack = ['DOGGOTOTHEMOON'];

    for (const runeName of runesToTrack) {
      console.log(`[${new Date().toISOString()}] Processing rune: ${runeName}`);
      await withTimeout(
        updateRuneHolders(runeName),
        TIMEOUTS.RUNES_UPDATE,
        `Rune update for ${runeName}`
      );
    }

    console.log(`[${new Date().toISOString()}] Completed runes update process`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in runes fetch/post process:`, error);
    await handleTimeout(error);
  } finally {
    isRunesFetchRunning = false;
  }
}

// Update trending runes
async function updateTrendingRunesData() {
  if (isTrendingRunesRunning) {
    console.log(`[${new Date().toISOString()}] Trending runes update already running. Skipping.`);
    return;
  }

  isTrendingRunesRunning = true;
  console.log(`[${new Date().toISOString()}] Starting trending runes update`);

  try {
    await withTimeout(
      updateTrendingRunes(),
      TIMEOUTS.TRENDING_RUNES_UPDATE,
      'Trending runes update'
    );

    console.log(`[${new Date().toISOString()}] Completed trending runes update`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in trending runes update:`, error);
    await handleTimeout(error);
  } finally {
    isTrendingRunesRunning = false;
  }
}

// Update rune activity
async function updateRuneActivityData() {
  if (isRuneActivityRunning) {
    console.log(`[${new Date().toISOString()}] Rune activity update already running. Skipping.`);
    return;
  }

  isRuneActivityRunning = true;
  console.log(`[${new Date().toISOString()}] Starting rune activity update`);

  try {
    await withTimeout(
      updateRuneActivity(),
      TIMEOUTS.RUNES_ACTIVITY_UPDATE,
      'Rune activity update'
    );

    console.log(`[${new Date().toISOString()}] Completed rune activity update`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in rune activity update:`, error);
    await handleTimeout(error);
  } finally {
    isRuneActivityRunning = false;
  }
}

function startCronJobs() {
  console.log(`[${new Date().toISOString()}] Starting rune-related cron jobs`);

  // Trending runes update every 3 minutes
  cron.schedule('*/3 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running trending runes update`);
    await updateTrendingRunesData();
  });

  // Run runes update every hour at minute 30
  cron.schedule('30 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled runes update`);
    await fetchAndPostRunes();
  });

  // Run rune activity update every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running rune activity update`);
    await updateRuneActivityData();
  });

  // Initial runs after startup
  (async () => {
    try {
      await fetchAndPostRunes();
      await updateTrendingRunesData();
      await updateRuneActivityData(); // Run rune activity update at startup
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in initial setup:`, error);
    }
  })();

  console.log(`[${new Date().toISOString()}] All rune-related cron jobs started`);
}

process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] Received SIGTERM - shutting down gracefully`);
  cleanupConnections().finally(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log(`[${new Date().toISOString()}] Received SIGINT - shutting down gracefully`);
  cleanupConnections().finally(() => process.exit(0));
});

startCronJobs();
process.stdin.resume();
