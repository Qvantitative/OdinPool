// app/api/raw-transaction/route.js

import { updateRawTransactionData } from '../../../updateRawTransaction.mjs';

export async function GET(req) {
  try {
    const result = await updateRawTransactionData();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },ok
    });
  } catch (error) {
    console.error('Error fetching raw transaction data:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch raw transaction data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
