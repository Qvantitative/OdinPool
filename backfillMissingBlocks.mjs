import BitcoinCore from 'bitcoin-core';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

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
  ssl: { rejectUnauthorized: false },
});

function decodeCoinbaseInput(hexInput) {
  let decoded = '';
  for (let i = 0; i < hexInput.length; i += 2) {
    const hexByte = hexInput.substr(i, 2);
    const charCode = parseInt(hexByte, 16);
    if (charCode >= 32 && charCode <= 126) { // Printable ASCII range
      decoded += String.fromCharCode(charCode);
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
    "Foundry USA": /foundry/i,
    "Binance Pool": /binance|bnpool/i,
    "ViaBTC": /viabtc/i,
    "Poolin": /poolin/i,
    "Luxor": /luxor tech|powered by luxor|luxor/i,
    "MARA Pool": /MARA Pool|Made in USA/i,
    "SpiderPool": /SpiderPool/i,
    "WhitePool": /WhitePool/i,
    "SBIcrypto.com": /SBIcrypto\.com/i,
    "SecPool": /SecPool/i,
    "Ocean.XYZ": /OCEAN\.XYZ/i,  // Added Ocean.XYZ
    "Neopool": /Neopool/i,  // Added Neopool
    "Unknown SBI": /\u0000\u0000\u0000\u0000\u0000\u0000/,  // Pattern of null bytes often seen
  };

  for (const [pool, pattern] of Object.entries(poolPatterns)) {
    if (pattern.test(decodedInput)) {
      return pool;
    }
  }
  return "Unknown";
}

async function fetchAndInsertBlock(height) {
  try {
    const blockHash = await client.getBlockHash(height);
    const block = await client.getBlock(blockHash);
    const coinbaseTxId = block.tx[0];
    const coinbaseTx = await client.getRawTransaction(coinbaseTxId, true);
    const coinbaseInput = coinbaseTx.vin[0].coinbase;

    const decodedInput = decodeCoinbaseInput(coinbaseInput);
    console.log(`Decoded coinbase input for block ${height}: ${decodedInput}`);

    const miningPool = identifyMiningPool(decodedInput);
    console.log(`Identified mining pool for block ${height}: ${miningPool}`);

    await pool.query(
      `UPDATE blocks
       SET transactions = $2, timestamp = $3, mining_pool = $4
       WHERE block_height = $1`,
      [height, block.nTx, new Date(block.time * 1000), miningPool]
    );
    console.log(`Updated block ${height} with mining pool: ${miningPool}`);
  } catch (error) {
    console.error(`Error fetching/updating block ${height}:`, error);
  }
}

async function backfillMiningPools() {
  const dbBlocks = await pool.query('SELECT block_height FROM blocks WHERE mining_pool IS NULL OR mining_pool = \'Unknown\' ORDER BY block_height');
  const blocksToUpdate = dbBlocks.rows.map(row => row.block_height);

  console.log(`Found ${blocksToUpdate.length} blocks to update`);

  for (const height of blocksToUpdate) {
    await fetchAndInsertBlock(height);
  }
}

backfillMiningPools().then(() => console.log('Backfill complete')).catch(console.error);