// lib/magicEdenAPI.js

const MAGICEDEN_API_URL = 'https://api-mainnet.magiceden.dev/collection_stats/search/bitcoin';

export async function fetchMagicEdenData() {
  try {
    const response = await fetch(MAGICEDEN_API_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch Magic Eden data');
    }
    const data = await response.json();
    return data; // Return the entire data, not just collections
  } catch (error) {
    console.error('Error fetching Magic Eden data:', error);
    throw error;
  }
}

