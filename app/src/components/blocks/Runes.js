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

            // Null check for entry, entry.terms, and entry.terms.cap
            const cap = runeInfo.entry?.terms?.cap;
            const mints = runeInfo.entry?.mints;

            if (cap != null && mints != null) {
              const status = mints < cap ? 'Minting' : 'Ended';
              const mintsRemaining = cap - mints;
              const progress = ((cap - mintsRemaining) / cap) * 100; // Calculate progress percentage

              // Log the details for each rune
              console.log(`Rune: ${rune}`);
              console.log(`Status: ${status}`);
              console.log(`Mints Remaining: ${mintsRemaining}`);
              console.log(`Progress: ${progress.toFixed(2)}%`);

              return {
                rune,
                status,
                mintsRemaining,
                progress
              };
            } else {
              console.warn(`Rune data missing cap or mints for rune: ${rune}`);
              return {
                rune,
                status: 'Not Mintable',
                mintsRemaining: '-',
                progress: null // No progress for Not Mintable items
              };
            }
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
              <td className="py-4 px-6 border-b border-gray-600 text-center font-semibold rounded-full relative">
                <span className={`${
                  data.status === 'Minting' ? 'radiating-glow' : ''
                } inline-block px-4 py-2 rounded-full ${
                  data.status === 'Minting' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                  {data.status}
                </span>
              </td>
              <td className="py-4 px-6 border-b border-gray-600 text-center">
                {data.progress !== null ? (
                  <>
                    <div className="relative w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="absolute h-full bg-green-500 rounded-full"
                        style={{ width: `${data.progress}%` }}
                      ></div>
                    </div>
                    <p className="mt-1 text-sm text-gray-400">{data.mintsRemaining.toLocaleString()} remaining</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">-</p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <style jsx>{`
        .radiating-glow {
          position: relative;
          animation: pulse 2s infinite ease-in-out;
        }
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          }
          50% {
            box-shadow: 0 0 15px 15px rgba(34, 197, 94, 0.3);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
          }
        }
      `}</style>
    </div>
  );
};

export default Runes;
