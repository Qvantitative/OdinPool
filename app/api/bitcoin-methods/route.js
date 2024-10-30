// app/api/bitcoin-methods/route.js

import BitcoinCore from 'bitcoin-core';

export async function GET(req) {
  try {
    const client = new BitcoinCore({
      network: 'mainnet', // or 'testnet'
      username: process.env.BITCOIN_RPC_USER,
      password: process.env.BITCOIN_RPC_PASSWORD,
      host: '127.0.0.1',
      port: 8332,
    });

    // Get the list of methods available on the client object
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(client));

    console.log('Bitcoin Core client methods:', methodNames);

    // Send the methods to the client-side
    return new Response(JSON.stringify({ methods: methodNames }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching Bitcoin Core methods:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch methods' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
