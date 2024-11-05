// app/api/bitcoin-blocks/route.js
import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {
  const rpcUser = process.env.BITCOIN_RPC_USER;
  const rpcPassword = process.env.BITCOIN_RPC_PASSWORD;

  if (!rpcUser || !rpcPassword) {
    return NextResponse.json(
      { error: 'Bitcoin RPC credentials not configured' },
      { status: 500 }
    );
  }

  const rpcUrl = `http://${rpcUser}:${rpcPassword}@68.9.235.71:8332/`;

  try {
    // Optional: Add timeout to axios request
    const response = await axios.post(rpcUrl, {
      jsonrpc: "1.0",
      id: "mempool_data",
      method: "getmempoolinfo",
      params: []
    }, {
      timeout: 5000 // 5 second timeout
    });

    if (!response.data || !response.data.result) {
      throw new Error('Invalid response format from Bitcoin RPC');
    }

    const data = response.data.result;
    const upcomingBlockData = {
      block_height: data.blockHeight + 1,
      fees_estimate: data.feeEstimate,
      feeSpan: data.feeSpan,
      transactions: data.size,
      timestamp: new Date().getTime(),
    };

    return NextResponse.json(upcomingBlockData);
  } catch (error) {
    console.error("Error fetching mempool data:", error);

    // Return more specific error messages based on the error type
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        return NextResponse.json(
          { error: "Could not connect to Bitcoin RPC server" },
          { status: 503 }
        );
      }
      if (error.response?.status === 401) {
        return NextResponse.json(
          { error: "Invalid Bitcoin RPC credentials" },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch mempool data" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}