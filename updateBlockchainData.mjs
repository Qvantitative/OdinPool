// updateBlockchainData.mjs

import BitcoinCore from 'bitcoin-core';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: `${__dirname}/.env` });

const { Pool } = pg;

const client = new BitcoinCore({
  network: 'mainnet', // or 'testnet'
  username: process.env.BITCOIN_RPC_USER,
  password: process.env.BITCOIN_RPC_PASSWORD,
  host: '68.9.235.71',
  port: 8332,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

function decodeCoinbaseInput(hexInput) {
  let decoded = '';
  for (let i = 0; i < hexInput.length; i += 2) {
    const hexByte = hexInput.substr(i, 2);
    const charCode = parseInt(hexByte, 16);
    if (charCode >= 32 && charCode <= 126) { // Printable ASCII range
      decoded += String.fromCharCode(charCode);
    } else {
      decoded += '.'; // Replace non-printable characters with a dot
    }
  }
  return decoded;
}

function identifyMiningPool(decodedInput) {
  const poolPatterns = {
    "F2Pool": /f2pool|鱼池/i,
    "AntPool": /antpool|蚂蚁/i,
    "SlushPool": /slush|braiinspool/i,
    "BTC.com": /btc\.com|btccom/i,
    "Luxor": /luxor/i,
    "Foundry USA": /foundry/i,
    "ViaBTC": /viabtc/i,
    "Binance Pool": /binance|bnpool/i,
    "Poolin": /poolin/i,
    "MARA Pool": /mara/i,
    "SBI Crypto": /sbicrypto/i,
    "1THash": /1thash/i,
    "NovaBlock": /novablock/i,
    "Huobi Pool": /huobi/i,
    "OKEX": /okex/i,
    "KuCoin": /kucoin/i,
    "Unknown SBI": /\u0000{6,}/  // Pattern of 6 or more null bytes often seen
  };

  for (const [pool, pattern] of Object.entries(poolPatterns)) {
    if (pattern.test(decodedInput)) {
      return pool;
    }
  }
  return "Unknown";
}

async function getLatestBlockHeight() {
  try {
    return await client.getBlockCount();
  } catch (error) {
    console.error('Error fetching latest block height:', error);
    throw error;
  }
}

async function getLatestBlockInDB() {
  try {
    const dbResult = await pool.query(
      'SELECT block_height FROM blocks ORDER BY block_height DESC LIMIT 1'
    );
    return dbResult.rows.length ? dbResult.rows[0].block_height : 0;
  } catch (error) {
    console.error('Error fetching latest block from DB:', error);
    throw error;
  }
}

async function fetchInscriptionCount(height) {
  try {
    const ordResponse = await ordInstance.get(`/block/${height}`), {
      headers: {
        'Accept': 'application/json',
      }
    });

    if (ordResponse.data && Array.isArray(ordResponse.data.inscriptions)) {
      return ordResponse.data.inscriptions.length;
    } else {
      console.warn(`Unexpected Ord server response structure for block ${height}`);
      return 0;
    }
  } catch (ordError) {
    console.error(`Error fetching inscription data for block ${height}:`, ordError);
    return -1; // Return -1 to indicate an error occurred
  }
}

async function processBlock(height) {
  console.log(`Processing block ${height}`);
  try {
    const blockHash = await client.getBlockHash(height);
    const block = await client.getBlock(blockHash, 2); // Get verbose block data

    // Fetch inscription data from Ord server
    let inscriptionsCount = await fetchInscriptionCount(height);

    // If inscriptionsCount is 0, double-check after a short delay
    if (inscriptionsCount === 0) {
      console.log(`Block ${height} initially showed 0 inscriptions. Double-checking...`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds
      inscriptionsCount = await fetchInscriptionCount(height);
      console.log(`Double-check result for block ${height}: ${inscriptionsCount} inscriptions`);
    }

    // If there was an error fetching inscription data, set count to null
    if (inscriptionsCount === -1) {
      inscriptionsCount = null;
    }

    // Process the coinbase transaction to detect mining pool
    const coinbaseTx = block.tx[0];
    const coinbaseInput = coinbaseTx.vin[0].coinbase;
    const decodedInput = decodeCoinbaseInput(coinbaseInput);
    const miningPool = identifyMiningPool(decodedInput);

    // Insert block data into `blocks` table
    await pool.query(
      `INSERT INTO blocks (block_height, transactions, timestamp, mining_pool, inscriptions)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (block_height) DO UPDATE SET
       transactions = EXCLUDED.transactions,
       timestamp = EXCLUDED.timestamp,
       mining_pool = EXCLUDED.mining_pool,
       inscriptions = EXCLUDED.inscriptions`,
      [height, block.nTx, new Date(block.time * 1000), miningPool, inscriptionsCount]
    );
    console.log(`Block ${height} processed with ${inscriptionsCount} inscriptions.`);
  } catch (error) {
    console.error(`Error processing block ${height}:`, error);
    throw error;
  }
}

async function updateBlockData() {
  let newBlocksProcessed = false;
  try {
    const latestBlockHeight = await getLatestBlockHeight();
    const latestBlockInDB = await getLatestBlockInDB();

    console.log(`Updating blocks from ${latestBlockInDB + 1} to ${latestBlockHeight}`);

    for (let height = latestBlockInDB + 1; height <= latestBlockHeight; height++) {
      await processBlock(height);
      newBlocksProcessed = true;
    }
  } catch (error) {
    console.error('Error updating block data:', error);
  }
  return newBlocksProcessed;
}

async function updateFeeEstimates() {
  try {
    console.log('Fetching block template for fee estimation');
    const blockTemplate = await client.getBlockTemplate({ rules: ['segwit'] });

    const transactionFees = blockTemplate.transactions.map((tx) => {
      const virtualSize = tx.weight / 4;
      return parseFloat((tx.fee / virtualSize).toFixed(2));
    });

    const averageFeeEstimate = transactionFees.reduce((sum, rate) => sum + rate, 0) / transactionFees.length;
    const minFee = Math.min(...transactionFees);
    const maxFee = Math.max(...transactionFees);

    const dbResult = await pool.query('SELECT block_height FROM blocks WHERE fees_estimate IS NULL ORDER BY block_height DESC LIMIT 1');
    if (dbResult.rows.length === 0) {
      console.log('No blocks to update with fee estimates');
      return;
    }

    const latestBlockInDB = dbResult.rows[0].block_height;
    const blockHash = await client.getBlockHash(latestBlockInDB);
    const block = await client.getBlock(blockHash);

    await pool.query(
      `UPDATE blocks
       SET fees_estimate = $1, min_fee = $2, max_fee = $3
       WHERE block_height = $4`,
      [
        averageFeeEstimate.toFixed(2),
        minFee.toFixed(2),
        maxFee.toFixed(2),
        block.height
      ]
    );
    console.log(`Block ${block.height} updated with fee estimates`);
  } catch (error) {
    console.error('Error updating fee estimates:', error);
  }
}

async function updateBlockInscriptions(height) {
  try {
    // Check if the block has already been backfilled
    const { rows: existingRows } = await pool.query(
      'SELECT inscriptions FROM blocks WHERE block_height = $1',
      [height]
    );

    if (existingRows.length > 0 && existingRows[0].inscriptions !== null) {
      console.log(`Block ${height} already backfilled. Skipping.`);
      return false; // Indicate that the block was skipped
    }

    const ordResponse = await axios.get(`http://68.9.235.71:3000/block/${height}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    let inscriptionsCount = 0;
    if (ordResponse.data && Array.isArray(ordResponse.data.inscriptions)) {
      inscriptionsCount = ordResponse.data.inscriptions.length;
    }

    await pool.query(
      `UPDATE blocks SET inscriptions = $1 WHERE block_height = $2`,
      [inscriptionsCount, height]
    );

    console.log(`Updated block ${height} with ${inscriptionsCount} inscriptions.`);
    return true;
  } catch (error) {
    console.error(`Error updating inscriptions for block ${height}:`, error);
    return false; // Return false instead of throwing to allow the process to continue
  }
}

async function backfillAllBlocksWithInscriptions(batchSize = 100) {
  console.log('Starting to backfill all blocks with inscription data from newest to oldest');
  try {
    // Get the latest block height
    const latestBlockResult = await pool.query('SELECT MAX(block_height) as max_height FROM blocks');
    const latestBlockHeight = latestBlockResult.rows[0].max_height;

    // Get the oldest block height
    const oldestBlockResult = await pool.query('SELECT MIN(block_height) as min_height FROM blocks');
    const oldestBlockHeight = oldestBlockResult.rows[0].min_height;

    for (let startHeight = latestBlockHeight; startHeight >= oldestBlockHeight; startHeight -= batchSize) {
      const endHeight = Math.max(startHeight - batchSize + 1, oldestBlockHeight);

      // Modified query to select only blocks where inscriptions is NULL
      const { rows } = await pool.query(
        'SELECT block_height FROM blocks WHERE block_height BETWEEN $1 AND $2 AND inscriptions IS NULL ORDER BY block_height DESC',
        [endHeight, startHeight]
      );

      if (rows.length === 0) {
        //console.log(`No blocks to backfill between heights ${startHeight} and ${endHeight}`);
        continue;
      }

      const results = await Promise.all(rows.map(row => updateBlockInscriptions(row.block_height)));
      const successCount = results.filter(result => result).length;

      console.log(`Processed blocks ${startHeight} to ${endHeight}. Successful updates: ${successCount}/${rows.length}`);

      // Add a delay between batches to avoid overwhelming the Ord server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('Finished backfilling all blocks with inscription data');
  } catch (error) {
    console.error('Error during backfill process:', error);
  }
}

let isBackfillRunning = false;

async function recheckZeroInscriptionBlocks() {
  console.log('Starting to recheck blocks with zero inscriptions');
  try {
    // Fetch all blocks with zero inscriptions
    const { rows } = await pool.query(
      'SELECT block_height FROM blocks WHERE inscriptions = 0 ORDER BY block_height DESC'
    );

    for (const row of rows) {
      const height = row.block_height;
      console.log(`Rechecking block ${height}`);

      let inscriptionsCount = await fetchInscriptionCount(height);

      // Double-check after a short delay if it's still 0
      if (inscriptionsCount === 0) {
        console.log(`Block ${height} still shows 0 inscriptions. Double-checking...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds
        inscriptionsCount = await fetchInscriptionCount(height);
      }

      // Update the database with the new count
      if (inscriptionsCount !== 0) {
        await pool.query(
          'UPDATE blocks SET inscriptions = $1 WHERE block_height = $2',
          [inscriptionsCount, height]
        );
        console.log(`Updated block ${height} with ${inscriptionsCount} inscriptions.`);
      } else {
        console.log(`Block ${height} confirmed to have 0 inscriptions.`);
      }

      // Add a small delay between blocks to avoid overwhelming the Ord server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('Finished rechecking blocks with zero inscriptions');
  } catch (error) {
    console.error('Error during zero inscription block recheck:', error);
  }
}

// Modify the updateAllData function to include this new process
export async function updateAllData(backfillInscriptions = false, recheckZeroInscriptions = false) {
  if ((backfillInscriptions || recheckZeroInscriptions) && isBackfillRunning) {
    console.log('Backfill or recheck is already running, skipping this invocation.');
    return;
  }

  if (backfillInscriptions || recheckZeroInscriptions) {
    isBackfillRunning = true;
  }

  console.log(`[${new Date().toISOString()}] Starting data update process`);
  console.log(`backfillInscriptions: ${backfillInscriptions}, recheckZeroInscriptions: ${recheckZeroInscriptions}`);
  try {
    const newBlocksProcessed = await updateBlockData();
    await updateFeeEstimates();

    if (backfillInscriptions) {
      console.log('Starting backfill process for all blocks');
      await backfillAllBlocksWithInscriptions();
    }

    if (recheckZeroInscriptions) {
      console.log('Starting recheck process for blocks with zero inscriptions');
      await recheckZeroInscriptionBlocks();
    }

    console.log('Data update process completed successfully');
    return newBlocksProcessed;
  } catch (error) {
    console.error('Error in updateAllData:', error);
    return false;
  } finally {
    if (backfillInscriptions || recheckZeroInscriptions) {
      isBackfillRunning = false;
    }
  }
}
