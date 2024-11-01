// app/components/BitcoinBlockTable.js

import React, { useEffect, useState } from 'react';

const BitcoinBlockTable = () => {
  const [blocks, setBlocks] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBlockData = async () => {
      try {
        const response = await fetch('https://143.198.17.64:3001/api/blocks');
        if (!response.ok) {
          throw new Error('Failed to fetch block data');
        }
        const data = await response.json();
        console.log('Fetched block data:', data);
        if (Array.isArray(data)) {
          setBlocks(data);
        } else {
          console.error('Fetched data is not an array:', data);
          setError('Received invalid data format from the server.');
        }
      } catch (err) {
        console.error('Error fetching block data:', err);
        setError('Failed to fetch block data from the server.');
      }
    };

    fetchBlockData();
  }, []);

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  if (!Array.isArray(blocks) || blocks.length === 0) {
    return <p>Loading blocks or no block data available...</p>;
  }

  return (
    <div className="flex flex-col h-96 bg-gray-800 text-white">
      <div className="bg-gray-700">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-1/3" />
            <col className="w-1/3" />
            <col className="w-1/3" />
          </colgroup>
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">Block Height</th>
              <th className="px-4 py-2 text-left">Transactions</th>
              <th className="px-4 py-2 text-left">Timestamp</th>
            </tr>
          </thead>
        </table>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-1/3" />
            <col className="w-1/3" />
            <col className="w-1/3" />
          </colgroup>
          <tbody>
            {blocks.map((block) => (
              <tr key={block.block_height} className="border-b border-gray-700">
                <td className="px-4 py-2 truncate">{block.block_height}</td>
                <td className="px-4 py-2 truncate">{block.transactions}</td>
                <td className="px-4 py-2 truncate">{new Date(block.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BitcoinBlockTable;