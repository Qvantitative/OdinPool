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
        console.log(`Fetched ${inscriptions.length} inscriptions so far`);
      } else {
        console.warn(`Unexpected response format at offset ${offset}, skipping batch.`);
      }

      await delay(delayBetweenRequests);
    }
    return inscriptions;
  } catch (error) {
    console.error('Error fetching inscription data:', error);
    return [];
  }
}

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
        console.error(`Error fetching address for ${inscription.inscription_id}:`, error.message);
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

let shouldShutdown = false;
process.on('SIGINT', () => {
  console.log('SIGINT received, will shutdown gracefully after current batch...');
  shouldShutdown = true;
});

async function updateWalletTrackingBatch(client, inscriptions) {
  if (!inscriptions.length) return;

  try {
    await client.query('BEGIN');

    // No SIGINT handling here; rely on shouldShutdown in the main loop.
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

    for (const insc of validInscriptions) {
      const existing = existingMap.get(insc.inscription_id);
      if (!existing) {
        inserts.push([insc.inscription_id, insc.address, insc.project_slug]);
      } else if (existing.address !== insc.address) {
        updates.push([insc.inscription_id, insc.address, existing.address, insc.project_slug]);
      }
    }

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

async function updateProjectWalletTracking(projectSlug) {
  const client = await pool.connect();

  try {
    console.log(`Starting wallet tracking update for ${projectSlug}`);
    await client.query('SET statement_timeout = 0');
    await ensureCheckpointTable(client);

    const { rows: inscriptions } = await client.query(
      'SELECT inscription_id, project_slug FROM inscriptions WHERE project_slug = $1 ORDER BY id',
      [projectSlug]
    );

    const { processedCount } = await loadCheckpoint(client, projectSlug);
    const batchSize = 500;

    for (let i = processedCount; i < inscriptions.length; i += batchSize) {
      const batch = inscriptions.slice(i, Math.min(i + batchSize, inscriptions.length));
      await updateWalletTrackingBatch(client, batch);
      await saveCheckpoint(client, projectSlug, i + batch.length, inscriptions.length);
      console.log(`Checkpoint saved at: ${i + batch.length}/${inscriptions.length}`);

      if (shouldShutdown) {
        console.log('Shutdown requested, ending gracefully...');
        break;
      }
    }

    const verifyResult = await client.query(`
      SELECT COUNT(*) FROM wallets_ord WHERE project_slug = $1 AND is_current = TRUE
    `, [projectSlug]);
    console.log(`Project ${projectSlug} now has ${verifyResult.rows[0].count} current wallet trackings`);
  } catch (error) {
    console.error(`Error updating wallet tracking for ${projectSlug}:`, error);
  } finally {
    client.release();
    console.log('Database connection released. Exiting...');
  }
}

async function updateWalletTracking() {
  const client = await pool.connect();

  try {
    console.log(`[${new Date().toISOString()}] Starting optimized wallet tracking update`);

    const BATCH_SIZE = 500;
    let processedCount = 0;

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

      console.log(`[${new Date().toISOString()}] Progress: ${processedCount}/42997 inscriptions processed`);
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in main process:`, error);
  } finally {
    client.release();
  }
}

async function insertInscriptionsToDB(inscriptions, projectSlug) {
  if (!Array.isArray(inscriptions)) {
    console.error('Error: Inscriptions is not an array');
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('Starting transaction');

    const insertQuery = `
      INSERT INTO inscriptions (inscription_id, project_slug)
      VALUES ($1, $2)
      ON CONFLICT (inscription_id) DO NOTHING;
    `;

    for (const inscription_id of inscriptions) {
      console.log('Inserting:', inscription_id, projectSlug);
      console.log('Executing query:', insertQuery, 'with values:', [inscription_id, projectSlug]);

      await client.query(insertQuery, [inscription_id, projectSlug]);
    }

    await client.query('COMMIT');
    console.log('Transaction committed');
    console.log('Inscriptions inserted successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting inscription data:', error);
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
    console.log(`Fixed ${count} unknown project slugs`);
  } catch (error) {
    console.error('Error fixing project slugs:', error);
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