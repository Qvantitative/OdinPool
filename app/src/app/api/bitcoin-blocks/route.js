// src/app/api/bitcoin-blocks/route.js
import axios from 'axios';

export default async function handler(req, res) {
  const rpcUser = process.env.BITCOIN_RPC_USER;
  const rpcPassword = process.env.BITCOIN_RPC_PASSWORD;
  const rpcUrl = `http://${rpcUser}:${rpcPassword}@68.9.235.71:8332/`;

  try {
    const response = await axios.post(rpcUrl, {
      jsonrpc: "1.0",
      id: "mempool_data",
      method: "getmempoolinfo",
      params: []
    });

    const data = response.data.result;
    const upcomingBlockData = {
      block_height: data.blockHeight + 1,
      fees_estimate: data.feeEstimate,
      feeSpan: data.feeSpan,
      transactions: data.size, // Adjust as needed
      timestamp: new Date().getTime(),
    };

    res.status(200).json(upcomingBlockData);
  } catch (error) {
    console.error("Error fetching mempool data:", error);
    res.status(500).json({ error: "Failed to fetch mempool data" });
  }
}
