"use client";

import { useEffect, useState } from 'react';

const FeesEstimate = ({ onFeeSpanUpdate, onAverageFeeUpdate }) => {
  const [fees, setFees] = useState([]);
  const [averageFeeEstimate, setAverageFeeEstimate] = useState(null);
  const [feeSpan, setFeeSpan] = useState({ min: null, max: null });
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch fee estimate data
    const fetchFeeData = async () => {
      try {
        const response = await fetch('/api/fee-estimate');
        if (!response.ok) {
          throw new Error('Failed to fetch fee data');
        }

        const data = await response.json();
        console.log('Fetched Fee Data:', data.transactions);

        setFees(data.transactions);

        // Calculate fee span
        const feeRates = data.transactions.map(tx => parseFloat(tx.feePerByte));
        const minFee = Math.min(...feeRates);
        const maxFee = Math.max(...feeRates);
        const newFeeSpan = { min: minFee, max: maxFee };
        setFeeSpan(newFeeSpan);

        // Pass the fee span and average fee to the parent component
        if (onFeeSpanUpdate) {
          onFeeSpanUpdate(newFeeSpan);
        }

        const roundedAverage = Math.round(data.feeEstimate);
        setAverageFeeEstimate(roundedAverage);

        if (onAverageFeeUpdate) {
          onAverageFeeUpdate(roundedAverage);
        }

        console.log('Rounded Average Fee Estimate:', roundedAverage);
        console.log('Fee Span:', { min: minFee, max: maxFee });
      } catch (err) {
        console.error('Error fetching fee data:', err);
        setError('Failed to fetch fee data.');
      }
    };

    fetchFeeData();
  }, [onFeeSpanUpdate, onAverageFeeUpdate]);

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  if (fees.length === 0) {
    return <p>Loading fee estimates...</p>;
  }

  return (
    <div>
      <p>Fee estimates loaded. Check the console for details.</p>
      {averageFeeEstimate !== null && (
        <p>Rounded Average Fee Estimate: {averageFeeEstimate} sat/vB</p>
      )}
      {feeSpan.min !== null && feeSpan.max !== null && (
        <p>Fee Span: {feeSpan.min.toFixed(2)} - {feeSpan.max.toFixed(2)} sat/vB</p>
      )}
    </div>
  );
};

export default FeesEstimate;
