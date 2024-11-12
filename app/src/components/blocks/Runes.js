// app/components/blocks/Runes

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import https from 'https';
import { Coins } from 'lucide-react';

const Runes = ({ runes, loading = false }) => {
  const [runeData, setRuneData] = useState([]);
  const [error, setError] = useState(null);

  // Adjusted axios instance with full baseURL and keeping /rune path
  const axiosInstance = axios.create({
    baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '/ord',
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  });

  useEffect(() => {
    const fetchRuneData = async () => {
      try {
        const data = await Promise.all(
          runes.map(async (rune) => {
            const response = await axiosInstance.get(`/rune/${rune}`, {
              headers: {
                Accept: 'application/json'
              },
            });
            const runeInfo = response.data;

            const cap = runeInfo.entry.terms.cap;
            const mints = runeInfo.entry.mints;
            const status = mints < cap ? 'Minting' : 'Ended';
            const mintsRemaining = cap - mints;

            return {
              rune,
              status,
              mintsRemaining
            };
          })
        );
        setRuneData(data);
      } catch (err) {
        console.error('Error fetching rune data:', err);
        setError(err.message);
      }
    };

    if (runes && runes.length > 0) {
      fetchRuneData();
    }
  }, [runes]);

  if (loading) {
    return (
      <div className="mb-8">
        <h3 className="text-2xl font-semibold mb-4 text-center text-blue-400">New Etchings</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <h3 className="text-2xl font-semibold mb-4 text-center text-blue-400">New Etchings</h3>
        <div className="text-red-500 text-center">Error: {error}</div>
      </div>
    );
  }

  if (!runes || runes.length === 0) {
    return (
      <div className="mb-8">
        <h3 className="text-2xl font-semibold mb-4 text-center text-blue-400">New Etchings</h3>
        <div className="flex flex-col items-center justify-center text-center text-gray-500 mt-4">
          <Coins className="w-12 h-12 text-gray-400" />
          <p className="mt-2 text-lg">No new etchings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="text-2xl font-semibold mb-4 text-center text-blue-400">New Etchings</h3>
      <table className="min-w-full bg-[#1a1c2e] rounded-lg shadow-lg overflow-hidden">
        <thead>
          <tr className="bg-blue-600 text-white">
            <th className="py-3 px-6 text-lg font-medium">Rune</th>
            <th className="py-3 px-6 text-lg font-medium">Status</th>
            <th className="py-3 px-6 text-lg font-medium">Mints Remaining</th>
          </tr>
        </thead>
        <tbody>
          {runeData.map((data, index) => (
            <tr key={index} className="text-gray-300 hover:bg-blue-700 transition-colors duration-200">
              <td className="py-4 px-6 border-b border-gray-600 text-center">{data.rune}</td>
              <td className={`py-4 px-6 border-b border-gray-600 text-center font-semibold rounded-full ${
                data.status === 'Minting' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}>
                {data.status}
              </td>
              <td className="py-4 px-6 border-b border-gray-600 text-center font-semibold">{data.mintsRemaining}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Runes;
