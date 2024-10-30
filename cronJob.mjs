// cronJob.mjs

import cron from 'node-cron';
import { updateAllData } from './updateBlockchainData.mjs';
import { updateRawTransactionData } from './updateRawTransaction.mjs';
import { fetchAndStoreTrendingData } from './trending.js';
import {
  fetchInscriptionsFromAPI,
  insertInscriptionsToDB,
  updateWalletTracking,
  updateProjectWalletTracking,
  fixUnknownProjectSlugs
} from './inscriptions.js';

// Process state flags
let isWalletTrackingRunning = false;
let isInscriptionFetchRunning = false;

// Timeout configurations
const TIMEOUTS = {
  FETCH_INSCRIPTIONS: 1800000,    // 30 minutes (increased from 5 minutes)
  INSERT_INSCRIPTIONS: 600000,   // 10 minutes
  WALLET_TRACKING: 3600000,      // 1 hour
  BLOCKCHAIN_UPDATE: 45000,      // 45 seconds
  BACKFILL: 3600000             // 1 hour
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

// Modify fetchAndPostInscriptions to handle the response
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

function startCronJobs() {
  // Run fetchAndPostInscriptions immediately
  console.log(`[${new Date().toISOString()}] Running immediate inscription fetch`);
  //fetchAndPostInscriptions().catch(error => {
  //  console.error(`[${new Date().toISOString()}] Error in immediate inscription fetch:`, error);
  //});

  // Initial delay before starting scheduled jobs
  setTimeout(() => {
    // Run wallet tracking every hour (at minute 0)
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

    // Optional: Backfill inscriptions once a day at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log(`[${new Date().toISOString()}] Running backfill for inscriptions`);
      try {
        await updateAllData(true); // Backfill inscriptions
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

    // Run initial tracking after startup with a delay
    setTimeout(async () => {
      try {
        await updateInscriptionWallets();
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in initial setup:`, error);
      }
    }, 5000);

    console.log(`[${new Date().toISOString()}] All cron jobs started`);
  }, 1000);
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

// Start the cron jobs and immediate fetch
startCronJobs();

// Keep the script running
process.stdin.resume();