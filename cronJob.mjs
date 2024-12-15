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

// Fetch and post inscriptions
async function fetchAndPostInscriptions() {
  if (isInscriptionFetchRunning) {
    console.log(`[${new Date().toISOString()}] Inscription fetch already running. Skipping.`);
    return;
  }

  isInscriptionFetchRunning = true;
  console.log(`[${new Date().toISOString()}] Starting inscription fetch process`);

  try {
    const projectSlug = 'fukuhedrons';
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

  // Fetch trending data every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running fetchAndStoreTrendingData job`);
    try {
      await fetchAndStoreTrendingData();
    } catch (error) {
      console.error('Error fetching and storing trending data:', error);
    }
  });

  // Add this cron job after your existing ones:
  cron.schedule('10 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running fetchAndPostInscriptions job`);
    try {
      await fetchAndPostInscriptions();
    } catch (error) {
      console.error('Error fetching and posting inscriptions:', error);
    }
  });


  // Initial runs after startup
  (async () => {
    try {
      await updateInscriptionWallets();
      // No runes tasks here, those are in cronJobB.mjs now
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in initial setup:`, error);
    }
  })();

  console.log(`[${new Date().toISOString()}] All non-rune cron jobs started`);
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
