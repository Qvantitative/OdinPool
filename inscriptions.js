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
    console.error(`[${new Date().toISOString()}] Error fetching inscription data:`, error);
    return [];
  }
}

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

async function updateWalletTracking() {
  const client = await pool.connect();
  const PROJECT_SLUG = 'ALL_INSCRIPTIONS';
  const BATCH_SIZE = 500;
  const TOTAL_INSCRIPTIONS = 52997;  // Fixed total count

  try {
    console.log(`[${new Date().toISOString()}] Starting optimized wallet tracking update`);
    await client.query('SET statement_timeout = 0');
    await ensureCheckpointTable(client);

    // Get current checkpoint
    const { processedCount: startCount } = await loadCheckpoint(client, PROJECT_SLUG);

    // Reset to 0 if we've completed a full cycle
    let processedCount = startCount >= TOTAL_INSCRIPTIONS ? 0 : startCount;

    if (startCount >= TOTAL_INSCRIPTIONS) {
      console.log(`[${new Date().toISOString()}] Previous cycle complete, starting new cycle from 0`);
      await saveCheckpoint(client, PROJECT_SLUG, 0, TOTAL_INSCRIPTIONS);
    } else {
      console.log(`[${new Date().toISOString()}] Resuming from checkpoint: ${processedCount}/${TOTAL_INSCRIPTIONS} inscriptions processed`);
    }

    while (processedCount < TOTAL_INSCRIPTIONS) {
      const { rows: inscriptions } = await client.query(`
        SELECT inscription_id, project_slug
        FROM inscriptions
        ORDER BY id
        OFFSET $1 LIMIT $2
      `, [processedCount, BATCH_SIZE]);

      if (inscriptions.length === 0) break;

      await updateWalletTrackingBatch(client, inscriptions);
      processedCount += inscriptions.length;

      // Save checkpoint after each batch
      await saveCheckpoint(client, PROJECT_SLUG, processedCount, TOTAL_INSCRIPTIONS);
      console.log(`[${new Date().toISOString()}] Progress: ${processedCount}/${TOTAL_INSCRIPTIONS} inscriptions processed`);
    }

    // If we've completed all inscriptions, reset the checkpoint
    if (processedCount >= TOTAL_INSCRIPTIONS) {
      console.log(`[${new Date().toISOString()}] Completed full cycle, resetting checkpoint to 0`);
      await saveCheckpoint(client, PROJECT_SLUG, 0, TOTAL_INSCRIPTIONS);
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in main process:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function insertInscriptionsToDB(inscriptions, projectSlug) {
  if (!Array.isArray(inscriptions)) {
    console.error('Error: Inscriptions is not an array');
    return {
      insertedCount: 0,
      skippedCount: 0,
      totalCount: 0
    };
  }

  const client = await pool.connect();
  let insertedCount = 0;
  let skippedCount = 0;

  try {
    await client.query('BEGIN');
    console.log(`[${new Date().toISOString()}] Starting transaction for ${projectSlug}`);

    const insertQuery = `
      INSERT INTO inscriptions (inscription_id, project_slug)
      VALUES ($1, $2)
      ON CONFLICT (inscription_id) DO NOTHING
      RETURNING inscription_id;
    `;

    for (const inscription_id of inscriptions) {
      console.log(`[${new Date().toISOString()}] Inserting: ${inscription_id} for ${projectSlug}`);
      const result = await client.query(insertQuery, [inscription_id, projectSlug]);
      if (result.rowCount > 0) {
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    const { rows: [{ count: totalCount }] } = await client.query('SELECT COUNT(*) FROM inscriptions');

    await client.query('COMMIT');
    console.log(`[${new Date().toISOString()}] Transaction committed`);

    return {
      insertedCount,
      skippedCount,
      totalCount
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[${new Date().toISOString()}] Error inserting inscription data:`, error);
    throw error;
  } finally {
    client.release();
  }
}

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
  fixUnknownProjectSlugs
};