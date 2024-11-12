// app/components/blocks/Runes

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import https from 'https';
import { Coins } from 'lucide-react';

const Runes = ({ runes, loading = false }) => {
  const [runeData, setRuneData] = useState([]);
  const [error, setError] = useState(null);

  // Adjusted axios instance with full baseURL
  const axiosInstance = axios.create({
    baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '/ord',
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    headers: {
      'Accept': 'application/json',  // Try requesting JSON first
      'X-Requested-With': 'XMLHttpRequest'  // Indicate this is an AJAX request
    }
  });

  useEffect(() => {
    const fetchRuneData = async () => {
      try {
        const data = await Promise.all(
          runes.map(async (rune) => {
            console.log(`Fetching data for rune: ${rune}`);
            try {
              // First attempt to get JSON data
              const response = await axiosInstance.get(`/rune/${rune}.json`);
              return {
                rune,
                status: response.data.status || 'Unknown',
                mintsRemaining: response.data.mints_remaining || 'Unknown'
              };
            } catch (jsonError) {
              console.log('JSON fetch failed, falling back to HTML:', jsonError);

              // Fallback to HTML if JSON fails
              const htmlResponse = await axiosInstance.get(`/rune/${rune}`, {
                headers: { 'Accept': 'text/html' }
              });

              // Create a temporary element to parse the HTML
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = htmlResponse.data;

              // Try to find status and mints remaining in the HTML
              // You might need to adjust these selectors based on the actual HTML structure
              const statusText = tempDiv.querySelector('[data-status]')?.getAttribute('data-status') ||
                               tempDiv.querySelector('.status')?.textContent ||
                               'Unknown';

              const mintsText = tempDiv.querySelector('[data-mints-remaining]')?.getAttribute('data-mints-remaining') ||
                               tempDiv.querySelector('.mints-remaining')?.textContent ||
                               'Unknown';

              return {
                rune,
                status: statusText.trim(),
                mintsRemaining: mintsText.trim()
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

  // Rest of the component remains the same
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
              <td className="border px-4 py-2">{data.status}</td>
              <td className="border px-4 py-2">{data.mintsRemaining}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Runes;