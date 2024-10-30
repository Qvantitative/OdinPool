// lib/chainAPI.js

async function fetchTaprootData() {
  const response = await fetch('https://blockstream.info/api/blocks');
  const data = await response.json();

  console.log('API Response:', data); // Log the full API response to ensure it's correct

  // Mapping the data correctly
  return data.map(block => ({
    height: block.height,
    tx_count: block.tx_count,
    timestamp: block.timestamp // Correctly access the timestamp field
  }));
}


async function fetchBlockData(blockHeight) {
  const response = await fetch(`https://blockstream.info/api/block/${blockHeight}`);
  return response.json(); // Fetch and return detailed block data
}

module.exports = {
  fetchTaprootData,
  fetchBlockData
};
