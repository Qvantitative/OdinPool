// app/components/blocks/charts/MempoolTreeMap.js

import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TreeMap, ResponsiveContainer } from 'recharts';

const MempoolTreeMap = ({ transactions }) => {
  // Filter and transform transactions for the treemap
  const mempoolData = useMemo(() => {
    if (!transactions) return [];

    // Filter for unconfirmed transactions (have mempool_time but no confirmation_duration)
    const unconfirmedTxs = transactions.filter(tx =>
      tx.mempool_time && !tx.confirmation_duration
    );

    // Transform data for treemap visualization
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
  }, [transactions]);

  // Custom content renderer for treemap boxes
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
      <Card className="w-full h-96">
        <CardHeader>
          <CardTitle>Mempool Transactions</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-gray-500">No unconfirmed transactions found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-96">
      <CardHeader>
        <CardTitle>Mempool Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <TreeMap
            data={mempoolData}
            dataKey="size"
            aspectRatio={1}
            content={<CustomContent />}
          >
          </TreeMap>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default MempoolTreeMap;