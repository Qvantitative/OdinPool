// server.js

import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { Server } from 'socket.io';
import cors from 'cors';
import pg from 'pg';
import bodyParser from 'body-parser';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { updateAllData } from './updateBlockchainData.mjs';
import { updateRawTransactionData } from './updateRawTransaction.mjs';
import BitcoinCore from 'bitcoin-core';
import { Parser } from 'binary-parser';

// Constants
const RESERVED_RUNE_NAME_VALUE = BigInt('6402364363415443603228541259936211926');
const MAX_RUNE_NAME_LENGTH = 26;

// Configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: `${__dirname}/.env` });

const app = express();

// SSL configuration
const sslOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/odinpool.ai/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/odinpool.ai/fullchain.pem')
};

// Create single HTTPS server
const server = https.createServer(sslOptions, app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: ['https://odinpool.ai', 'https://www.odinpool.ai'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Add SSL settings
  secure: true,
  key: fs.readFileSync('/etc/letsencrypt/live/odinpool.ai/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/odinpool.ai/fullchain.pem'),
});

// For Ord server requests (local)
const ordInstance = axios.create({
  baseURL: process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'  // Local development
    : 'http://68.9.235.71:3000',  // Production
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
});

// For your Digital Ocean server requests
const localInstance = axios.create({
  baseURL: 'http://143.198.17.64:3001'  // Keep this as is
});

