// app/components/blocks/TopAddresses.js

import React, { useState, useEffect } from 'react';

const TopAddresses = () => {
  const [addresses, setAddresses] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTopAddresses = async () => {
      try {
        const response = await fetch('http://143.198.17.64:3001/api/top-addresses');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setAddresses(data);
      } catch (error) {
        console.error('Error fetching top addresses:', error);
        setError(`Failed to fetch top addresses: ${error.message}`);
      }
    };

    fetchTopAddresses();
  }, []);

  if (error) return <div className="text-red-500">{error}</div>;
  if (addresses.length === 0) return <div className="text-white">Loading...</div>;

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow text-white">
      <h2 className="text-lg font-bold mb-4 text-center">Top Addresses by Balance</h2>
      <table className="min-w-full divide-y divide-gray-700">
        <thead>
          <tr>
            <th className="px-4 py-2">Rank</th>
            <th className="px-4 py-2">Address</th>
            <th className="px-4 py-2">Balance (BTC)</th>
          </tr>
        </thead>
        <tbody>
          {addresses.map((addr, index) => (
            <tr key={addr.address} className="border-b border-gray-800">
              <td className="px-4 py-2">{index + 1}</td>
              <td className="px-4 py-2 break-all">{addr.address}</td>
              <td className="px-4 py-2">{parseFloat(addr.balance).toFixed(8)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TopAddresses;
