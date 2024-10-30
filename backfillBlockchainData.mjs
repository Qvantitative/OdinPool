// backfillBlockchainData.mjs

import BitcoinCore from 'bitcoin-core';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';
import pLimit from 'p-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: `${__dirname}/.env` });

const { Pool } = pg;

const client = new BitcoinCore({
  network: 'mainnet',
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

// Function to get the latest block height
async function getLatestBlockHeight() {
  const latestHeight = await client.getBlockCount();
  console.log(`Latest Block Height: ${latestHeight}`);
  return latestHeight;
}

// Function to get the last processed block height for backfilling
async function getLastBackfilledBlockHeight() {
  try {
    const result = await pool.query('SELECT MAX(block_height) as last_height FROM transactions WHERE backfilled = TRUE');
    const lastHeight = result.rows[0]?.last_height || 0;
    console.log(`Last Backfilled Block Height: ${lastHeight}`);
    return lastHeight;
  } catch (error) {
    console.error('Error fetching last backfilled block height:', error);
    return 0; // Start from the genesis block if no blocks have been backfilled yet
  }
}

// Function to process each block and store transactions
async function processBlockForBackfill(height) {
  console.log(`Backfilling block ${height}`);
  try {
    const blockHash = await client.getBlockHash(height);
    const block = await client.getBlock(blockHash);
    const txLimit = pLimit(10); // Limit concurrency

    await Promise.all(
      block.tx.map((txid) =>
        txLimit(() => processTransaction(txid, height, block.time))
      )
    );

    console.log(`Backfilled block ${height} successfully with ${block.tx.length} transactions.`);
    return true;
  } catch (error) {
    console.error(`Error backfilling block ${height}:`, error);
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

      // Optionally store replaced transaction details in the database
      await pool.query(
        'INSERT INTO replaced_transactions (original_txid, replaced_by_txid) VALUES ($1, $2) ON CONFLICT (original_txid) DO NOTHING',
        [txid, rawTx.replaced_by_txid]
      );

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
          prevTx = await client.getRawTransaction(previousTxid, true).catch((error) => {
            console.warn(`Previous transaction ${previousTxid} not found. Fetching from Bitcoin node failed.`);
            return null; // Return null if fetching previous transaction fails
          });
          if (!prevTx) {
            console.warn(`Previous transaction ${previousTxid} not found and not retrievable from Bitcoin node.`);
            continue; // Skip processing this input if the previous transaction can't be fetched
          }
          txCache.set(previousTxid, prevTx);
        }

        if (!prevTx || !prevTx.vout || !prevTx.vout[previousOutputIndex]) {
          console.warn(`Previous output not found for txid ${previousTxid} at index ${previousOutputIndex}. Skipping input.`);
          continue; // Skip processing if previous output is not found or undefined
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
            console.warn(`Previous transaction ${previousTxid} not found in the database.`);
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
      (txid, block_height, total_input_value, total_output_value, fee, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (txid) DO UPDATE SET
        block_height = COALESCE(EXCLUDED.block_height, transactions.block_height),
        total_input_value = EXCLUDED.total_input_value,
        total_output_value = EXCLUDED.total_output_value,
        fee = EXCLUDED.fee,
        created_at = EXCLUDED.created_at
      RETURNING id
    `;

    const transactionResult = await pool.query(transactionQuery, [
      txid,
      blockHeight,
      totalInputValue,
      totalOutputValue,
      fee,
      new Date(blockTime * 1000),
    ]);

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
    console.error(`Error processing transaction ${txid}:`, error);
  }
}

// Function to backfill blocks in chunks
export async function backfillBlocks() {
  try {
    const latestBlockHeight = await getLatestBlockHeight();
    const lastBackfilledHeight = await getLastBackfilledBlockHeight();

    const chunkSize = 100; // Process 100 blocks at a time

    for (let height = lastBackfilledHeight + 1; height <= latestBlockHeight; height += chunkSize) {
      const endHeight = Math.min(height + chunkSize - 1, latestBlockHeight);
      console.log(`Backfilling blocks from ${height} to ${endHeight}`);

      for (let blockHeight = height; blockHeight <= endHeight; blockHeight++) {
        await processBlockForBackfill(blockHeight);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
    console.log('Backfill complete!');
  } catch (error) {
    console.error('Error during backfill process:', error);
  }
}

// Standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillBlocks()
    .then((blocksProcessed) => {
      if (blocksProcessed !== undefined) {
        console.log(`Processed ${blocksProcessed} blocks`);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
