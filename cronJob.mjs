// cronJob.mjs

import cron from 'node-cron';
import { updateAllData } from './updateBlockchainData.mjs';
import { updateRawTransactionData } from './updateRawTransaction.mjs';
import { fetchAndStoreTrendingData } from './trending.js';

import {
  fetchInscriptionsFromAPI,
  insertInscriptionsToDB,
  updateWalletTracking,
  fixUnknownProjectSlugs
} from './inscriptions.js';

let isWalletTrackingRunning = false;
let isInscriptionFetchRunning = false;

const TIMEOUTS = {
  FETCH_INSCRIPTIONS: 1800000,    // 30 minutes
  INSERT_INSCRIPTIONS: 600000,    // 10 minutes
  WALLET_TRACKING: 3600000,       // 1 hour
  BLOCKCHAIN_UPDATE: 45000,       // 45 seconds
  BACKFILL: 3600000,              // 1 hour
  // Remove rune-related timeouts as they're handled in cronJobB.mjs
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

// fetchAndPostInscriptions
async function fetchAndPostInscriptions() {
  if (isInscriptionFetchRunning) {
    console.log(`[${new Date().toISOString()}] Inscription fetch already running. Skipping.`);
    return;
  }

  isInscriptionFetchRunning = true;
  const projectSlug = 'fukuhedrons';

  console.log(`[${new Date().toISOString()}] Starting inscription fetch process`);
  try {
    const inscriptions = await withTimeout(
      fetchInscriptionsFromAPI(projectSlug), // Pass projectSlug
      TIMEOUTS.FETCH_INSCRIPTIONS,
      'Fetch inscriptions'
    );

    if (global.shouldExit) {
      console.log(`[${new Date().toISOString()}] Exiting early due to SIGINT. Partial data fetched will be resumed later.`);
      return;
    }

    if (!inscriptions?.length) {
      console.log(`[${new Date().toISOString()}] No inscriptions returned for this batch, will try again next cycle`);
      return;
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

// Update inscription wallets
async function updateInscriptionWallets() {
  if (isWalletTrackingRunning) {
    console.log(`[${new Date().toISOString()}] Wallet tracking update is already running. Skipping.`);
    return;
  }

  isWalletTrackingRunning = true;
  console.log(`[${new Date().toISOString()}] Starting inscription wallet tracking update`);

  try {
    await withTimeout(
      fixUnknownProjectSlugs(),
      TIMEOUTS.WALLET_TRACKING,
      'Fix unknown project slugs'
    );

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

function startCronJobs() {
  console.log(`[${new Date().toISOString()}] Starting cron jobs (non-rune)`);

  // Wallet tracking every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled wallet tracking update`);
    await updateInscriptionWallets();
  });

  // Blockchain data updates (every minute)
  cron.schedule('* * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running blockchain data update`);
    try {
      await updateAllData(false);
      await updateRawTransactionData();
    } catch (error) {
      console.error('Error updating blockchain data:', error);
    }
  });

  // Backfill inscriptions once a day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running backfill for inscriptions`);
    try {
      await updateAllData(true);
    } catch (error) {
      console.error('Error during backfill:', error);
    }
  });

  // Fetch and post inscriptions every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    //console.log(`[${new Date().toISOString()}] Running scheduled fetchAndPostInscriptions job`);
    console.log(`[${new Date().toISOString()}] Running scheduled fetchAndStoreTrendingData job`);
    try {
      //await fetchAndPostInscriptions();
      await fetchAndStoreTrendingData();
    } catch (error) {
      console.error('Error fetching and posting inscriptions:', error);
    }
  });

  // Initial runs after startup
  (async () => {
    // Run the function once at startup
    try {
      console.log(`[${new Date().toISOString()}] Running fetchAndPostInscriptions job at startup`);
      //await fetchAndPostInscriptions();
      await updateInscriptionWallets();
    } catch (error) {
      //console.error(`[${new Date().toISOString()}] Error running fetchAndPostInscriptions at startup:`, error);
      console.error(`[${new Date().toISOString()}] Error in initial setup:`, error);
    }
  })();

  console.log(`[${new Date().toISOString()}] All non-rune cron jobs started`);
}

process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] Received SIGTERM - shutting down gracefully`);
  cleanupConnections().finally(() => process.exit(0));
});

global.shouldExit = false;

process.on('SIGINT', async () => {
  console.log(`[${new Date().toISOString()}] Received SIGINT - attempting graceful shutdown`);
  if (criticalTaskRunning) {
    console.log(`[${new Date().toISOString()}] Critical task running. Deferring shutdown.`);
    return; // Do not exit if critical tasks are running
  }
  global.shouldExit = true;
  await cleanupConnections();
  process.exit(0);
});

let criticalTaskRunning = false;

async function someCriticalTask() {
  criticalTaskRunning = true;
  try {
    // Your critical task logic here
  } finally {
    criticalTaskRunning = false;
  }
}

startCronJobs();
process.stdin.resume();
