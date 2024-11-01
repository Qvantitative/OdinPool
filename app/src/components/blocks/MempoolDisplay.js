import React, { useEffect } from 'react';

const MempoolDisplay = ({ mempoolData, blockMaxSize = 4000000 }) => {
  useEffect(() => {
    console.log('MempoolDisplay rendered. mempoolData:', mempoolData);
  }, [mempoolData]);

  if (!mempoolData) {
    console.log('MempoolDisplay: mempoolData is null or undefined');
    return <div className="bg-gray-800 rounded-lg p-4 text-white">Loading mempool data...</div>;
  }

  console.log('MempoolDisplay: Processing mempoolData');

  // Sort transactions by fee rate (highest to lowest) and take only the top 10
  const sortedTransactions = mempoolData.transactions
    .sort((a, b) => (b.time / b.height) - (a.time / a.height))
    .slice(0, 10);
  
  console.log('Top 10 transactions:', sortedTransactions);

  return (
    <div className="bg-gray-800 rounded-lg p-4 text-white">
      <h2 className="text-xl font-semibold mb-2">Mempool Information (Top 10 Transactions)</h2>
      <p>Total Transactions in Mempool: {mempoolData.mempoolSize}</p>
      <p>Displaying: {sortedTransactions.length} transactions</p>
      <div className="mt-2 max-h-60 overflow-y-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left">txid</th>
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.map((tx) => (
              <tr key={tx.txid}>
                <td className="truncate">{tx.txid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MempoolDisplay;