// Middleware
app.use(cors({
  origin: ['https://odinpool.ai', 'https://www.odinpool.ai'],
  credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));

// Database
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Bitcoin RPC client configuration
const bitcoinClient = new BitcoinCore({
  network: 'mainnet',
  username: process.env.BITCOIN_RPC_USER,
  password: process.env.BITCOIN_RPC_PASSWORD,
  host: '68.9.235.71',
  port: 8332,
});

// Helper function to chunk data into smaller batches
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

function bigIntReplacer(key, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

function extractPayloadBufferFromHex(hex) {
    console.log('Extracting payload buffer from hex:', hex);
    const buffer = Buffer.from(hex, 'hex');
    let offset = 0;

    // Check for OP_RETURN (0x6a)
    if (buffer[offset] !== 0x6a) {
        throw new Error('Invalid runestone: OP_RETURN not found');
    }
    offset += 1; // Skip OP_RETURN

    // Get the first opcode after OP_RETURN
    const opcode = buffer[offset];
    offset += 1;
    console.log(`Initial opcode: ${opcode.toString(16)}`);

    // Check for OP_PUSHDATA1 (0x4c), OP_PUSHDATA2 (0x4d), OP_PUSHDATA4 (0x4e)
    // or direct push (0x01-0x4b)
    let dataLength = 0;

    if (opcode <= 0x4b) {
        // Direct push of 1-75 bytes
        dataLength = opcode;
    } else if (opcode === 0x4c) {
        // OP_PUSHDATA1
        if (offset >= buffer.length) throw new Error('Invalid OP_PUSHDATA1');
        dataLength = buffer[offset];
        offset += 1;
    } else if (opcode === 0x4d) {
        // OP_PUSHDATA2
        if (offset + 1 >= buffer.length) throw new Error('Invalid OP_PUSHDATA2');
        dataLength = buffer.readUInt16LE(offset);
        offset += 2;
    } else if (opcode === 0x4e) {
        // OP_PUSHDATA4
        if (offset + 3 >= buffer.length) throw new Error('Invalid OP_PUSHDATA4');
        dataLength = buffer.readUInt32LE(offset);
        offset += 4;
    } else {
        // This might be OP_13 (0x5d) which is valid for runestones
        if (opcode === 0x5d) { // OP_13
            // The next byte should be the length of the data
            dataLength = buffer[offset];
            offset += 1;
        } else {
            throw new Error(`Unsupported opcode: ${opcode}`);
        }
    }

    console.log(`Data length: ${dataLength}, Offset after parsing: ${offset}`);
    if (offset + dataLength > buffer.length) {
        throw new Error('Data push length exceeds buffer length');
    }

    const payload = buffer.slice(offset, offset + dataLength);
    console.log('Payload:', payload);
    return payload;
}

function decodeLEB128(buffer) {
    console.log('Decoding LEB128 buffer:', buffer);
    const integers = [];
    let offset = 0;

    while (offset < buffer.length) {
        let result = BigInt(0);
        let shift = BigInt(0);
        let bytesRead = 0;

        try {
            do {
                if (offset >= buffer.length) {
                    console.error(`LEB128 varint truncated at offset: ${offset}`);
                    console.log('Remaining buffer:', buffer.slice(offset));
                    throw new Error('LEB128 varint is truncated');
                }
                const byte = buffer[offset++];
                bytesRead++;

                // Add maximum bytes check
                if (bytesRead > 18) {
                    console.error('LEB128 varint too large');
                    throw new Error('LEB128 varint too large');
                }

                result |= BigInt(byte & 0x7F) << shift;
                shift += BigInt(7);
                console.log(`Intermediate result: ${result}, Byte: ${byte.toString(16)}, Offset: ${offset}`);

                // Check for overflow
                if ((byte & 0x80) === 0) {
                    if (result > BigInt(2) ** BigInt(128) - BigInt(1)) {
                        throw new Error('Value would overflow u128');
                    }
                    break;
                }
            } while (true);

            console.log(`Decoded integer: ${result} at offset: ${offset}`);
            integers.push(result);
        } catch (error) {
            console.error('Error during LEB128 decoding:', error.message);
            console.log('Buffer at error:', buffer.slice(offset));
            break;
        }
    }

    return integers;
}

function parseMessage(integers) {
    const fields = new Map();
    const edicts = [];
    let index = 0;
    let currentBlock = 0n;
    let currentTx = 0n;
    let parsingEdicts = false;
    let mintOperation = null;

    while (index < integers.length) {
        const tag = integers[index++];

        // Check for mint operation tag (20)
        if (tag === BigInt(20) && index + 1 < integers.length) {
            const block = integers[index++];
            if (index < integers.length) {
                const tx = integers[index++];
                mintOperation = { block, tx };
            }
            continue;
        }

        // Check for edict marker (0)
        if (tag === BigInt(0)) {
            parsingEdicts = true;
            break;
        }

        // Handle regular field tags
        if (index < integers.length) {
            const value = integers[index++];
            if (fields.has(tag)) {
                fields.get(tag).push(value);
            } else {
                fields.set(tag, [value]);
            }
        }
    }

    // Parse edicts if we're in edict parsing mode
    if (parsingEdicts) {
        // Make sure we have enough integers for at least one complete edict
        while (index + 3 < integers.length) {
            const blockDelta = integers[index];
            const txDelta = integers[index + 1];
            const amount = integers[index + 2];
            const output = integers[index + 3];

            if (blockDelta !== undefined && txDelta !== undefined &&
                amount !== undefined && output !== undefined) {

                if (blockDelta > 0n) {
                    currentBlock += blockDelta;
                    currentTx = txDelta;
                } else {
                    currentTx += txDelta;
                }

                edicts.push({
                    id: {
                        block: Number(currentBlock),
                        tx: Number(currentTx)
                    },
                    amount: amount,
                    output: Number(output)
                });
            }

            index += 4;
        }
    }

    return { fields, edicts, mintOperation };
}

function decodeMintData(fields, runeValue) {
    console.log('Decoding mint data from fields:', fields);
    console.log('Rune value:', runeValue);

    // Extract mint-specific data
    const mintData = {
        divisibility: 0,
        symbol: undefined,
        supply: undefined,
        terms: undefined,
        runeName: undefined
    };

    // Decode rune name if present
    if (runeValue) {
        mintData.runeName = decodeRuneName(runeValue);
    }

    // Extract symbol (tag 5)
    if (fields.has(BigInt(5))) {
        const symbolValue = fields.get(BigInt(5))[0];
        if (Number.isSafeInteger(Number(symbolValue))) {
            mintData.symbol = String.fromCodePoint(Number(symbolValue));
        }
    }

    // Extract premine/supply (tag 6)
    if (fields.has(BigInt(6))) {
        mintData.supply = fields.get(BigInt(6))[0].toString();
    }

    // Extract cap (tag 8)
    if (fields.has(BigInt(8))) {
        mintData.terms = {
            cap: fields.get(BigInt(8))[0].toString()
        };
    }

    // Extract height ranges if present (tags 12 and 14)
    if (fields.has(BigInt(12)) && fields.has(BigInt(14))) {
        mintData.terms = {
            ...mintData.terms,
            heightStart: Number(fields.get(BigInt(12))[0]),
            heightEnd: Number(fields.get(BigInt(14))[0])
        };
    }

    console.log('Decoded mint data:', mintData);
    return mintData;
}

function extractFields(fields, mintOperation = null) {
    console.log('Extracting fields from:', fields);
    console.log('Mint operation:', mintOperation);

    const result = {};
    const tags = {
        version: BigInt(19),
        flags: BigInt(2),
        rune: BigInt(4),
        spacers: BigInt(3),
        symbol: BigInt(5),
        premine: BigInt(6),
        cap: BigInt(8),
        amount: BigInt(10),
        heightStart: BigInt(12),
        heightEnd: BigInt(14),
        offsetStart: BigInt(16),
        offsetEnd: BigInt(18),
        mint: BigInt(20),
        pointer: BigInt(22),
    };

    // Handle fields
    for (const [tag, values] of fields.entries()) {
        if (tag === tags.version) result.version = Number(values[0]);
        else if (tag === tags.flags) result.flags = Number(values[0]);
        else if (tag === tags.rune) result.rune = values[0];
        else if (tag === tags.spacers) result.spacers = Number(values[0]);
        else if (tag === tags.symbol) {
            const codePoint = Number(values[0]);
            if (Number.isSafeInteger(codePoint)) {
                result.symbol = String.fromCodePoint(codePoint);
            }
        }
        else if (tag === tags.premine) result.premine = values[0].toString();
        else if (tag === tags.cap) result.cap = values[0].toString();
        else if (tag === tags.amount) result.amount = values[0].toString();
        else if (tag === tags.heightStart) result.heightStart = Number(values[0]);
        else if (tag === tags.heightEnd) result.heightEnd = Number(values[0]);
        else if (tag === tags.offsetStart) result.offsetStart = Number(values[0]);
        else if (tag === tags.offsetEnd) result.offsetEnd = Number(values[0]);
        else if (tag === tags.pointer) result.pointer = Number(values[0]);
    }

    // Add mint operation if present
    if (mintOperation) {
        result.mint = {
            block: Number(mintOperation.block),
            tx: Number(mintOperation.tx)
        };
    }

    console.log('Extracted fields result:', result);
    return result;
}

function decodeRuneName(runeValue) {
  console.log('Decoding rune value:', runeValue);

  if (!runeValue || runeValue <= 0n) {
    console.warn('Invalid rune value:', runeValue);
    return undefined;
  }

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let n = runeValue - 1n;
  const chars = [];

  while (n >= 0n) {
    chars.push(letters[Number(n % 26n)]);
    n = (n / 26n) - 1n;
  }

  const result = chars.reverse().join('');
  console.log('Decoded rune name:', result);
  return result;
}

function interpretFlags(flags) {
  console.log('Interpreting flags:', flags);
  return {
    isEtching: (flags & 1) !== 0,
    hasOpenTerms: (flags & 2) !== 0,
  };
}

function formatRuneNameWithSpacers(name, spacers) {
  if (!name || name.length <= 1) return name;

  const spacerBits = spacers.toString(2).padStart(name.length - 1, '0');
  let formattedName = name[0];

  for (let i = 1; i < name.length; i++) {
    if (spacerBits[spacerBits.length - i] === '1') {
      formattedName += '•';
    }
    formattedName += name[i];
  }

  return formattedName;
}

function isCenotaph(fields, edicts) {
    const unrecognizedEvenTags = Array.from(fields.keys()).some(
        tag => tag % BigInt(2) === BigInt(0) && tag > BigInt(22)
    );
    const invalidEdicts = edicts.some(
        edict => edict.id.block === 0 && edict.id.tx !== 0
    );
    const hasUnrecognizedFlags = fields.has(BigInt(2)) &&
        (Number(fields.get(BigInt(2))[0]) & ~(1 | 2 | 4)) !== 0;

    return unrecognizedEvenTags || invalidEdicts || hasUnrecognizedFlags;
}

// Update the main decodeRuneData function to use the enhanced decoders
function decodeRuneData(scriptPubKey) {
    try {
        console.log('Decoding rune data from scriptPubKey:', scriptPubKey);
        const payloadBuffer = extractPayloadBufferFromHex(scriptPubKey.hex);
        const integers = decodeLEB128(payloadBuffer);
        console.log('Decoded integers:', integers);

        const { fields, edicts, mintOperation } = parseMessage(integers);
        console.log('Parsed fields:', fields);
        console.log('Parsed edicts:', edicts);
        console.log('Parsed mint operation:', mintOperation);

        const extractedFields = extractFields(fields, mintOperation);
        console.log('Extracted fields:', extractedFields);

        // Get the rune value from the fields (tag 4)
        const runeValue = fields.has(BigInt(4)) ? fields.get(BigInt(4))[0] : undefined;

        let runeName = '';
        if (runeValue !== undefined) {
            runeName = decodeRuneName(runeValue);
        }

        const flagInterpretation = interpretFlags(extractedFields.flags || 0);
        const formattedRuneName = formatRuneNameWithSpacers(runeName, extractedFields.spacers || 0);
        const cenotaph = isCenotaph(fields, edicts);

        return {
            type: mintOperation ? 'mint_reference' : edicts.length > 0 ? 'transfer' : 'etch',
            runeName,
            formattedRuneName,
            ...extractedFields,
            flagInterpretation,
            mintOperation,
            edicts,
            cenotaph,
            fields: Object.fromEntries(fields)
        };
    } catch (error) {
        console.error('Error decoding rune data:', error);
        return { error: error.message, cenotaph: true };
    }
}

// Socket.io connection
io.on('connection', (socket) => {
  console.log('A client connected');
  socket.on('disconnect', () => console.log('A client disconnected'));
});

// Bitcoin blockchain data updates
async function updateBlockchainDataWithEmit() {
  try {
    const newBlocksProcessed = await updateAllData(true, false);
    if (newBlocksProcessed) {
      const { rows } = await pool.query('SELECT * FROM blocks ORDER BY block_height DESC LIMIT 1');
      if (rows.length > 0) io.emit('new-block', rows[0]);
    }
  } catch (error) {
    console.error('Error updating blockchain data:', error);
  }
}

// Route for inscription updates
app.post('/api/inscriptions', async (req, res) => {
  const projectSlug = req.body.slug || 'bitcoin-frogs'; // Default to 'bitcoin-frogs'
  try {
    // Fetch inscriptions from external API
    const inscriptions = await fetchInscriptionsFromAPI();

    // Insert inscriptions into PostgreSQL
    await insertInscriptionsToDB(inscriptions, projectSlug);

    res.status(200).json({ message: 'Inscriptions updated successfully' });
  } catch (error) {
    console.error('Error in update-inscriptions endpoint:', error);
    res.status(500).json({ error: 'Failed to update inscriptions' });
  }
});

// In server.js
app.post('/api/update-inscriptions', async (req, res) => {
  try {
    // Start the update process in the background
    updateAllData(true, true).catch(error => {
      console.error('Error in background inscription update:', error);
    });
    res.json({ message: 'Inscription update process started in the background' });
  } catch (error) {
    console.error('Error starting inscription update:', error);
    res.status(500).json({ error: 'Failed to start inscription update' });
  }
});

app.post('/api/ord/fetch-block', async (req, res) => {
    const { block_height } = req.body;
    try {
        // Use ordInstance instead of axiosInstance
        const response = await ordInstance.get(`/block/${block_height}`);

        const { height, inscriptions, runes, transactions } = response.data;

        // Insert the data into the database
        const queryText = `
            INSERT INTO ord (height, inscriptions, runes, transactions)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;

        const result = await pool.query(queryText, [
            height,
            JSON.stringify(inscriptions),
            JSON.stringify(runes),
            JSON.stringify(transactions)
        ]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching block data:', error);
        res.status(500).json({ error: 'Failed to fetch and store block data' });
    }
});

// API Endpoints
app.post('/api/blocks', async (req, res) => {
  console.log('POST /api/blocks route hit');
  const { block_height, transactions, timestamp, mining_pool } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM blocks WHERE block_height = $1', [block_height]);

    let result;
    if (rows.length > 0) {
      result = await pool.query(
        'UPDATE blocks SET transactions = $2, timestamp = $3, mining_pool = $4 WHERE block_height = $1 RETURNING *',
        [block_height, transactions, new Date(timestamp * 1000), mining_pool]
      );
    } else {
      result = await pool.query(
        'INSERT INTO blocks (block_height, transactions, timestamp, mining_pool) VALUES ($1, $2, $3, $4) RETURNING *',
        [block_height, transactions, new Date(timestamp * 1000), mining_pool]
      );
    }

    io.emit('new-block', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/inscriptions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM inscriptions ORDER BY id DESC LIMIT 10'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching inscriptions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route with both inscriptionId and project_slug parameters
app.get('/inscription/:inscriptionId/:project_slug', async (req, res) => {
  try {
    const { inscriptionId, project_slug } = req.params;
    const result = await pool.query(
      'SELECT * FROM inscriptions WHERE inscription_id = $1 AND project_slug = $2',
      [inscriptionId, project_slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inscription not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching inscription:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/blocks', async (req, res) => {
  console.log('GET /api/blocks route hit');
  try {
    const limit = parseInt(req.query.limit, 10) || 144;
    const { rows } = await pool.query(
      'SELECT block_height, transactions, timestamp, fees_estimate, min_fee, max_fee, mining_pool, inscriptions FROM blocks ORDER BY block_height DESC LIMIT $1',
      [limit]
    );
    res.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// New endpoint for fetching trending data for a specific collection
app.get('/api/trending/:collectionName', async (req, res) => {
  const { collectionName } = req.params;
  console.log(`Fetching trending info for collection: ${collectionName}`);

  try {
    const result = await pool.query(
      `SELECT * FROM trending_info WHERE LOWER(collection_name) = LOWER($1) ORDER BY timestamp ASC`,
      [collectionName]
    );

    if (result.rows.length === 0) {
      console.warn(`Collection "${collectionName}" not found in database.`);
      return res.status(404).json({ error: `Collection "${collectionName}" not found` });
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Endpoint to fetch transactions (optional)
app.get('/api/transactions/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`Received request for transaction details with txid: ${id}`);

  try {
    // Fetch the transaction from your database
    const transactionResult = await pool.query(
        'SELECT * FROM transactions WHERE txid = $1', [id]
    );
    const transaction = transactionResult.rows[0];

    if (!transaction) {
      console.log(`Transaction with txid: ${id} not found.`);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Fetch transaction timing data
    const timingResult = await pool.query(
      'SELECT confirmation_duration FROM transaction_timing WHERE txid = $1',
      [id]
    );
    const timing = timingResult.rows[0];

    // Fetch inputs and outputs from your database
    const inputsResult = await pool.query('SELECT * FROM inputs WHERE transaction_id = $1', [transaction.id]);
    const inputs = inputsResult.rows;

    const outputsResult = await pool.query('SELECT * FROM outputs WHERE transaction_id = $1', [transaction.id]);
    let outputs = outputsResult.rows;

    // Fetch the raw transaction from Bitcoin Core
    const rawTx = await bitcoinClient.getRawTransaction(transaction.txid, true);

    // Map outputs to include scriptPubKey details
    outputs = outputs.map((output) => {
      const vout = rawTx.vout.find((v) => v.n === output.output_index);
      return {
        ...output,
        scriptPubKey: vout ? vout.scriptPubKey : null,
      };
    });

    res.json({
      transaction: {
        ...transaction,
        confirmation_duration: timing?.confirmation_duration || null,
      },
      inputs,
      outputs,
    });
  } catch (error) {
    console.error('Error fetching transaction details:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Modified /api/transactions endpoint to fetch all transactions for a block
app.get('/api/transactions', async (req, res) => {
  const { block_height } = req.query;

  try {
    const result = await pool.query(
      `SELECT t.*, tt.confirmation_duration, tt.mempool_time
       FROM transactions t
       LEFT JOIN transaction_timing tt ON t.txid = tt.txid
       WHERE t.block_height = $1
       ORDER BY t.created_at DESC`,
      [block_height]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/mempool', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, tt.confirmation_duration, tt.mempool_time
       FROM transactions t
       LEFT JOIN transaction_timing tt ON t.txid = tt.txid
       WHERE t.block_height IS NULL
       AND tt.mempool_time IS NOT NULL
       ORDER BY tt.mempool_time DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching mempool transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/transaction-timing', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;  // Default limit of 10 entries
    const offset = parseInt(req.query.offset) || 0;  // Support pagination

    const query = `
      SELECT
        txid,
        mempool_time,
        confirmation_time,
        EXTRACT(EPOCH FROM (confirmation_time - mempool_time))::INTEGER as confirmation_duration
      FROM transaction_timing
      ORDER BY mempool_time DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = 'SELECT COUNT(*) FROM transaction_timing';

    // Execute both queries in parallel
    const [result, countResult] = await Promise.all([
      pool.query(query, [limit, offset]),
      pool.query(countQuery)
    ]);

    // Format the response
    const response = {
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
        hasMore: offset + result.rows.length < parseInt(countResult.rows[0].count)
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching transaction timing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Optional: Add endpoint for single transaction timing
app.get('/api/transaction-timing/:txid', async (req, res) => {
  try {
    const { txid } = req.params;

    const query = `
      SELECT
        txid,
        mempool_time,
        confirmation_time,
        EXTRACT(EPOCH FROM (confirmation_time - mempool_time))::INTEGER as confirmation_duration
      FROM transaction_timing
      WHERE txid = $1
    `;

    const result = await pool.query(query, [txid]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction timing not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching transaction timing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to fetch top addresses by balance
app.get('/api/top-addresses', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;

    const result = await pool.query(
      `SELECT address, balance
       FROM address_balances
       ORDER BY balance DESC
       LIMIT $1`,
      [limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching top addresses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// New route for /api/ord homepage
app.get('/api/ord', (req, res) => {
  res.json({
    message: "Welcome to the Ordinals API!",
    description: "This API provides information on inscriptions, blocks, addresses, and other ordinals-related data.",
    available_endpoints: [
      { method: "GET", path: "/api/ord/block/:height", description: "Fetch details of a specific block by height." },
      { method: "GET", path: "/api/ord/inscription/:id", description: "Fetch details of a specific inscription by ID." },
      { method: "GET", path: "/api/ord/address/:address", description: "Fetch information for a specific Bitcoin address." },
    ],
  });
});


// New endpoint to fetch block details including inscriptions and runes
app.get('/api/ord/block/:height', async (req, res) => {
  const { height } = req.params;
  try {
    const response = await ordInstance.get(`/block/${height}`);

    if (response.status !== 200) {
      throw new Error(`Ord server responded with status ${response.status}`);
    }

    res.json(response.data);
  } catch (error) {
    console.error(`Error fetching block data from ord server:`, error.message);
    res.status(500).json({ error: 'Failed to fetch block data from ord server' });
  }
});

// New endpoint to fetch inscription data
app.get('/api/ord/inscription/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`Received request for inscription ID: ${id}`);  // Log the inscription ID

  try {
    const response = await ordInstance.get(`/inscription/${id}`);

    if (response.status === 404) {
      console.warn(`Inscription with id ${id} not found.`);
      return res.status(404).json({ error: `Inscription with id ${id} not found` });
    }

    if (response.status !== 200) {
      throw new Error(`Ord server responded with status ${response.status}`);
    }

    res.json(response.data);
  } catch (error) {
    console.error(`Error fetching inscription data for ID: ${id}`);
    console.error(error.stack);  // Log the full error stack trace
    res.status(500).json({ error: 'Failed to fetch inscription data from ord server' });
  }
});

// New endpoint to fetch address data
app.get('/api/ord/address/:address', async (req, res) => {
  const { address } = req.params;
  try {
    // Fetch the list of outputs for the address
    const outputsResponse = await ordInstance.get(`/address/${address}`);

    if (outputsResponse.status !== 200) {
      throw new Error(`Ord server responded with status ${outputsResponse.status}`);
    }

    const outputIdentifiers = outputsResponse.data; // Array of output identifiers

    // Fetch detailed output data for each output
    const outputsData = await Promise.all(
      outputIdentifiers.map(async (outputId) => {
        const outputResponse = await ordInstance.get(`/output/${outputId}`);
        return outputResponse.data;
      })
    );

    // Collect inscriptions and runes from outputs
    let inscriptions = [];
    let runes = [];

    outputsData.forEach((output) => {
      if (output.inscriptions && output.inscriptions.length > 0) {
        inscriptions = inscriptions.concat(output.inscriptions);
      }
      if (output.runes && Object.keys(output.runes).length > 0) {
        runes.push(output.runes);
      }
    });

    // Build the address data
    const addressData = {
      address,
      outputs: outputsData.map((output) => ({
        transaction: output.transaction,
        output_index: output.transaction.split(':')[1],
        value: output.value,
        spent: output.spent,
      })),
      inscriptions,
      runes,
    };

    res.json(addressData);
  } catch (error) {
    console.error(`Error fetching address data from ord server:`, error.message);
    res.status(500).json({ error: 'Failed to fetch address data from ord server' });
  }
});

app.get('/api/runes/activities/summary', async (req, res) => {
  const client = await pool.connect();

  try {
    // Get pagination parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total count for pagination
    const countResult = await client.query(
      'SELECT COUNT(*) FROM v_runes_activities_summary'
    );
    const totalItems = parseInt(countResult.rows[0].count);

    // Get paginated data
    const query = `
      SELECT
        rune_ticker,
        rune_name,
        symbol,
        volume_24h,
        total_volume,
        unit_price_sats,
        unit_price_change,
        market_cap,
        holder_count,
        is_verified,
        updated_at
      FROM v_runes_activities_summary
      ORDER BY volume_24h DESC NULLS LAST
      LIMIT $1 OFFSET $2
    `;

    const result = await client.query(query, [limit, offset]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Format response
    const response = {
      status: 'success',
      data: result.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching runes activities summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch runes activities summary',
      error: error.message
    });
  } finally {
    client.release();
  }
});

app.get('/api/trades/:runeTicker', async (req, res) => {
  try {
    const { runeTicker } = req.params;

    const query = `
      SELECT
        old_owner,
        new_owner,
        COUNT(*) as trade_count,
        MIN(created_at) as first_trade,
        MAX(created_at) as last_trade
      FROM rune_activities_details
      WHERE
        rune_ticker = $1
        AND old_owner IS NOT NULL
        AND new_owner IS NOT NULL
      GROUP BY old_owner, new_owner
      ORDER BY trade_count DESC
      LIMIT 10
    `;

    const result = await pool.query(query, [runeTicker]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching trade data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/trending-runes', async (req, res) => {
 try {
   const { limit = 100, offset = 0 } = req.query;

   const query = `
     WITH latest_runes AS (
       SELECT DISTINCT ON (rune_name)
         id,
         rune_id,
         rune_number,
         rune_name,
         holder_count,
         total_volume,
         avg_price_sats,
         marketcap,
         event_count,
         circulating_supply,
         mint_progress,
         created_at
       FROM trending_runes
       ORDER BY rune_name, created_at DESC
     )
     SELECT *
     FROM latest_runes
     ORDER BY CAST(rune_number AS INTEGER) ASC
     LIMIT $1
     OFFSET $2
   `;

   const result = await pool.query(query, [limit, offset]);

   res.json({
     success: true,
     count: result.rowCount,
     data: result.rows
   });

 } catch (error) {
   console.error('Error fetching trending runes:', error);
   res.status(500).json({
     success: false,
     error: 'Internal server error'
   });
 }
});

app.get('/api/rune/:txid', async (req, res) => {
    const { txid } = req.params;
    console.log(`Fetching raw transaction for txid: ${txid}`);

    try {
        const rawTx = await bitcoinClient.getRawTransaction(txid, true);
        const opReturnOutput = rawTx.vout.find(
            (vout) => vout.scriptPubKey.type === 'nulldata'
        );

        if (!opReturnOutput) {
            return res.status(404).json({ error: 'No OP_RETURN output found in this transaction' });
        }

        const runeData = decodeRuneData(opReturnOutput.scriptPubKey);

        if (runeData.mintOperation) {
            try {
                const block = Number(runeData.mintOperation.block);
                const targetTx = Number(runeData.mintOperation.tx);

                console.log(`Fetching block hash for block: ${block}`);
                const blockHash = await bitcoinClient.getBlockHash(block);
                console.log(`Fetching block data for hash: ${blockHash}`);
                const blockData = await bitcoinClient.getBlock(blockHash, 2);
                console.log(`Block data received. Transactions count: ${blockData.tx.length}`);

                // Define a range to scan around the target tx index
                const start = Math.max(0, targetTx - 5);
                const end = Math.min(blockData.tx.length, targetTx + 5);

                console.log(`Scanning transactions from index ${start} to ${end}`);

                for (let i = start; i < end; i++) {
                    const tx = blockData.tx[i];
                    console.log(`\nChecking transaction at index ${i}: ${tx.txid}`);

                    // Find all OP_RETURN outputs
                    const opReturnOutputs = tx.vout.filter(
                        (vout) => vout.scriptPubKey.type === 'nulldata'
                    );

                    if (opReturnOutputs.length > 0) {
                        console.log(`Found ${opReturnOutputs.length} OP_RETURN outputs in tx ${i}`);

                        // Try each OP_RETURN output
                        for (const output of opReturnOutputs) {
                            try {
                                const mintData = decodeRuneData(output.scriptPubKey);

                                // Check if this looks like valid rune data
                                if (mintData && mintData.type === 'mint') {
                                    console.log(`Found valid rune mint data in transaction ${i}`);
                                    const response = {
                                        type: 'mint_reference',
                                        referenced_mint: {
                                            txid: tx.txid,
                                            block,
                                            original_tx: targetTx,
                                            found_tx: i,
                                            runeName: mintData.runeName,
                                            formattedRuneName: mintData.formattedRuneName,
                                            symbol: mintData.symbol,
                                            supply: mintData.supply,
                                            terms: mintData.terms,
                                            ...JSON.parse(JSON.stringify(mintData, bigIntReplacer))
                                        },
                                        ...JSON.parse(JSON.stringify(runeData, bigIntReplacer))
                                    };
                                    return res.json(response);
                                }
                            } catch (decodeError) {
                                console.log(`Failed to decode OP_RETURN in tx ${i}:`, decodeError.message);
                            }
                        }
                    }
                }

                // If we get here, we couldn't find the mint data
                return res.json({
                    type: 'mint_reference',
                    error: 'Could not find valid rune mint data in nearby transactions',
                    mintOperation: {
                        block,
                        tx: targetTx,
                        scan_range: {
                            start,
                            end,
                            target_tx: targetTx
                        }
                    },
                    ...JSON.parse(JSON.stringify(runeData, bigIntReplacer))
                });
            } catch (mintError) {
                console.error('Error processing mint reference:', mintError);
                return res.json({
                    type: 'mint_reference',
                    error: 'Error processing mint reference',
                    details: mintError.message,
                    mintOperation: {
                        block: Number(runeData.mintOperation.block),
                        tx: Number(runeData.mintOperation.tx)
                    },
                    ...JSON.parse(JSON.stringify(runeData, bigIntReplacer))
                });
            }
        }

        // Handle regular mints
        if (runeData.type === 'mint') {
            return res.json({
                type: 'mint',
                runeName: runeData.runeName,
                formattedRuneName: runeData.formattedRuneName,
                symbol: runeData.symbol,
                supply: runeData.supply,
                terms: runeData.terms,
                flags: runeData.flagInterpretation,
                txid: txid,
                ...JSON.parse(JSON.stringify(runeData, bigIntReplacer))
            });
        }

        // Handle transfers
        if (runeData.type === 'transfer' && runeData.edicts && runeData.edicts.length > 0) {
            try {
                const block = Number(runeData.edicts[0].id.block);
                const tx = Number(runeData.edicts[0].id.tx);

                const blockHash = await bitcoinClient.getBlockHash(block);
                const blockData = await bitcoinClient.getBlock(blockHash, 2);
                const etchingTx = blockData.tx[tx];

                if (etchingTx) {
                    const etchingOpReturn = etchingTx.vout.find(
                        (vout) => vout.scriptPubKey.type === 'nulldata'
                    );

                    if (etchingOpReturn) {
                        const etchingData = decodeRuneData(etchingOpReturn.scriptPubKey);
                        return res.json({
                            type: 'transfer',
                            ...JSON.parse(JSON.stringify(runeData, bigIntReplacer)),
                            etching: {
                                txid: etchingTx.txid,
                                runeName: etchingData.runeName,
                                formattedRuneName: etchingData.formattedRuneName,
                                ...JSON.parse(JSON.stringify(etchingData, bigIntReplacer))
                            }
                        });
                    }
                }
            } catch (etchError) {
                console.error('Error fetching etching transaction:', etchError);
                return res.json({
                    type: 'transfer',
                    error: 'Could not fetch etching transaction',
                    ...JSON.parse(JSON.stringify(runeData, bigIntReplacer))
                });
            }
        }

        return res.json({
            ...JSON.parse(JSON.stringify(runeData, bigIntReplacer)),
            txid
        });

    } catch (error) {
        console.error('Error fetching rune data:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Get basic wallet statistics per project
app.get('/api/wallets/stats', async (req, res) => {
  try {
    const query = `
      SELECT
        project_slug,
        COUNT(DISTINCT address) as unique_holders,
        COUNT(*) as total_inscriptions,
        COUNT(*)::float / COUNT(DISTINCT address) as avg_per_holder
      FROM wallets_ord
      WHERE is_current = TRUE
      GROUP BY project_slug
      ORDER BY total_inscriptions DESC;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching wallet stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get project overlap analysis
app.get('/api/wallets/overlap', async (req, res) => {
  try {
    const query = `
      WITH project_holders AS (
        SELECT
          project_slug,
          COUNT(DISTINCT address) as total_holders
        FROM wallets_ord
        WHERE is_current = TRUE
        GROUP BY project_slug
      )
      SELECT
        p1.project_slug as from_project,
        p2.project_slug as to_project,
        COUNT(DISTINCT p1.address) as shared_holders,
        ph2.total_holders as total_holders_to_project,
        ROUND((COUNT(DISTINCT p1.address)::float / ph2.total_holders * 100)::numeric, 2) as overlap_percentage
      FROM wallets_ord p1
      JOIN wallets_ord p2 ON p1.address = p2.address
      JOIN project_holders ph2 ON p2.project_slug = ph2.project_slug
      WHERE p1.is_current AND p2.is_current
      AND p1.project_slug < p2.project_slug
      GROUP BY p1.project_slug, p2.project_slug, ph2.total_holders
      ORDER BY shared_holders DESC;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching wallet overlap:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get holder distribution for a specific project
app.get('/api/wallets/distribution/:project_slug', async (req, res) => {
  try {
    const { project_slug } = req.params;
    const query = `
      WITH holder_counts AS (
        SELECT
          address,
          COUNT(*) as holding_count
        FROM wallets_ord
        WHERE is_current = TRUE
        AND project_slug = $1
        GROUP BY address
      )
      SELECT
        holding_count,
        COUNT(*) as num_wallets,
        ROUND((COUNT(*)::float / SUM(COUNT(*)) OVER () * 100)::numeric, 2) as percentage
      FROM holder_counts
      GROUP BY holding_count
      ORDER BY holding_count DESC;
    `;

    const result = await pool.query(query, [project_slug]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching holder distribution:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get top holders for a specific project
app.get('/api/wallets/top-holders/:project_slug', async (req, res) => {
  try {
    const { project_slug } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const query = `
      SELECT
        address,
        COUNT(*) as holding_count
      FROM wallets_ord
      WHERE is_current = TRUE
      AND project_slug = $1
      GROUP BY address
      ORDER BY holding_count DESC
      LIMIT $2;
    `;

    const result = await pool.query(query, [project_slug, limit]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching top holders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get cross-project holders (wallets holding multiple projects)
app.get('/api/wallets/cross-project-holders', async (req, res) => {
  try {
    const minProjects = parseInt(req.query.min_projects) || 2;
    const query = `
      SELECT
        address,
        array_agg(DISTINCT project_slug) as projects_held,
        COUNT(DISTINCT project_slug) as number_of_projects,
        COUNT(*) as total_inscriptions
      FROM wallets_ord
      WHERE is_current = TRUE
      GROUP BY address
      HAVING COUNT(DISTINCT project_slug) >= $1
      ORDER BY COUNT(DISTINCT project_slug) DESC, COUNT(*) DESC
      LIMIT 100;
    `;

    const result = await pool.query(query, [minProjects]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching cross-project holders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/wallet-metrics', async (req, res) => {
  try {
    const query = `
      WITH wallet_metrics AS (
        -- Get wallets that hold multiple projects
        SELECT
          address,
          COUNT(DISTINCT project_slug) as project_count,
          array_agg(DISTINCT project_slug) as projects_held,
          COUNT(*) as total_inscriptions
        FROM wallets_ord
        WHERE is_current = TRUE
        GROUP BY address
        HAVING COUNT(DISTINCT project_slug) > 2  -- Holds at least 3 different projects
      ),
      trading_activity as (
        -- Get active trading patterns
        SELECT
          address,
          COUNT(DISTINCT inscription_id) as unique_trades,
          COUNT(DISTINCT date_trunc('day', transferred_at)) as trading_days
        FROM wallets_ord
        WHERE transferred_at >= NOW() - INTERVAL '30 days'
        GROUP BY address
      )
      SELECT
        wm.address,
        wm.project_count,
        wm.projects_held,
        wm.total_inscriptions,
        COALESCE(ta.unique_trades, 0) as monthly_trades,
        COALESCE(ta.trading_days, 0) as active_trading_days
      FROM wallet_metrics wm
      LEFT JOIN trading_activity ta ON wm.address = ta.address
      WHERE
        -- Has significant holdings
        wm.total_inscriptions > 10
        -- Active trading behavior
        AND (ta.unique_trades > 5 OR wm.total_inscriptions > 20)
      ORDER BY
        wm.project_count DESC,
        wm.total_inscriptions DESC,
        COALESCE(ta.unique_trades, 0) DESC
      LIMIT 100;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching wallet metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/project-rankings', async (req, res) => {
  const { project = null, limit = 100 } = req.query;

  try {
    const query = `
      WITH base_wallets AS (
        -- First get 100 wallets per project
        SELECT
          project_slug,
          address,
          COUNT(*) as holding_count,
          SUM(COUNT(*)) OVER (PARTITION BY project_slug) as total_project_supply,
          COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY project_slug) as holding_percentage,
          ROW_NUMBER() OVER (PARTITION BY project_slug ORDER BY project_slug, address) as row_num
        FROM wallets_ord
        WHERE is_current = TRUE
        ${project ? "AND project_slug = $1" : ""}
        ${project ? "" : "AND project_slug IN ('bitcoin-puppets', 'nodemonkes', 'basedangels', 'quantum_cats')"}
        GROUP BY project_slug, address
      ),
      ranked_wallets AS (
        -- Then rank just those 100 wallets based on their holdings
        SELECT
          project_slug,
          address,
          holding_count,
          total_project_supply,
          holding_percentage,
          DENSE_RANK() OVER (PARTITION BY project_slug ORDER BY holding_count DESC) as rank
        FROM base_wallets
        WHERE row_num <= ${limit}
      )
      SELECT
        project_slug,
        address,
        holding_count,
        total_project_supply,
        ROUND(holding_percentage, 2) as holding_percentage,
        rank
      FROM ranked_wallets
      ORDER BY project_slug, rank;
    `;

    // Adjust params based on whether a specific project is requested
    const params = project ? [project] : [];
    const { rows } = await pool.query(query, params);

    // Group by project if no specific project was requested
    const response = project
      ? rows
      : rows.reduce((acc, row) => {
          if (!acc[row.project_slug]) {
            acc[row.project_slug] = [];
          }
          acc[row.project_slug].push(row);
          return acc;
        }, {});

    res.json(response);
  } catch (error) {
    console.error('Error fetching project rankings:', error);
    res.status(500).json({ error: 'Failed to fetch project rankings' });
  }
});

// Endpoint to fetch transfer counts for the past 4 hours by intervals
app.get('/api/transfer-intervals', async (req, res) => {
  try {
    const query = `
      WITH intervals AS (
          SELECT '10m' AS time_interval, NOW() - INTERVAL '10 minutes' AS start_time
          UNION ALL
          SELECT '30m', NOW() - INTERVAL '30 minutes'
          UNION ALL
          SELECT '1hr', NOW() - INTERVAL '1 hour'
          UNION ALL
          SELECT '4hr', NOW() - INTERVAL '4 hours'
      ),
      projects AS (
          SELECT DISTINCT project_slug
          FROM wallets_ord
          WHERE project_slug IS NOT NULL
          AND project_slug != ''
      )
      SELECT i.time_interval,
             p.project_slug,
             COALESCE(COUNT(DISTINCT CASE
                 WHEN w.project_slug = p.project_slug THEN w.transferred_at
             END), 0) AS transfer_count
      FROM intervals i
      CROSS JOIN projects p
      LEFT JOIN wallets_ord w
          ON w.transferred_at > i.start_time
          AND w.project_slug = p.project_slug
      GROUP BY i.time_interval, p.project_slug
      ORDER BY
          CASE
              WHEN i.time_interval = '10m' THEN 1
              WHEN i.time_interval = '30m' THEN 2
              WHEN i.time_interval = '1hr' THEN 3
              WHEN i.time_interval = '4hr' THEN 4
          END,
          p.project_slug;
    `;

    const result = await pool.query(query);
    res.json(result.rows); // Send the query result as a JSON response
  } catch (error) {
    console.error('Error fetching transfer intervals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

console.log('Available routes:');
app._router.stack.forEach(r => {
  if (r.route && r.route.path) {
    console.log(`${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
  }
});

export { decodeRuneData, parseMessage, extractFields, bigIntReplacer };

// Start server
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Log all registered routes
  console.log('Registered routes:');
  app._router.stack.forEach(function(r){
    if (r.route && r.route.path){
      console.log(r.route.path)
    }
  });
});

// Database connection test and initialization remain the same
async function testDatabaseConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Connected to the database at:', res.rows[0].now);
  } catch (err) {
    console.error('Error connecting to the database:', err);
  }
}

// Initialize
(async function init() {
  await testDatabaseConnection();
  setInterval(updateBlockchainDataWithEmit, 60000);
})();

// Error handling for unexpected database errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});