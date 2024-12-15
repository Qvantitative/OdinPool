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

// Ensure the checkpoint table exists
async function ensureCheckpointTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS inscription_checkpoints (
      project_slug VARCHAR(255) PRIMARY KEY,
      processed_count INTEGER,
      total_count INTEGER,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Save the checkpoint to the database
async function saveCheckpoint(client, projectSlug, processedCount, totalCount) {
  await client.query(`
    INSERT INTO inscription_checkpoints (project_slug, processed_count, total_count)
    VALUES ($1, $2, $3)
    ON CONFLICT (project_slug)
    DO UPDATE SET
      processed_count = $2,
      total_count = $3,
      updated_at = CURRENT_TIMESTAMP
  `, [projectSlug, processedCount, totalCount]);
}

// Load the checkpoint from the database
async function loadCheckpoint(client, projectSlug) {
  const result = await client.query(`
    SELECT processed_count, total_count
    FROM inscription_checkpoints
    WHERE project_slug = $1
  `, [projectSlug]);

  if (result.rows[0]) {
    return {
      processedCount: result.rows[0].processed_count,
      totalCount: result.rows[0].total_count
    };
  }

  // Default values if no checkpoint found
  return {
    processedCount: 0,
    totalCount: 52997
  };
}

async function fetchInscriptionsFromAPI(projectSlug = 'fukuhedrons') {
  const client = await pool.connect();
  try {
    await ensureCheckpointTable(client);

    const urlBase = "https://api.bestinslot.xyz/v3/collection/inscriptions?slug=fukuhedrons&sort_by=inscr_num&order=asc";
    const headers = {
      "x-api-key": process.env.BESTIN_SLOT_API_KEY,
      "Content-Type": "application/json",
    };
    const batchSize = 100;
    const totalInscriptions = 10000;
    const delayBetweenRequests = 8000;

    // Check current progress
    let { rows: [{ count: currentCount }] } = await client.query('SELECT COUNT(*) FROM inscriptions WHERE project_slug = $1', [projectSlug]);
    const { processedCount: startingOffset } = await loadCheckpoint(client, projectSlug);

    // Reset offset if we've reached the end but haven't processed everything
    let offset = startingOffset;
    if (startingOffset >= totalInscriptions && currentCount < totalInscriptions) {
      console.log(`[${new Date().toISOString()}] Resetting offset to 0 (current count: ${currentCount}, target: ${totalInscriptions})`);
      offset = 0;
      await saveCheckpoint(client, projectSlug, 0, totalInscriptions);
    }

    console.log(`[${new Date().toISOString()}] Starting fetch from offset ${offset} (current DB count: ${currentCount}/${totalInscriptions})`);

    while (offset < totalInscriptions && currentCount < totalInscriptions) {
      // Check if we received a shutdown signal
      if (global.shouldExit) {
        console.log(`[${new Date().toISOString()}] Shutdown signal received. Saving progress at offset ${offset}.`);
        await saveCheckpoint(client, projectSlug, offset, totalInscriptions);
        break;
      }

      const url = `${urlBase}&offset=${offset}&count=${batchSize}`;
      const response = await axios.get(url, { headers });

      console.log(`[${new Date().toISOString()}] API response at offset ${offset}:`, response.data);

      if (Array.isArray(response.data.data)) {
        const inscriptionIds = response.data.data.map(inscription => inscription.inscription_id);

        if (inscriptionIds.length > 0) {
          // Insert this batch immediately
          console.log(`[${new Date().toISOString()}] Inserting batch of ${inscriptionIds.length} inscriptions at offset ${offset}`);
          await insertInscriptionsToDB(inscriptionIds, projectSlug);

          // Update current count
          const { rows: [{ count: newCount }] } = await client.query('SELECT COUNT(*) FROM inscriptions WHERE project_slug = $1', [projectSlug]);
          currentCount = newCount;

          // Save checkpoint after successful insert
          await saveCheckpoint(client, projectSlug, offset + batchSize, totalInscriptions);

          console.log(`[${new Date().toISOString()}] Progress: ${currentCount}/${totalInscriptions} inscriptions in DB`);
        } else {
          console.log(`[${new Date().toISOString()}] No new inscriptions found at offset ${offset}, resetting to 0`);
          offset = -batchSize; // Will become 0 after the += batchSize below
        }
      } else {
        console.warn(`[${new Date().toISOString()}] Unexpected response format at offset ${offset}, skipping batch.`);
      }

      offset += batchSize;

      // Reset offset if we've reached the end but haven't processed everything
      if (offset >= totalInscriptions && currentCount < totalInscriptions) {
        console.log(`[${new Date().toISOString()}] Reached end but only have ${currentCount}/${totalInscriptions} inscriptions. Resetting offset to 0`);
        offset = 0;
        await saveCheckpoint(client, projectSlug, 0, totalInscriptions);
      }

      // Delay before next batch
      await delay(delayBetweenRequests);
    }

    console.log(`[${new Date().toISOString()}] Fetch complete. Total inscriptions in DB for ${projectSlug}: ${currentCount}`);
    return currentCount;

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error fetching inscription data:`, error);
    return 0;
  } finally {
    client.release();
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
      SELECT inscription_id, address, project_slug, transferred_at
      FROM wallets_ord
      WHERE inscription_id = ANY($1::text[]) AND is_current = TRUE
    `, [validInscriptions.map(i => i.inscription_id)]);

    const existingMap = new Map(existingRecords.map(r => [r.inscription_id, {
      address: r.address,
      project_slug: r.project_slug,
      transferred_at: r.transferred_at
    }]));

    const inserts = [];  // Declare arrays
    const updates = [];

    validInscriptions.forEach(insc => {
      const existing = existingMap.get(insc.inscription_id);
      const currentTime = new Date();

      if (!existing) {
        inserts.push([insc.inscription_id, insc.address, insc.project_slug]);
      } else {
        // If address changed OR if it's a new transfer (even with same address)
        // Using 1 hour as threshold instead of 1 second
        if (existing.address !== insc.address ||
            (currentTime - new Date(existing.transferred_at) > 1000 * 60 * 60)) {
          updates.push([insc.inscription_id, insc.address, existing.address, insc.project_slug]);
        }
      }
    });

    // Also update the insert and update queries to include transferred_at:
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
      await client.query(`
        UPDATE wallets_ord
        SET is_current = FALSE
        WHERE inscription_id = ANY($1::text[]) AND is_current = TRUE
      `, [updates.map(u => u[0])]);

      const updateValues = updates.map((_, index) =>
        `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4}, TRUE, CURRENT_TIMESTAMP)`
      ).join(', ');

      await client.query(`
        INSERT INTO wallets_ord (inscription_id, address, transferred_from, project_slug, is_current, transferred_at)
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
  const TOTAL_INSCRIPTIONS = 52997;

  try {
    console.log(`[${new Date().toISOString()}] Starting optimized wallet tracking update`);
    await client.query('SET statement_timeout = 0');
    await ensureCheckpointTable(client); // Ensure checkpoint table exists

    const { processedCount: startCount } = await loadCheckpoint(client, PROJECT_SLUG);

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

      console.log(`[${new Date().toISOString()}] Query returned ${inscriptions.length} inscriptions at offset ${processedCount}`);

      if (inscriptions.length === 0) {
        console.log(`[${new Date().toISOString()}] No more inscriptions found, but only processed ${processedCount}/${TOTAL_INSCRIPTIONS}`);
        break;
      }

      await updateWalletTrackingBatch(client, inscriptions);
      processedCount += inscriptions.length;

      await saveCheckpoint(client, PROJECT_SLUG, processedCount, TOTAL_INSCRIPTIONS);
      console.log(`[${new Date().toISOString()}] Progress: ${processedCount}/${TOTAL_INSCRIPTIONS} inscriptions processed`);
    }

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