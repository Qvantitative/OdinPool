// trending.js

import pg from 'pg';
import axios from 'axios';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20, // Increased pool connections
});


// Magic Eden trending data
async function fetchAndStoreTrendingData(retries = 3) {
  try {
    // Fetch data from Magic Eden API
    const { data } = await axios.get('https://api-mainnet.magiceden.dev/collection_stats/search/bitcoin');
    if (!Array.isArray(data)) throw new Error('Unexpected API response format');

    // Process the fetched data
    const trendingData = data.map(collection => ({
      collection_name: collection.name || 'Unknown Collection',
      floor_price: collection.fp ?? 0,
      volume: collection.vol ?? 0,
      market_cap: collection.marketCapUsd ?? 0,
      owner_count: collection.ownerCount ?? 0,
      listed_count: collection.listedCount ?? 0,
    }));

    // Log the processed data for debugging purposes
    console.log('Processed trending data:', trendingData);

    // Insert each collection data into the database, with additional error handling for each insert
    for (const collection of trendingData) {
      try {
        await pool.query(
          `INSERT INTO trending_info
          (collection_name, floor_price, volume, market_cap, owner_count, listed_count, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [
            collection.collection_name,
            collection.floor_price,
            collection.volume,
            collection.market_cap,
            collection.owner_count,
            collection.listed_count
          ]
        );
        console.log(`Data for collection "${collection.collection_name}" inserted successfully.`);
      } catch (insertError) {
        console.error(`Error inserting data for collection "${collection.collection_name}":`, insertError);
      }
    }

    console.log('All trending data processed and attempted to be saved to the database.');
  } catch (error) {
    console.error('Error fetching and storing trending data:', error);
    if (retries > 0) {
      console.log(`Retrying... attempts left: ${retries}`);
      setTimeout(() => fetchAndStoreTrendingData(retries - 1), 5000);
    } else {
      console.error('Max retries reached. Failed to fetch data.');
    }
  }
}

export {
  fetchAndStoreTrendingData
};