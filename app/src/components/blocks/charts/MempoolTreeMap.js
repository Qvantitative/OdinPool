// app/components/blocks/charts/MempoolTreeMap.js

import React, { useMemo } from 'react';
import { TreeMap, ResponsiveContainer } from 'recharts';

const MempoolTreeMap = ({ transactionData }) => {
  const mempoolData = useMemo(() => {
    if (!transactionData) return [];

    const unconfirmedTxs = transactionData.filter(tx =>
      tx.mempool_time && !tx.confirmation_duration
    );

    return [{
      name: 'Mempool',
      children: unconfirmedTxs.map(tx => ({
        name: tx.txid.substring(0, 8) + '...',
        size: parseFloat(tx.total_input_value) || 0,
        fullTxid: tx.txid,
        mempoolTime: tx.mempool_time,
        fee: tx.fee,
        value: tx.total_input_value
      }))
    }];
  }, [transactionData]);

  const CustomContent = ({ root, depth, x, y, width, height, name, fullTxid, mempoolTime, fee, value }) => {
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
            {`${(parseFloat(fee) * 100000000).toFixed(0)} sats/vB`}
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