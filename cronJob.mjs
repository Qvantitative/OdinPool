// cronJob.mjs

import cron from 'node-cron';
import { updateAllData } from './updateBlockchainData.mjs';
import { updateRawTransactionData } from './updateRawTransaction.mjs';
import { fetchAndStoreTrendingData } from './trending.js';
import { updateRuneHolders } from './runes.js';
import { updateTrendingRunes } from './TrendingRunes.js';

// Import the update function from RunesActivity.js
import { updateRuneActivity } from './RunesActivity.js';

import {
  fetchInscriptionsFromAPI,
  insertInscriptionsToDB,
  updateWalletTracking,
  fixUnknownProjectSlugs
} from './inscriptions.js';

// Process state flags
let isWalletTrackingRunning = false;
let isInscriptionFetchRunning = false;
let isRunesFetchRunning = false;
let isTrendingRunesRunning = false;
// Add this flag for rune activity
let isRuneActivityRunning = false;

const TIMEOUTS = {
  FETCH_INSCRIPTIONS: 1800000,      // 30 minutes
  INSERT_INSCRIPTIONS: 600000,      // 10 minutes
  WALLET_TRACKING: 3600000,         // 1 hour
  BLOCKCHAIN_UPDATE: 45000,         // 45 seconds
  RUNES_UPDATE: 1800000,            // 30 minutes for rune operations
  TRENDING_RUNES_UPDATE: 600000,    // 10 minutes for trending runes
  BACKFILL: 3600000,                // 1 hour
  // You can define a timeout for rune activity as well
  RUNES_ACTIVITY_UPDATE: 600000     // 10 minutes for rune activity update
};

// Helper function for timeout wrapping
const withTimeout = (promise, timeoutMs, operationName) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} operation timed out`)), timeoutMs)
    )
  ]);
};

// Clean up handler for timeouts
async function handleTimeout(error) {
  if (error.message.includes('timed out')) {
    console.log(`[${new Date().toISOString()}] Timeout occurred - initiating cleanup`);
    await cleanupConnections();
  }
}

// Connection cleanup function
async function cleanupConnections() {
  try {
    // Add any necessary connection cleanup logic here
    console.log(`[${new Date().toISOString()}] Cleaning up connections`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error during cleanup:`, error);
  }
}

// Function to fetch and post inscriptions
async function fetchAndPostInscriptions() {
  if (isInscriptionFetchRunning) {
    console.log(`[${new Date().toISOString()}] Inscription fetch already running. Skipping.`);
    return;
  }

  isInscriptionFetchRunning = true;
  console.log(`[${new Date().toISOString()}] Starting inscription fetch process`);

  try {
    const projectSlug = 'aeonsbtc';
    const inscriptions = await withTimeout(
      fetchInscriptionsFromAPI(),
      TIMEOUTS.FETCH_INSCRIPTIONS,
      'Fetch inscriptions'
    );

    if (!inscriptions?.length) {
      throw new Error('No valid inscriptions data received');
    }

    console.log(`[${new Date().toISOString()}] Fetched ${inscriptions.length} inscriptions`);

    const result = await withTimeout(
      insertInscriptionsToDB(inscriptions, projectSlug),
      TIMEOUTS.INSERT_INSCRIPTIONS,
      'Insert inscriptions'
    );

    console.log(`[${new Date().toISOString()}] Database operation completed:`);
    console.log(`- Inserted: ${result.insertedCount}`);
    console.log(`- Skipped: ${result.skippedCount}`);
    console.log(`- Total in DB: ${result.totalCount}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in inscription fetch/post process:`, error);
    await handleTimeout(error);
  } finally {
    isInscriptionFetchRunning = false;
  }
}

// Function to update inscription wallets
async function updateInscriptionWallets() {
  if (isWalletTrackingRunning) {
    console.log(`[${new Date().toISOString()}] Wallet tracking update is already running. Skipping.`);
    return;
  }

  isWalletTrackingRunning = true;
  console.log(`[${new Date().toISOString()}] Starting inscription wallet tracking update`);

  try {
    // First fix any unknown project slugs
    await withTimeout(
      fixUnknownProjectSlugs(),
      TIMEOUTS.WALLET_TRACKING,
      'Fix unknown project slugs'
    );

    // Then update wallet tracking
    await withTimeout(
      updateWalletTracking(),
      TIMEOUTS.WALLET_TRACKING,
      'Wallet tracking'
    );

    console.log(`[${new Date().toISOString()}] Wallet tracking update completed`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error updating wallet tracking:`, error);
    await handleTimeout(error);
  } finally {
    isWalletTrackingRunning = false;
  }
}

// Function to fetch and post runes (holders info)
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

// Function to update trending runes
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

// Function to update rune activity
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

// Start cron jobs
function startCronJobs() {
  console.log(`[${new Date().toISOString()}] Starting cron jobs`);

  // Wallet tracking every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled wallet tracking update`);
    await updateInscriptionWallets();
  });

  // Blockchain data updates (every minute)
  cron.schedule('* * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running blockchain data update`);
    try {
      await updateAllData(false); // Regular updates without backfill
      await updateRawTransactionData();
    } catch (error) {
      console.error('Error updating blockchain data:', error);
    }
  });

  // Backfill inscriptions once a day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running backfill for inscriptions`);
    try {
      await updateAllData(true); // Backfill inscriptions
    } catch (error) {
      console.error('Error during backfill:', error);
    }
  });

  // Trending runes update every 3 minutes
  cron.schedule('*/3 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running trending runes update`);
    await updateTrendingRunesData();
  });

  // Fetch trending data every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running fetchAndStoreTrendingData job`);
    try {
      await fetchAndStoreTrendingData();
    } catch (error) {
      console.error('Error fetching and storing trending data:', error);
    }
  });

  // Run runes update every hour at minute 30
  cron.schedule('30 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled runes update`);
    await fetchAndPostRunes();
  });

  // Run rune activity update every 5 minutes (adjust as needed)
  cron.schedule('*/5 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running rune activity update`);
    await updateRuneActivityData();
  });

  // Initial runs after startup
  (async () => {
    try {
      await updateInscriptionWallets();
      await fetchAndPostRunes();
      await updateTrendingRunesData();
      await updateRuneActivityData(); // Run rune activity update at startup
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in initial setup:`, error);
    }
  })();

  console.log(`[${new Date().toISOString()}] All cron jobs started`);
}

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] Received SIGTERM - shutting down gracefully`);
  cleanupConnections().finally(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log(`[${new Date().toISOString()}] Received SIGINT - shutting down gracefully`);
  cleanupConnections().finally(() => process.exit(0));
});

// Start the cron jobs
startCronJobs();

// Keep the script running
process.stdin.resume();
