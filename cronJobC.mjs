// cronJobC.mjs

import cron from 'node-cron';
import { updateWalletActivities } from './runesWallet.js';
import { updateRunesActivities } from './RunesActivities.js';

// ***** NEW IMPORT ADDED BELOW *****
import { updateRunesActivities as updateNewRuneActivities } from './RuneActivities.js';

const WALLETS_TO_TRACK = [
  'bc1pt65exley6pv6uqws7xr3ku7u922tween0nfyz257rnl5300cjnrsjp9er6' // Add or replace wallet addresses as needed
];

const runningState = {
  walletActivities: new Set(),
  runesActivitiesUpdate: false
};

const TIMEOUTS = {
  WALLET_ACTIVITIES_UPDATE: 600000, // 10 minutes for wallet activities update
  RUNES_ACTIVITIES_UPDATE: 300000   // 5 minutes for runes activities update
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

// New function to handle runes activities update
async function updateRunesActivitiesWithState() {
  if (runningState.runesActivitiesUpdate) {
    console.log(`[${new Date().toISOString()}] Runes activities update already running. Skipping.`);
    return;
  }

  runningState.runesActivitiesUpdate = true;
  console.log(`[${new Date().toISOString()}] Starting runes activities update`);

  try {
    await withTimeout(
      updateRunesActivities(),
      TIMEOUTS.RUNES_ACTIVITIES_UPDATE,
      'Runes activities update'
    );
    console.log(`[${new Date().toISOString()}] Completed runes activities update`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in runes activities update:`, error);
    await handleTimeout(error);
  } finally {
    runningState.runesActivitiesUpdate = false;
  }
}

async function processAllWallets(operation) {
  for (const walletAddr of WALLETS_TO_TRACK) {
    await operation(walletAddr);
  }
}

function startCronJobs() {
  console.log(`[${new Date().toISOString()}] Starting cron jobs for wallet and runes activities`);

  // Run wallet activities update every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running wallet activities update`);
    await processAllWallets(updateActivitiesForWallet);
  });

  // Run runes activities update every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running runes activities update`);
    await updateRunesActivitiesWithState();
  });

  // Initial runs after startup
  (async () => {
    try {
      console.log(`[${new Date().toISOString()}] Running initial updates`);
      await Promise.all([
        processAllWallets(updateActivitiesForWallet),
        updateRunesActivitiesWithState()
      ]);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in initial setup:`, error);
    }
  })();

  console.log(`[${new Date().toISOString()}] All cron jobs started`);
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

// ***** NEW CODE ADDED BELOW *****
// This code adds similar logic for the new RuneActivities.js

// Running state for the new RuneActivities (not altering existing keys, just adding a new variable)
let runningNewRuneActivitiesUpdate = false;

async function updateNewRuneActivitiesWithState() {
  if (runningNewRuneActivitiesUpdate) {
    console.log(`[${new Date().toISOString()}] New Rune activities update already running. Skipping.`);
    return;
  }

  runningNewRuneActivitiesUpdate = true;
  console.log(`[${new Date().toISOString()}] Starting new Rune activities update`);

  try {
    await withTimeout(
      updateNewRuneActivities(), // from RuneActivities.js
      TIMEOUTS.RUNES_ACTIVITIES_UPDATE,
      'New Rune activities update'
    );
    console.log(`[${new Date().toISOString()}] Completed new Rune activities update`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in new Rune activities update:`, error);
    await handleTimeout(error);
  } finally {
    runningNewRuneActivitiesUpdate = false;
  }
}

// Schedule the new Rune activities update every 5 minutes (or another interval as desired)
cron.schedule('*/5 * * * *', async () => {
  console.log(`[${new Date().toISOString()}] Running new Rune activities update`);
  await updateNewRuneActivitiesWithState();
});

// Also run it once on startup
(async () => {
  try {
    console.log(`[${new Date().toISOString()}] Running initial updates for new Rune activities`);
    await updateNewRuneActivitiesWithState();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in initial setup for new Rune activities:`, error);
  }
})();
