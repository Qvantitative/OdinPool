// app/api/proxy/route.js
import { NextResponse } from 'next/server';

const ALLOWED_DOMAINS = [
  'api-mainnet.magiceden.dev',
  'api.magiceden.io'
];

export async function GET(request) {
  try {
    // Get the full URL of the request
    const fullUrl = new URL(request.url);
    console.log('Full request URL:', fullUrl.toString()); // Debug log

    const targetUrl = fullUrl.searchParams.get('url');
    console.log('Target URL:', targetUrl); // Debug log

    if (!targetUrl) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }

    const urlObj = new URL(targetUrl);
    if (!ALLOWED_DOMAINS.includes(urlObj.hostname)) {
      return NextResponse.json(
        { error: `Domain ${urlObj.hostname} not allowed` },
        { status: 403 }
      );
    }

    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Upstream request failed with status ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });

  } catch (error) {
    console.error('Proxy error:', error); // Debug log
    return NextResponse.json(
      { error: `Proxy request failed: ${error.message}` },
      { status: 500 }
    );
  }
}