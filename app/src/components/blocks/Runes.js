// app/components/blocks/Runes

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import https from 'https';
import { Coins } from 'lucide-react';

const Runes = ({ runes, loading = false }) => {
  const [runeData, setRuneData] = useState([]);
  const [error, setError] = useState(null);

  const axiosInstance = axios.create({
    baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '/ord',
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  });

  const calculateRuneStatus = (entry) => {
    if (!entry || !entry.terms || !entry.mints) {
      return 'Unknown';
    }
    return entry.mints < entry.terms.cap ? 'Minting' : 'Ended';
  };

  const calculateMintsRemaining = (entry) => {
    if (!entry || !entry.terms || !entry.mints) {
      return 'Unknown';
    }
    return entry.terms.cap - entry.mints;
  };

  useEffect(() => {
    const fetchRuneData = async () => {
      try {
        const data = await Promise.all(
          runes.map(async (rune) => {
            console.log(`Fetching data for rune: ${rune}`);
            const response = await axiosInstance.get(`/rune/${rune}`, {
              headers: {
                Accept: 'application/json'
              },
            });
            console.log(`Response for rune ${rune}:`, response.data);

            const runeInfo = response.data.entry;
            return {
              rune,
              status: calculateRuneStatus(runeInfo),
              mintsRemaining: calculateMintsRemaining(runeInfo)
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
        <h3 className="text-xl font-semibold mb-4">New Etchings</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">New Etchings</h3>
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!runes || runes.length === 0) {
    return (
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">New Etchings</h3>
        <div className="flex flex-col items-center justify-center text-center text-gray-500 mt-4">
          <Coins className="w-12 h-12 text-gray-400" />
          <p className="mt-2">No new etchings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="text-xl font-semibold mb-4">New Etchings</h3>
      <table className="min-w-full bg-white dark:bg-gray-800">
        <thead>
          <tr>
            <th className="py-2 border px-4">Rune</th>
            <th className="py-2 border px-4">Status</th>
            <th className="py-2 border px-4">Mints Remaining</th>
          </tr>
        </thead>
        <tbody>
          {runeData.map((data, index) => (
            <tr key={index}>
              <td className="border px-4 py-2">{data.rune}</td>
              <td className="border px-4 py-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  data.status === 'Minting' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {data.status}
                </span>
              </td>
              <td className="border px-4 py-2">
                {typeof data.mintsRemaining === 'number'
                  ? data.mintsRemaining.toLocaleString()
                  : data.mintsRemaining}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Runes;