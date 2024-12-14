// inscriptions.js

import pg from 'pg';
import axios from 'axios';
import pLimit from 'p-limit';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
});

const ORD_SERVER_URL = 'http://68.9.235.71:3000';
const limit = pLimit(10);

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Checkpoint management
async function ensureCheckpointTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS wallet_tracking_checkpoints (
      project_slug VARCHAR(255) PRIMARY KEY,
      last_processed_count INTEGER,
      total_inscriptions INTEGER,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function saveCheckpoint(client, projectSlug, processedCount, totalInscriptions) {
  await client.query(`
    INSERT INTO wallet_tracking_checkpoints (project_slug, last_processed_count, total_inscriptions)
    VALUES ($1, $2, $3)
    ON CONFLICT (project_slug)
    DO UPDATE SET
      last_processed_count = $2,
      total_inscriptions = $3,
      updated_at = CURRENT_TIMESTAMP
  `, [projectSlug, processedCount, totalInscriptions]);
}

async function loadCheckpoint(client, projectSlug) {
  const result = await client.query(`
    SELECT last_processed_count, total_inscriptions
    FROM wallet_tracking_checkpoints
    WHERE project_slug = $1
  `, [projectSlug]);
  return {
    processedCount: result.rows[0]?.last_processed_count || 0,
    totalInscriptions: result.rows[0]?.total_inscriptions || 0
  };
}

// Fetch inscriptions from API
async function fetchInscriptionsFromAPI() {
  const urlBase = "https://api.bestinslot.xyz/v3/collection/inscriptions?slug=fukuhedrons&sort_by=inscr_num&order=asc";
  const headers = {
    "x-api-key": process.env.BESTIN_SLOT_API_KEY,
    "Content-Type": "application/json",
  };
  const inscriptions = [];
  const batchSize = 100;
  const totalInscriptions = 10000;
  const delayBetweenRequests = 8000;

  try {
    for (let offset = 0; offset < totalInscriptions; offset += batchSize) {
      const url = `${urlBase}&offset=${offset}&count=${batchSize}`;
      const response = await axios.get(url, { headers });

      if (Array.isArray(response.data.data)) {
        const inscriptionIds = response.data.data.map(inscription => inscription.inscription_id);
        inscriptions.push(...inscriptionIds);
        console.log(`[${new Date().toISOString()}] Fetched ${inscriptions.length} inscriptions so far`);
      } else {
        console.warn(`[${new Date().toISOString()}] Unexpected response format at offset ${offset}, skipping batch.`);
      }

      await delay(delayBetweenRequests);
    }
    return inscriptions;
  } catch (error) {
    console.error('[${new Date().toISOString()}] Error fetching inscription data:', error);
    return [];
  }
}

// Batch address fetching
async function batchGetInscriptionAddresses(inscriptions) {
  console.log(`[${new Date().toISOString()}] Fetching addresses for ${inscriptions.length} inscriptions`);

  const addressPromises = inscriptions.map(inscription =>
    limit(async () => {
      try {
        // Handle both possible inscription object structures
        const inscriptionId = typeof inscription === 'object' ? inscription.inscription_id : inscription;

        const response = await axios.get(`${ORD_SERVER_URL}/inscription/${inscriptionId}`, {
          headers: { Accept: 'application/json' },
          timeout: 5000
        });

        // Log successful response
        console.log(`[${new Date().toISOString()}] Successfully fetched address for ${inscriptionId}`);

        return {
          inscription_id: inscriptionId,
          project_slug: typeof inscription === 'object' ? inscription.project_slug : null,
          address: response.data?.address || null
        };
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching address for ${inscription.inscription_id}:`, error.message);
        if (error.response) {
          console.error('Response status:', error.response.status);
        }
        return {
          inscription_id: typeof inscription === 'object' ? inscription.inscription_id : inscription,
          project_slug: typeof inscription === 'object' ? inscription.project_slug : null,
          address: null
        };
      }
    })
  );

  try {
    const results = await Promise.all(addressPromises);
    const validResults = results.filter(i => i.address);
    console.log(`[${new Date().toISOString()}] Retrieved ${validResults.length} valid addresses out of ${results.length} total inscriptions`);
    return results;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in batch address fetching:`, error);
    return [];
  }
}

// Main batch processing
async function updateWalletTrackingBatch(client, inscriptions) {
  if (!inscriptions.length) {
    console.log(`[${new Date().toISOString()}] Empty batch received, skipping`);
    return;
  }

  try {
    await client.query('BEGIN');

    const inscriptionsWithAddresses = await batchGetInscriptionAddresses(inscriptions);
    const validInscriptions = inscriptionsWithAddresses.filter(i => i.address);

    console.log(`[${new Date().toISOString()}] Processing batch: ${validInscriptions.length} valid inscriptions out of ${inscriptions.length} total`);

    if (!validInscriptions.length) {
      console.log(`[${new Date().toISOString()}] No valid inscriptions with addresses found in batch`);
      await client.query('ROLLBACK');
      return;
    }

    // Modified query to include transferred_at
    const { rows: existingRecords } = await client.query(`
      SELECT inscription_id, address, project_slug, transferred_at
      FROM wallets_ord
      WHERE inscription_id = ANY($1::text[]) AND is_current = TRUE
    `, [validInscriptions.map(i => i.inscription_id)]);

    console.log(`[${new Date().toISOString()}] Found ${existingRecords.length} existing records`);

    const existingMap = new Map(existingRecords.map(r => [r.inscription_id, {
      address: r.address,
      project_slug: r.project_slug,
      transferred_at: r.transferred_at
    }]));

    const inserts = [];
    const updates = [];
    const currentTimestamp = new Date();

    validInscriptions.forEach(insc => {
      const existing = existingMap.get(insc.inscription_id);

      console.log(`[${new Date().toISOString()}] Processing inscription ${insc.inscription_id}:`);
      console.log(`- New address: ${insc.address}`);
      console.log(`- Existing record:`, existing ? JSON.stringify(existing) : 'None');

      if (!existing) {
        console.log(`- Action: Will INSERT (new inscription)`);
        inserts.push([insc.inscription_id, insc.address, insc.project_slug || 'unknown']);
      } else {
        // Check if this is a new transfer (same address but new timestamp)
        const timeDifference = currentTimestamp - new Date(existing.transferred_at);
        const isRecentTransfer = timeDifference > 1000 * 60; // More than 1 minute old

        if (existing.address !== insc.address || isRecentTransfer) {
          console.log(`- Action: Will UPDATE (${existing.address !== insc.address ? 'address changed' : 'new transfer'})`);
          updates.push([insc.inscription_id, insc.address, existing.address, insc.project_slug || existing.project_slug]);
        } else {
          console.log(`- Action: SKIP (no changes and recent transfer)`);
        }
      }
    });

    console.log(`[${new Date().toISOString()}] Prepared ${inserts.length} inserts and ${updates.length} updates`);

    if (inserts.length) {
      const insertValues = inserts.map((_, index) =>
        `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3}, TRUE, CURRENT_TIMESTAMP)`
      ).join(', ');

      await client.query(`
        INSERT INTO wallets_ord (inscription_id, address, project_slug, is_current, transferred_at)
        VALUES ${insertValues}
      `, inserts.flat());
    }

    if (updates.length) {
      // Mark existing records as not current
      await client.query(`
        UPDATE wallets_ord
        SET is_current = FALSE
        WHERE inscription_id = ANY($1::text[]) AND is_current = TRUE
      `, [updates.map(u => u[0])]);

      // Insert new records with current timestamp
      const updateValues = updates.map((_, index) =>
        `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4}, TRUE, CURRENT_TIMESTAMP)`
      ).join(', ');

      await client.query(`
        INSERT INTO wallets_ord (inscription_id, address, transferred_from, project_slug, is_current, transferred_at)
        VALUES ${updateValues}
      `, updates.flat());
    }

    // Update unknown project slugs if needed
    if (inserts.length || updates.length) {
      await client.query(`
        UPDATE wallets_ord w
        SET project_slug = i.project_slug
        FROM inscriptions i
        WHERE w.inscription_id = i.inscription_id
        AND w.project_slug = 'unknown'
        AND w.is_current = TRUE
      `);
    }

    await client.query('COMMIT');
    console.log(`[${new Date().toISOString()}] Successfully processed batch: ${inserts.length} inserts, ${updates.length} updates`);

    return {
      inserts: inserts.length,
      updates: updates.length
    };

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Batch error:`, error);
    await client.query('ROLLBACK');
    throw error;
  }
}

// Project-specific wallet tracking
async function updateProjectWalletTracking(projectSlug) {
  const client = await pool.connect();

  // Check current listener count but don't remove ALL listeners
  if (process.listenerCount('SIGINT') >= 10) {
    console.warn('Too many SIGINT listeners detected');
  }

  const cleanup = async () => {
    try {
      console.log(`[${new Date().toISOString()}] Received SIGINT - completing current operation before shutdown`);
      await client.query('COMMIT');

      // Add a small delay to ensure logs are flushed
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Instead of process.exit, throw an error to handle graceful shutdown
      throw new Error('SIGINT received - graceful shutdown');
    } catch (error) {
      console.error('Error during cleanup:', error);
      process.removeListener('SIGINT', cleanup);
      throw error;
    }
  };

  try {
    process.on('SIGINT', cleanup);

    console.log(`[${new Date().toISOString()}] Starting wallet tracking update for project ${projectSlug}`);
    await client.query('SET statement_timeout = 0');
    await ensureCheckpointTable(client);

    const { rows: inscriptions } = await client.query(
      'SELECT inscription_id, project_slug FROM inscriptions WHERE project_slug = $1 ORDER BY id',
      [projectSlug]
    );

    console.log(`[${new Date().toISOString()}] Found ${inscriptions.length} inscriptions for project ${projectSlug}`);

    if (inscriptions.length === 0) {
      console.log(`[${new Date().toISOString()}] No inscriptions found for project ${projectSlug}`);
      return;
    }

    const { processedCount } = await loadCheckpoint(client, projectSlug);
    console.log(`[${new Date().toISOString()}] Resuming from checkpoint: ${processedCount}/${inscriptions.length} inscriptions processed`);

    const batchSize = 500;
    for (let i = processedCount; i < inscriptions.length; i += batchSize) {
      const batch = inscriptions.slice(i, Math.min(i + batchSize, inscriptions.length));
      console.log(`[${new Date().toISOString()}] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(inscriptions.length/batchSize)}`);
      await updateWalletTrackingBatch(client, batch);

      await saveCheckpoint(client, projectSlug, i + batch.length, inscriptions.length);
      console.log(`[${new Date().toISOString()}] Checkpoint saved at: ${i + batch.length}/${inscriptions.length} inscriptions`);
    }

    const verifyQuery = `
      SELECT COUNT(*)
      FROM wallets_ord
      WHERE project_slug = $1 AND is_current = TRUE
    `;
    const verifyResult = await client.query(verifyQuery, [projectSlug]);
    console.log(`[${new Date().toISOString()}] Project ${projectSlug} now has ${verifyResult.rows[0].count} current wallet trackings`);

    process.removeListener('SIGINT', cleanup);

  } catch (error) {
    if (error.message === 'SIGINT received - graceful shutdown') {
      console.log(`[${new Date().toISOString()}] Gracefully shutting down...`);
    } else {
      console.error(`[${new Date().toISOString()}] Error updating wallet tracking for project ${projectSlug}:`, error);
    }
    process.removeListener('SIGINT', cleanup);
    throw error;
  } finally {
    client.release();
  }
}

// Global wallet tracking
async function updateWalletTracking() {
  const client = await pool.connect();
  const PROJECT_SLUG = 'ALL_INSCRIPTIONS';  // Keep this as ALL_INSCRIPTIONS
  const BATCH_SIZE = 500;
  const MAX_CONCURRENT_BATCHES = 3;

  try {
    console.log(`[${new Date().toISOString()}] Starting optimized wallet tracking update`);
    await client.query('SET statement_timeout = 0');
    await ensureCheckpointTable(client);

    // Get total count of ALL inscriptions
    const { rows: [{ count: initialCount }] } = await client.query(`
      SELECT COUNT(*) as count
      FROM inscriptions
    `);

    let totalInscriptions = initialCount;
    console.log(`[${new Date().toISOString()}] Found ${totalInscriptions} total inscriptions across all projects`);

    // Get current checkpoint
    const { processedCount: startCount } = await loadCheckpoint(client, PROJECT_SLUG);

    // Always start from 0 to ensure we process new inscriptions
    let processedCount = 0;
    await saveCheckpoint(client, PROJECT_SLUG, 0, totalInscriptions);
    console.log(`[${new Date().toISOString()}] Starting new processing cycle from 0/${totalInscriptions} inscriptions`);

    while (processedCount < totalInscriptions) {
      const batchPromises = [];

      // Create multiple batch processes
      for (let i = 0; i < MAX_CONCURRENT_BATCHES && processedCount + (i * BATCH_SIZE) < totalInscriptions; i++) {
        const currentOffset = processedCount + (i * BATCH_SIZE);
        const batchPromise = (async () => {
          const { rows: inscriptions } = await client.query(`
            SELECT inscription_id, project_slug
            FROM inscriptions
            ORDER BY id
            OFFSET $1 LIMIT $2
          `, [currentOffset, BATCH_SIZE]);

          if (inscriptions.length > 0) {
            await updateWalletTrackingBatch(client, inscriptions);
            return inscriptions.length;
          }
          return 0;
        })();

        batchPromises.push(batchPromise);
      }

      // Wait for all batch processes to complete
      const completedBatches = await Promise.all(batchPromises);
      const totalProcessed = completedBatches.reduce((sum, count) => sum + count, 0);
      processedCount += totalProcessed;

      // Get current total (in case new inscriptions were added)
      const { rows: [{ count: currentTotal }] } = await client.query(`
        SELECT COUNT(*) as count FROM inscriptions
      `);

      // Update checkpoint and progress
      await saveCheckpoint(client, PROJECT_SLUG, processedCount, currentTotal);
      console.log(`[${new Date().toISOString()}] Progress: ${processedCount}/${currentTotal} inscriptions processed`);

      if (totalProcessed === 0) break;

      // Update total inscriptions for next iteration
      totalInscriptions = currentTotal;
    }

    console.log(`[${new Date().toISOString()}] Completed processing of all inscriptions`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in main process:`, error);
    throw error;
  } finally {
    client.release();
  }
}

// Insert inscriptions
async function insertInscriptionsToDB(inscriptions, projectSlug) {
  if (!Array.isArray(inscriptions)) {
    console.error('Error: Inscriptions is not an array');
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log(`[${new Date().toISOString()}] Starting transaction for ${projectSlug}`);

    const insertQuery = `
      INSERT INTO inscriptions (inscription_id, project_slug)
      VALUES ($1, $2)
      ON CONFLICT (inscription_id) DO NOTHING;
    `;

    for (const inscription_id of inscriptions) {
      console.log(`[${new Date().toISOString()}] Inserting: ${inscription_id} for ${projectSlug}`);
      await client.query(insertQuery, [inscription_id, projectSlug]);
    }

    await client.query('COMMIT');
    console.log(`[${new Date().toISOString()}] Transaction committed`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[${new Date().toISOString()}] Error inserting inscription data:`, error);
  } finally {
    client.release();
  }
}

// Fix unknown project slugs
async function fixUnknownProjectSlugs() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE wallets_ord w
      SET project_slug = i.project_slug
      FROM inscriptions i
      WHERE w.inscription_id = i.inscription_id
      AND w.project_slug = 'unknown'
    `);

    const { rows: [{ count }] } = await client.query(`
      SELECT COUNT(*) FROM wallets_ord WHERE project_slug = 'unknown'
    `);

    await client.query('COMMIT');
    console.log(`[${new Date().toISOString()}] Fixed ${count} unknown project slugs`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error fixing project slugs:`, error);
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}

export {
  fetchInscriptionsFromAPI,
  insertInscriptionsToDB,
  updateWalletTracking,
  updateProjectWalletTracking,
  fixUnknownProjectSlugs
};