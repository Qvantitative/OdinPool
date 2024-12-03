// app/components/blocks/charts/MempoolTreeMap.js

import React, { useMemo } from 'react';
import { TreeMap, ResponsiveContainer } from 'recharts';

const MempoolTreeMap = ({ transactionData }) => {
  const mempoolData = useMemo(() => {
    if (!transactionData) return [];

    // Process and filter for unconfirmed transactions
    const unconfirmedTxs = transactionData.map(tx => ({
      txid: tx.txid,
      size: tx.size || 0,
      block_height: tx.block_height,
      total_input_value: tx.total_input_value || 0,
      total_output_value: tx.total_output_value || 0,
      fee: tx.fee || 0,
      value: tx.value || 0,
      confirmation_time: tx.confirmation_time
    })).filter(tx =>
      tx.size > 0 &&
      !tx.confirmation_time // Transaction is unconfirmed if it has no confirmation time
    );

    console.log('Processed mempool transactions:', unconfirmedTxs);

    return [{
      name: 'Mempool',
      children: unconfirmedTxs.map(tx => ({
        name: tx.txid.substring(0, 8) + '...',
        size: tx.size,
        fullTxid: tx.txid,
        fee: tx.fee,
        value: tx.total_input_value,
        height: tx.block_height
      }))
    }];
  }, [transactionData]);

  const CustomContent = ({ root, depth, x, y, width, height, name, fullTxid, fee, value, size }) => {
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
          />
          <text
            x={x + width / 2}
            y={y + height / 2 - 20}
            textAnchor="middle"
            fill="#fff"
            fontSize={12}
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            fill="#fff"
            fontSize={10}
          >
            {`${parseFloat(value).toFixed(8)} BTC`}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 20}
            textAnchor="middle"
            fill="#fff"
            fontSize={10}
          >
            {`${parseFloat(fee).toFixed(8)} sat/vB`}
          </text>
        </g>
      );
    }
    return null;
  };

  if (!mempoolData[0]?.children?.length) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-gray-500">No unconfirmed transactions found</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <h2 className="text-xl font-semibold text-white mb-4">Mempool Transactions</h2>
      <div className="h-[calc(100%-2rem)]">
        <ResponsiveContainer width="100%" height="100%">
          <TreeMap
            data={mempoolData}
            dataKey="size"
            aspectRatio={1}
            content={<CustomContent />}
          >
          </TreeMap>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MempoolTreeMap;