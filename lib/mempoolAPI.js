export async function fetchMempoolStats() {
  try {
    const response = await fetch('https://mempool.space/api/mempool');
    if (!response.ok) {
      console.error('Failed to fetch mempool stats:', response.status, response.statusText);
      throw new Error('Network response was not ok');
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    } else {
      const text = await response.text();
      console.error('Unexpected response format for mempool stats:', text);
      throw new Error('Received non-JSON response');
    }
  } catch (error) {
    console.error('Error fetching mempool stats:', error);
    throw error;
  }
}

export async function fetchFeeEstimates() {
  try {
    const response = await fetch('https://mempool.space/api/v1/fees/recommended');
    if (!response.ok) {
      console.error('Failed to fetch fee estimates:', response.status, response.statusText);
      throw new Error('Network response was not ok');
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    } else {
      const text = await response.text();
      console.error('Unexpected response format for fee estimates:', text);
      throw new Error('Received non-JSON response');
    }
  } catch (error) {
    console.error('Error fetching fee estimates:', error);
    throw error;
  }
}

export async function fetchBlocks() {
  try {
    const response = await fetch('https://mempool.space/api/blocks');
    if (!response.ok) {
      console.error('Failed to fetch blocks:', response.status, response.statusText);
      throw new Error('Network response was not ok');
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    } else {
      const text = await response.text();
      console.error('Unexpected response format for blocks:', text);
      throw new Error('Received non-JSON response');
    }
  } catch (error) {
    console.error('Error fetching blocks:', error);
    throw error;
  }
}

export async function fetchNodeStatistics(pubKey) {
  try {
    const response = await fetch(`https://mempool.space/api/v1/lightning/nodes/${pubKey}/statistics`);
    if (!response.ok) {
      console.error('Failed to fetch node statistics:', response.status, response.statusText);
      throw new Error('Network response was not ok');
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    } else {
      const text = await response.text();
      console.error('Unexpected response format for node statistics:', text);
      throw new Error('Received non-JSON response');
    }

  } catch (error) {
    console.error('Error fetching node statistics:', error);
    throw error;
  }
}
