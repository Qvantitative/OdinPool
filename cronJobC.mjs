// cronJobC.mjs

import cron from 'node-cron';
import { updateWalletActivities } from './runesWallet.js';

const WALLETS_TO_TRACK = [
  'bc1pt65exley6pv6uqws7xr3ku7u922tween0nfyz257rnl5300cjnrsjp9er6' // Add or replace wallet addresses as needed
];

// Track running state for each wallet
const runningState = {
  walletActivities: new Set()
};

const TIMEOUTS = {
  WALLET_ACTIVITIES_UPDATE: 600000 // 10 minutes for wallet activities update, adjust as needed
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

// Update wallet activities for a specific wallet
async function updateActivitiesForWallet(walletAddr) {
  if (runningState.walletActivities.has(walletAddr)) {
    console.log(`[${new Date().toISOString()}] Wallet activities update for ${walletAddr} already running. Skipping.`);
    return;
  }

  runningState.walletActivities.add(walletAddr);
  console.log(`[${new Date().toISOString()}] Starting wallet activities update for ${walletAddr}`);

  try {
    await withTimeout(
      updateWalletActivities(walletAddr),
      TIMEOUTS.WALLET_ACTIVITIES_UPDATE,
      `Wallet activities update for ${walletAddr}`
    );
    console.log(`[${new Date().toISOString()}] Completed wallet activities update for ${walletAddr}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in wallet activities update for ${walletAddr}:`, error);
    await handleTimeout(error);
  } finally {
    runningState.walletActivities.delete(walletAddr);
  }
}

async function processAllWallets(operation) {
  for (const walletAddr of WALLETS_TO_TRACK) {
    await operation(walletAddr);
  }
}

function startCronJobs() {
  console.log(`[${new Date().toISOString()}] Starting wallet activities cron jobs for ${WALLETS_TO_TRACK.join(', ')}`);

  // Example: Run wallet activities update every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running wallet activities update`);
    await processAllWallets(updateActivitiesForWallet);
  });

  // Initial runs after startup
  (async () => {
    try {
      await processAllWallets(updateActivitiesForWallet);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in initial setup:`, error);
    }
  })();

  console.log(`[${new Date().toISOString()}] Wallet activities cron jobs started`);
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
