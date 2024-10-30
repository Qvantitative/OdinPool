// updateTransactionData.mjs

import BitcoinCore from 'bitcoin-core';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: `${__dirname}/.env` });

const { Pool } = pg;

const client = new BitcoinCore({
  network: 'mainnet', // or 'testnet'
  username: process.env.BITCOIN_RPC_USER,
  password: process.env.BITCOIN_RPC_PASSWORD,
  host: '127.0.0.1',
  port: 8332,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

function getOutputAddress(rawTransaction) {
  // Filter for Taproot outputs (witness_v1_taproot)
  const taprootOutputs = rawTransaction.vout.filter(output =>
    output.value > 0 && output.scriptPubKey.type === 'witness_v1_taproot'
  );

  // If there are no Taproot outputs, return null
  if (taprootOutputs.length === 0) {
    return null;
  }

  // If there's only one Taproot output, return its address
  if (taprootOutputs.length === 1) {
    return taprootOutputs[0].scriptPubKey.address || null;
  }

  // For multiple Taproot outputs, use a heuristic to determine the likely recipient
  // Sort outputs by value in descending order
  taprootOutputs.sort((a, b) => b.value - a.value);

  // Check if the highest value output is significantly larger than the others
  if (taprootOutputs[0].value > taprootOutputs[1].value * 2) {
    return taprootOutputs[0].scriptPubKey.address || null;
  }

  // If no clear recipient, return the address of the first non-change output
  // Assume the first output that's not a round number (in satoshis) is not change
  for (let output of taprootOutputs) {
    if (Math.floor(output.value * 1e8) % 1000 !== 0) {
      return output.scriptPubKey.address || null;
    }
  }

  // If all else fails, return the address of the highest value Taproot output
  return taprootOutputs[0].scriptPubKey.address || null;
}

async function getLatestTransactionTimestamp() {
  try {
    const dbResult = await pool.query(
      'SELECT created_at FROM transactions ORDER BY created_at DESC LIMIT 1'
    );
    return dbResult.rows.length ? dbResult.rows[0].created_at : new Date(0);
  } catch (error) {
    console.error('Error fetching latest transaction timestamp from DB:', error);
    throw error;
  }
}

async function getExistingTransactions() {
  try {
    const dbResult = await pool.query('SELECT txid FROM transactions');
    return new Set(dbResult.rows.map(row => row.txid));
  } catch (error) {
    console.error('Error fetching existing transactions from DB:', error);
    throw error;
  }
}

async function processTransaction(txid, latestTimestamp) {
  console.log(`Processing transaction ${txid}`);
  try {
    const rawTransaction = await client.getRawTransaction(txid, true);

    let transactionTime;
    if (!rawTransaction.time) {
      //console.log(`Transaction ${txid} has no timestamp. Using current time.`);
      transactionTime = new Date();
    } else {
      transactionTime = new Date(rawTransaction.time * 1000);
    }

    if (transactionTime <= latestTimestamp) {
      return null; // Skip if transaction is older than or equal to the latest in DB
    }

    const outputAddress = getOutputAddress(rawTransaction);

    // If no Taproot output found, skip this transaction
    if (!outputAddress) {
      //console.log(`Transaction ${txid} has no Taproot outputs. Skipping.`);
      return null;
    }

    const totalSent = rawTransaction.vout.reduce((sum, output) => sum + output.value, 0);

    return {
      height: rawTransaction.height || null,
      txid,
      time: transactionTime,
      value: totalSent,
      fee: rawTransaction.fee || null,
      output_address: outputAddress
    };
  } catch (error) {
    console.error(`Error processing transaction ${txid}:`, error);
    return null;
  }
}

async function updateMempoolTransactions() {
  try {
    const latestTimestamp = await getLatestTransactionTimestamp();
    const rawMempool = await client.getRawMempool(true);

    const processedTransactions = [];

    for (const [txid, info] of Object.entries(rawMempool)) {
      // Check if the transaction exists and if it has a missing output address
      const existingTx = await pool.query('SELECT * FROM transactions WHERE txid = $1', [txid]);

      if (existingTx.rows.length > 0 && existingTx.rows[0].output_address) {
        console.log(`Transaction ${txid} already exists in the database with an output address. Skipping.`);
        continue;
      }

      const transactionData = await processTransaction(txid, latestTimestamp);
      if (transactionData && transactionData.time instanceof Date && !isNaN(transactionData.time.getTime())) {
        await pool.query(
          `INSERT INTO transactions (height, txid, output_address, value, fee, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (txid) DO UPDATE SET
             height = EXCLUDED.height,
             output_address = EXCLUDED.output_address,
             value = EXCLUDED.value,
             fee = EXCLUDED.fee,
             created_at = EXCLUDED.created_at`,
          [
            transactionData.height,
            transactionData.txid,
            transactionData.output_address,
            transactionData.value,
            transactionData.fee,
            transactionData.time
          ]
        );
        console.log(`Transaction ${transactionData.txid} inserted/updated successfully.`);
        processedTransactions.push(transactionData);
      } else {
        console.error(`Skipping transaction ${txid} due to invalid data`);
      }
    }

    return {
      mempoolSize: Object.keys(rawMempool).length,
      transactions: processedTransactions,
    };
  } catch (error) {
    console.error('Error updating mempool transactions:', error);
    throw error;
  }
}

export async function updateTransactionData() {
  console.log('Starting transaction data update process');
  try {
    const mempoolData = await updateMempoolTransactions();
    console.log('Transaction data update completed successfully');
    return mempoolData;
  } catch (error) {
    console.error('Error in updateTransactionData:', error);
    throw error;
  }
}