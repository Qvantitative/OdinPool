// app/api/address-info/route.js

import BitcoinCore from 'bitcoin-core';

export async function POST(req) {
  try {
    const { address } = await req.json();  // Parse the Bitcoin address from the request body

    if (!address) {
      return new Response(JSON.stringify({ error: 'Bitcoin address is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Initialize Bitcoin Core client
    const client = new BitcoinCore({
      network: 'mainnet',  // or 'testnet'
      username: process.env.BITCOIN_RPC_USER,
      password: process.env.BITCOIN_RPC_PASSWORD,
      host: '127.0.0.1',
      port: 8332,
    });

    // Fetch information about the specified Bitcoin address
    console.log(`Fetching info for address: ${address}`);
    const addressInfo = await client.command('getBalance', address);  // Use getAddressInfo

    // Return the address information as a response
    return new Response(JSON.stringify(addressInfo), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching address info:', error.message || error);
    return new Response(JSON.stringify({ error: 'Failed to fetch address info' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
