// app/api/ord-info/route.js

import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

export default async function handler(req, res) {
  const result = await pool.query('SELECT * FROM ordinals');
  res.status(200).json(result.rows);
}
