// app/api/raw-mempool/route.js

import BitcoinCore from 'bitcoin-core';

const client = new BitcoinCore({
  network: 'mainnet', // or 'testnet'
  username: process.env.BITCOIN_RPC_USER,
  password: process.env.BITCOIN_RPC_PASSWORD,
  host: '68.9.235.71',
  port: 8332,
});

export async function GET(req) {
  try {
    const rawMempool = await client.getRawMempool(true);
    console.log("rawMempool:", rawMempool)

    const mempoolInfo = Object.entries(rawMempool).map(([txid, info]) => ({
      txid,
      size: info.size,
      fee: info.fee,
      time: info.time,
      height: info.height,
    }));

    return new Response(JSON.stringify({
      mempoolSize: mempoolInfo.length,
      transactions: mempoolInfo,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching raw mempool:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch raw mempool' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}