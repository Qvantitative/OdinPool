// updateRawTransaction.mjs

import BitcoinCore from 'bitcoin-core';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';
import * as bitcoin from 'bitcoinjs-lib';
import pLimit from 'p-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: `${__dirname}/.env` });

const { Pool } = pg;

const client = new BitcoinCore({
  network: 'mainnet',
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

async function getLatestBlockHeight() {
  try {
    return await client.getBlockCount();
  } catch (error) {
    console.error('Error fetching latest block height:', error);
    throw error;
  }
}

async function getLastProcessedBlockHeight() {
  try {
    const result = await pool.query('SELECT MAX(block_height) as last_height FROM transactions');
    return result.rows[0].last_height || 0;
  } catch (error) {
    console.error('Error fetching last processed block height:', error);
    throw error;
  }
}

// Function to get the start block for processing (100 blocks back)
async function getStartBlockHeight() {
  const latestBlockHeight = await getLatestBlockHeight();
  return Math.max(latestBlockHeight - 99, 0); // Start 99 blocks back, but not before genesis block
}

// New function to process mempool transactions
async function processMempoolTransactions() {
  console.log('Processing mempool transactions');
  try {
    const mempoolTxids = await client.getRawMempool();
    const txLimit = pLimit(5); // Limit concurrent processing

    await Promise.all(
      mempoolTxids.map((txid) =>
        txLimit(() => processTransaction(txid, null, Math.floor(Date.now() / 1000)))
      )
    );

    console.log(`Processed ${mempoolTxids.length} mempool transactions`);
    return true;
  } catch (error) {
    console.error('Error processing mempool transactions:', error);
    return false;
  }
}

// Function to process a single transaction
async function processTransaction(txid, blockHeight, blockTime) {
  try {
    const rawTx = await client.getRawTransaction(txid, true);
    if (!rawTx) {
      throw new Error(`No transaction data found for txid ${txid}`);
    }

    // Check if the transaction has been replaced
    if (rawTx.replaced_by_txid) {
      console.warn(`Transaction ${txid} has been replaced by ${rawTx.replaced_by_txid}`);

      // Log the full details of the replaced transaction in the terminal
      console.log('Replaced Transaction Details:', JSON.stringify(rawTx, null, 2));

      // You could choose to log or insert the replaced transaction's information here
      return; // Skip further processing for this replaced transaction
    }

    // Initialize variables
    const txCache = new Map(); // For caching previous transactions
    const prevTxIdCache = new Map(); // For caching previous transaction IDs from the database
    const outputsData = [];
    const inputsData = [];
    let totalOutputValue = 0;
    let totalInputValue = 0;
    let fee = 0;

    // Process outputs
    for (const output of rawTx.vout) {
      const outputIndex = output.n;
      const value = output.value;
      totalOutputValue += value;
      const scriptPubKeyHex = output.scriptPubKey.hex;
      let address = null;

      // Check if scriptPubKey starts with '6a' and label it as 'OP_Return'
      if (scriptPubKeyHex.startsWith('6a')) {
        address = 'OP_Return';
      } else if (output.scriptPubKey.addresses && output.scriptPubKey.addresses.length > 0) {
        address = output.scriptPubKey.addresses[0];
      } else if (output.scriptPubKey.address) {
        address = output.scriptPubKey.address;
      } else {
        console.warn(`No address found in scriptPubKey for txid: ${txid}, script: ${scriptPubKeyHex}`);
        address = null; // Skip unsupported or empty scripts
      }

      outputsData.push({
        outputIndex,
        value,
        scriptPubKey: scriptPubKeyHex,
        address,
      });
    }

    // Process inputs
    if (rawTx.vin[0].coinbase) {
      // Coinbase transaction
      totalInputValue = 0;
      fee = 0;

      const inputIndex = 0;
      const previousTxid = null;
      const previousTransactionId = null;
      const previousOutputIndex = null;
      const scriptSig = rawTx.vin[0].coinbase;
      const sequence = rawTx.vin[0].sequence;
      const value = 0; // Coinbase input value is zero
      const address = null; // No address for coinbase input

      inputsData.push({
        inputIndex,
        previousTxid,
        previousTransactionId,
        previousOutputIndex,
        scriptSig,
        sequence,
        value,
        address,
      });
    } else {
      // Regular transaction
      let inputIndex = 0;
      for (const input of rawTx.vin) {
        const previousTxid = input.txid;
        const previousOutputIndex = input.vout;
        const scriptSig = input.scriptSig ? input.scriptSig.hex : null;
        const sequence = input.sequence;

        // Get the value and address of the previous output being spent
        let prevTx;
        if (txCache.has(previousTxid)) {
          prevTx = txCache.get(previousTxid);
        } else {
          prevTx = await client.getRawTransaction(previousTxid, true);
          txCache.set(previousTxid, prevTx);
        }
        if (!prevTx) {
          throw new Error(`Previous transaction ${previousTxid} not found`);
        }
        const prevOutput = prevTx.vout[previousOutputIndex];
        const value = prevOutput.value;
        totalInputValue += value;

        // Extract the address from the previous output's scriptPubKey
        let address = null;
        if (prevOutput.scriptPubKey.addresses && prevOutput.scriptPubKey.addresses.length > 0) {
          address = prevOutput.scriptPubKey.addresses[0];
        } else if (prevOutput.scriptPubKey.address) {
          address = prevOutput.scriptPubKey.address;
        } else {
          // Use bitcoinjs-lib to extract the address
          try {
            const scriptBuffer = Buffer.from(prevOutput.scriptPubKey.hex, 'hex');
            const scriptType = prevOutput.scriptPubKey.type;

            let payment;
            switch (scriptType) {
              case 'pubkeyhash':
                payment = bitcoin.payments.p2pkh({ output: scriptBuffer });
                break;
              case 'scripthash':
                payment = bitcoin.payments.p2sh({ output: scriptBuffer });
                break;
              case 'witness_v0_keyhash':
                payment = bitcoin.payments.p2wpkh({ output: scriptBuffer });
                break;
              case 'witness_v0_scripthash':
                payment = bitcoin.payments.p2wsh({ output: scriptBuffer });
                break;
              default:
                console.warn(`Unsupported script type ${scriptType} for txid: ${previousTxid}`);
                break;
            }

            if (payment && payment.address) {
              address = payment.address;
            }
          } catch (error) {
            console.error('Error decoding previous output scriptPubKey:', error);
          }
        }

        // Fetch the previous transaction ID from the database
        let prevTransactionId = null;
        if (prevTxIdCache.has(previousTxid)) {
          prevTransactionId = prevTxIdCache.get(previousTxid);
        } else {
          const prevTxResult = await pool.query(
            'SELECT id FROM transactions WHERE txid = $1 LIMIT 1',
            [previousTxid]
          );
          if (prevTxResult.rows.length > 0) {
            prevTransactionId = prevTxResult.rows[0].id;
            prevTxIdCache.set(previousTxid, prevTransactionId);
          } else {
            // Handle the case where the previous transaction is not in the database
            // console.warn(`Previous transaction ${previousTxid} not found in the database.`);
            // Optionally, insert the previous transaction into the database here
          }
        }

        inputsData.push({
          inputIndex,
          previousTxid,
          previousTransactionId: prevTransactionId,
          previousOutputIndex,
          scriptSig,
          sequence,
          value,
          address,
        });

        inputIndex += 1;
      }

      // Calculate fee
      fee = totalInputValue - totalOutputValue;
    }

    // Insert transaction into the database and get the transaction ID
    const transactionQuery = `
      INSERT INTO transactions
      (txid, block_height, total_input_value, total_output_value, fee, size, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (txid) DO UPDATE SET
        block_height = COALESCE(EXCLUDED.block_height, transactions.block_height),
        total_input_value = EXCLUDED.total_input_value,
        total_output_value = EXCLUDED.total_output_value,
        fee = EXCLUDED.fee,
        size = EXCLUDED.size,
        created_at = EXCLUDED.created_at
      RETURNING id
    `;

    const transactionResult = await pool.query(transactionQuery, [
      txid,
      blockHeight,
      totalInputValue,
      totalOutputValue,
      fee,
      rawTx.size, // Ensure this field is passed correctly
      new Date(blockTime * 1000),
    ]);

    // Add timing update after successful transaction insert
    await updateTransactionTiming(txid, blockHeight);

    const transactionId = transactionResult.rows[0].id; // This is the integer id

    // Insert outputs
    for (const outputData of outputsData) {
      const outputQuery = `
        INSERT INTO outputs
        (transaction_id, output_index, value, script_pub_key, address)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (transaction_id, output_index) DO NOTHING
      `;

      await pool.query(outputQuery, [
        transactionId,
        outputData.outputIndex,
        outputData.value,
        outputData.scriptPubKey,
        outputData.address,
      ]);
    }

    // Insert inputs
    for (const inputData of inputsData) {
      const inputQuery = `
        INSERT INTO inputs
        (transaction_id, input_index, previous_txid, previous_transaction_id, previous_output_index, script_sig, sequence, value, address)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (transaction_id, input_index) DO NOTHING
      `;

      await pool.query(inputQuery, [
        transactionId, // Use transactionId (integer id from transactions table)
        inputData.inputIndex,
        inputData.previousTxid,
        inputData.previousTransactionId,
        inputData.previousOutputIndex,
        inputData.scriptSig,
        inputData.sequence,
        inputData.value,
        inputData.address,
      ]);
    }

  } catch (error) {
    if (error.message.includes('No such mempool or blockchain transaction')) {
      console.warn(`Transaction ${txid} may have been replaced. Attempting to check replacement...`);
      // Optional: You can log or handle transactions with this specific error here.
    } else {
      console.error(`Error processing transaction ${txid}:`, error);
    }
  }
}

// Function to process all transactions in a block with concurrency control

async function processBlock(height) {
  console.log(`Processing block ${height}`);
  try {
    const blockHash = await client.getBlockHash(height);
    const block = await client.getBlock(blockHash);

    const txLimit = pLimit(10);

    await Promise.all(
      block.tx.map((txid) =>
        txLimit(() => processTransaction(txid, height, block.time))
      )
    );

    console.log(
      `Block ${height} processed successfully with ${block.tx.length} transactions.`
    );

    return true;
  } catch (error) {
    console.error(`Error processing block ${height}:`, error);
    return false;
  }
}

// Add this function to handle timing updates
async function updateTransactionTiming(txid, blockHeight) {
  try {
    const query = `
      INSERT INTO transaction_timing (txid, mempool_time, confirmation_time)
      VALUES ($1,
        CASE WHEN ($2::integer IS NULL) THEN CURRENT_TIMESTAMP ELSE NULL END,
        CASE WHEN ($2::integer IS NOT NULL) THEN CURRENT_TIMESTAMP ELSE NULL END
      )
      ON CONFLICT (txid) DO UPDATE SET
        confirmation_time = CASE
          WHEN transaction_timing.confirmation_time IS NULL AND ($2::integer IS NOT NULL)
          THEN CURRENT_TIMESTAMP
          ELSE transaction_timing.confirmation_time
        END;
    `;

    await pool.query(query, [txid, blockHeight]);
  } catch (error) {
    console.error(`Error updating timing for transaction ${txid}:`, error);
  }
}

// Modify updateRawTransactionData to include mempool processing
export async function updateRawTransactionData() {
  console.log('Starting transaction update process');
  try {
    const latestBlockHeight = await getLatestBlockHeight();
    const lastProcessedHeight = await getLastProcessedBlockHeight();

    // Process blocks in chunks
    const chunkSize = 10; // Adjust based on your system's capabilities
    for (let height = lastProcessedHeight + 1; height <= latestBlockHeight; height += chunkSize) {
      const endHeight = Math.min(height + chunkSize - 1, latestBlockHeight);
      console.log(`Processing blocks ${height} to ${endHeight}`);

      for (let blockHeight = height; blockHeight <= endHeight; blockHeight++) {
        const blockSuccess = await processBlock(blockHeight);
        if (blockSuccess) {
          console.log(`Block ${blockHeight} processed successfully`);
        } else {
          console.log(`Failed to process block ${blockHeight}`);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }

    // Process mempool transactions in smaller batches
    console.log('Processing mempool transactions');
    const mempoolSuccess = await processMempoolTransactions();

    await pool.query('REFRESH MATERIALIZED VIEW address_balances');
    console.log('Materialized view refreshed');

    return { processedBlock: latestBlockHeight, mempoolProcessed: mempoolSuccess };
  } catch (error) {
    console.error('Error in updateRawTransactionData:', error);
    throw error;
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  updateRawTransactionData()
    .then((result) => {
      if (result) {
        console.log(`Update process completed. Processed block ${result.processedBlock}.`);
      } else {
        console.log('No update was performed or all blocks are already processed.');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}