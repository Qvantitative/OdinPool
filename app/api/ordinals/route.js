import BitcoinCore from 'bitcoin-core';

export async function POST(req) {
  try {
    const { txid } = await req.json();  // Parse the transaction ID from the request body

    if (!txid) {
      return new Response(JSON.stringify({ error: 'Transaction ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Initialize Bitcoin Core client
    const client = new BitcoinCore({
      network: 'mainnet',  // or 'testnet'
      username: process.env.BITCOIN_RPC_USER,
      password: process.env.BITCOIN_RPC_PASSWORD,
      host: '84.21.168.130',
      port: 8332,
    });

    // Fetch raw transaction data using the transaction ID
    const rawTransaction = await client.command('getrawtransaction', txid, true);  // true for decoded JSON

    // Check the transaction outputs for ordinal inscriptions
    let inscription = null;
    rawTransaction.vout.forEach((output) => {
      if (output.scriptPubKey && output.scriptPubKey.asm.includes('OP_RETURN')) {
        inscription = output;
      }
    });

    if (!inscription) {
      return new Response(JSON.stringify({ error: 'No ordinal inscription found in the transaction' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return the ordinal inscription details
    return new Response(JSON.stringify({ inscription }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching transaction or ordinals info:', error.message || error);
    return new Response(JSON.stringify({ error: 'Failed to fetch transaction info or ordinals' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
