const client = createClient({
  connectionString: process.env.POSTGRES_URL,
});

export async function query(queryText, params) {
  const { rows } = await client.query(queryText, params);
  return rows;
}

// Function to insert block data
export async function insertBlockData(blockHeight, transactions, timestamp) {
  const queryText = `
    INSERT INTO blocks (block_height, transactions, timestamp)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  const result = await query(queryText, [blockHeight, transactions, timestamp]);
  return result;
}

// Function to get all block data
export async function getAllBlockData() {
  const queryText = `
    SELECT * FROM blocks
    ORDER BY timestamp DESC;
  `;
  const result = await query(queryText);
  return result;
}