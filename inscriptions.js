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
  const urlBase = "https://api.bestinslot.xyz/v3/collection/inscriptions?slug=aeonsbtc&sort_by=inscr_num&order=asc";
  const headers = {
    "x-api-key": process.env.BESTIN_SLOT_API_KEY,
    "Content-Type": "application/json",
  };
  const inscriptions = [];
  const batchSize = 100;
  const totalInscriptions = 3333;
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
        const response = await axios.get(`${ORD_SERVER_URL}/inscription/${inscription.inscription_id}`, {
          headers: { Accept: 'application/json' },
          timeout: 5000
        });

        return {
          inscription_id: inscription.inscription_id,
          project_slug: inscription.project_slug,
          address: response.data?.address || null
        };
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching address for ${inscription.inscription_id}:`, error.message);
        return {
          inscription_id: inscription.inscription_id,
          project_slug: inscription.project_slug,
          address: null
        };
      }
    })
  );

  return Promise.all(addressPromises);
}

// Main batch processing
async function updateWalletTrackingBatch(client, inscriptions) {
  if (!inscriptions.length) return;

  try {
    await client.query('BEGIN');

    const inscriptionsWithAddresses = await batchGetInscriptionAddresses(inscriptions);
    const validInscriptions = inscriptionsWithAddresses.filter(i => i.address);

    if (!validInscriptions.length) {
      await client.query('ROLLBACK');
      return;
    }

    const { rows: existingRecords } = await client.query(`
      SELECT inscription_id, address, project_slug
      FROM wallets_ord
      WHERE inscription_id = ANY($1::text[]) AND is_current = TRUE
    `, [validInscriptions.map(i => i.inscription_id)]);

    const existingMap = new Map(existingRecords.map(r => [r.inscription_id, { address: r.address, project_slug: r.project_slug }]));

    const inserts = [];
    const updates = [];

    validInscriptions.forEach(insc => {
      const existing = existingMap.get(insc.inscription_id);

      if (!existing) {
        inserts.push([insc.inscription_id, insc.address, insc.project_slug]);
      } else if (existing.address !== insc.address) {
        updates.push([insc.inscription_id, insc.address, existing.address, insc.project_slug]);
      }
    });

    if (inserts.length) {
      const insertValues = inserts.map((_, index) =>
        `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3}, TRUE)`
      ).join(', ');

      await client.query(`
        INSERT INTO wallets_ord (inscription_id, address, project_slug, is_current)
        VALUES ${insertValues}
      `, inserts.flat());
    }

    if (updates.length) {
      await client.query(`
        UPDATE wallets_ord
        SET is_current = FALSE
        WHERE inscription_id = ANY($1::text[]) AND is_current = TRUE
      `, [updates.map(u => u[0])]);

      const updateValues = updates.map((_, index) =>
        `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4}, TRUE)`
      ).join(', ');

      await client.query(`
        INSERT INTO wallets_ord (inscription_id, address, transferred_from, project_slug, is_current)
        VALUES ${updateValues}
      `, updates.flat());
    }

    await client.query(`
      UPDATE wallets_ord w
      SET project_slug = i.project_slug
      FROM inscriptions i
      WHERE w.inscription_id = i.inscription_id
      AND w.project_slug = 'unknown'
      AND w.is_current = TRUE
    `);

    await client.query('COMMIT');
    console.log(`[${new Date().toISOString()}] Processed batch: ${inserts.length} inserts, ${updates.length} updates`);

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
  const PROJECT_SLUG = 'ALL_INSCRIPTIONS';
  const TOTAL_INSCRIPTIONS = 42997;

  try {
    console.log(`[${new Date().toISOString()}] Starting optimized wallet tracking update`);
    await client.query('SET statement_timeout = 0');
    await ensureCheckpointTable(client);

    // Get current checkpoint
    const { processedCount: startCount } = await loadCheckpoint(client, PROJECT_SLUG);

    // Reset to 0 if we've completed a full cycle
    let processedCount = startCount >= TOTAL_INSCRIPTIONS ? 0 : startCount;

    if (startCount >= TOTAL_INSCRIPTIONS) {
      console.log(`[${new Date().toISOString()}] Completed full cycle, resetting to 0`);
      await saveCheckpoint(client, PROJECT_SLUG, 0, TOTAL_INSCRIPTIONS);
    } else {
      console.log(`[${new Date().toISOString()}] Resuming from checkpoint: ${processedCount} inscriptions processed`);
    }

    const BATCH_SIZE = 500;

    while (true) {
      const { rows: inscriptions } = await client.query(`
        SELECT inscription_id, project_slug
        FROM inscriptions
        ORDER BY id
        OFFSET $1 LIMIT $2
      `, [processedCount, BATCH_SIZE]);

      if (inscriptions.length === 0) break;

      await updateWalletTrackingBatch(client, inscriptions);
      processedCount += inscriptions.length;

      // Only save checkpoint if we haven't completed the full cycle
      if (processedCount < TOTAL_INSCRIPTIONS) {
        await saveCheckpoint(client, PROJECT_SLUG, processedCount, TOTAL_INSCRIPTIONS);
        console.log(`[${new Date().toISOString()}] Progress: ${processedCount}/${TOTAL_INSCRIPTIONS} inscriptions processed`);
      } else {
        console.log(`[${new Date().toISOString()}] Completed full cycle of ${TOTAL_INSCRIPTIONS} inscriptions`);
        await saveCheckpoint(client, PROJECT_SLUG, 0, TOTAL_INSCRIPTIONS);
        break; // Exit the loop after completing the full cycle
      }
    }

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