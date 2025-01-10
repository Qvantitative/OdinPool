// cronJobC.mjs

import cron from 'node-cron';
import { updateWalletActivities } from './runesWallet.js';
import { updateRunesActivities } from './RunesActivities.js';
import { updateRunesActivities2 } from './RunesActivities2.js';

import { updateRunesActivities as updateNewRuneActivities } from './RuneActivities.js';
import { updateRunesActivities2 as updateNewRuneActivities2 } from './RuneActivities2.js';

const WALLETS_TO_TRACK = [
  'bc1pt65exley6pv6uqws7xr3ku7u922tween0nfyz257rnl5300cjnrsjp9er6' // Add or replace wallet addresses as needed
];

const runningState = {
  walletActivities: new Set(),
  runesActivitiesUpdate: false,
  newRuneActivitiesUpdate: false, // Track new runes activities state
  newRuneActivities2Update: false, // Track new RunesActivities2 update state
};

const TIMEOUTS = {
  WALLET_ACTIVITIES_UPDATE: 600000, // 10 minutes for wallet activities update
  RUNES_ACTIVITIES_UPDATE: 300000,  // 5 minutes for runes activities update
  RUNES_ACTIVITIES2_UPDATE: 300000 // 5 minutes for the second runes activities update
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

// Runes activities update for the second type of runes activities
async function updateRunesActivities2WithState() {
  if (runningState.newRuneActivities2Update) {
    console.log(`[${new Date().toISOString()}] New Runes activities 2 update already running. Skipping.`);
    return;
  }

  runningState.newRuneActivities2Update = true;
  console.log(`[${new Date().toISOString()}] Starting new Runes activities 2 update`);

  try {
    await withTimeout(
      updateNewRuneActivities2(),
      TIMEOUTS.RUNES_ACTIVITIES2_UPDATE,
      'New Runes activities 2 update'
    );
    console.log(`[${new Date().toISOString()}] Completed new Runes activities 2 update`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in new Runes activities 2 update:`, error);
    await handleTimeout(error);
  } finally {
    runningState.newRuneActivities2Update = false;
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

// Process all wallets
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

  // Run new Runes activities 2 update every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running new Runes activities 2 update`);
    await updateRunesActivities2WithState();
  });

  // Initial runs after startup
  (async () => {
    try {
      console.log(`[${new Date().toISOString()}] Running initial updates`);
      await Promise.all([
        processAllWallets(updateActivitiesForWallet),
        updateRunesActivitiesWithState(),
        updateRunesActivities2WithState()
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
