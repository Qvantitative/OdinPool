// app/api/proxy/route.js
import { NextResponse } from 'next/server';

const ALLOWED_DOMAINS = [
  'api-mainnet.magiceden.dev',
  'api.magiceden.io'
];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    // Add debug logging
    console.log('Incoming request URL:', request.url);
    console.log('Target URL:', targetUrl);

    if (!targetUrl) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }

    // Validate URL domain
    const urlObj = new URL(targetUrl);
    console.log('URL hostname:', urlObj.hostname); // Debug logging

    if (!ALLOWED_DOMAINS.includes(urlObj.hostname)) {
      return NextResponse.json(
        { error: `Domain ${urlObj.hostname} not allowed` },
        { status: 403 }
      );
    }

    // Add debug logging for fetch request
    console.log('Fetching from:', targetUrl);

    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Proxy request failed with status ${response.status}`);
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
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: `Proxy request failed: ${error.message}` },
      { status: 500 }
    );
  }
}