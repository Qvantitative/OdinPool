// app/components/blocks/charts/MempoolTreeMap.js

import React, { useMemo, useState, useEffect } from 'react';
import { TreeMap, ResponsiveContainer } from 'recharts';

const MempoolTreeMap = () => {
  const [transactionData, setTransactionData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/mempool');
        if (!response.ok) {
          throw new Error('Failed to fetch mempool transactions');
        }
        const data = await response.json();
        setTransactionData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
    // Poll for new transactions every 30 seconds
    const interval = setInterval(fetchTransactions, 30000);
    return () => clearInterval(interval);
  }, []);

  const mempoolData = useMemo(() => {
    if (!transactionData.length) return [];

    const processedTxs = transactionData.map(tx => ({
      name: tx.txid.substring(0, 8) + '...',
      size: tx.size || 0,
      fullTxid: tx.txid,
      fee: tx.fee || 0,
      value: tx.total_input_value || 0,
      feeRate: tx.size ? (tx.fee / tx.size) : 0,
      mempoolTime: tx.mempool_time || 0,
      timeInMempool: tx.mempool_time ?
        Math.round((Date.now() - new Date(tx.mempool_time).getTime()) / 1000) : 0
    })).filter(tx => tx.size > 0);

    return [{
      name: 'Mempool',
      children: processedTxs
    }];
  }, [transactionData]);

  const CustomContent = ({ depth, x, y, width, height, name, fullTxid, fee, value, size, mempoolTime, timeInMempool }) => {
    if (depth === 1 && width > 50 && height > 50) {
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill="#4f46e5"
            opacity={0.8}
            stroke="#fff"
            strokeWidth={2}
            className="cursor-pointer hover:opacity-90"
          />
          <text
            x={x + width / 2}
            y={y + height / 2 - 25}
            textAnchor="middle"
            fill="#fff"
            fontSize={12}
            className="pointer-events-none"
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 - 5}
            textAnchor="middle"
            fill="#fff"
            fontSize={10}
            className="pointer-events-none"
          >
            {`${parseFloat(value).toFixed(8)} BTC`}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 15}
            textAnchor="middle"
            fill="#fff"
            fontSize={10}
            className="pointer-events-none"
          >
            {`${parseFloat(fee).toFixed(8)} sat/vB`}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 35}
            textAnchor="middle"
            fill="#fff"
            fontSize={10}
            className="pointer-events-none"
          >
            {`${timeInMempool}s in mempool`}
          </text>
        </g>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-gray-500">Loading mempool transactions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!mempoolData[0]?.children?.length) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-gray-500">No unconfirmed transactions found</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-4">
      <div className="flex flex-col h-full">
        <h2 className="text-xl font-semibold mb-4">Mempool Transactions</h2>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <TreeMap
              data={mempoolData}
              dataKey="size"
              aspectRatio={1}
              content={<CustomContent />}
              className="w-full h-full"
            >
            </TreeMap>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default MempoolTreeMap;