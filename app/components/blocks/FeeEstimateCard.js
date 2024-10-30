"use client";

import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const FeeEstimateCard = () => {
  const [feeData, setFeeData] = useState({ average: null, min: null, max: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const socket = io('http://localhost:3001');

    const getFeeEstimates = async () => {
      try {
        const response = await fetch('/api/fee-estimate');
        if (!response.ok) {
          throw new Error('Failed to fetch fee estimates');
        }
        const data = await response.json();
        updateFeeData(data);
      } catch (err) {
        console.error('Error fetching fee estimates:', err);
        setError('Failed to load fee estimates. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    getFeeEstimates();

    socket.on('fee-update', (data) => {
      updateFeeData(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const updateFeeData = (data) => {
    setFeeData({
      average: Math.round(data.feeEstimate),
      min: data.feeSpan.min,
      max: data.feeSpan.max
    });
  };

  if (loading) {
    return <div className="text-white">Loading fee estimates...</div>;
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div className="bg-gray-800 shadow-lg rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-4">Current Fee Estimates</h2>
      {feeData.average !== null && feeData.min !== null && feeData.max !== null && (
        <table className="w-full text-white">
          <thead>
            <tr>
              <th className="w-1/2 text-center py-2 border-b border-gray-600">Average Fee</th>
              <th className="w-1/2 text-center py-2 border-b border-gray-600">Fee Range</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-center py-4">{feeData.average} sat/vB</td>
              <td className="text-center py-4">{feeData.min.toFixed(2)} - {feeData.max.toFixed(2)} sat/vB</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
};

export default FeeEstimateCard;