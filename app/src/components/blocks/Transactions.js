import React, { useState, useEffect } from 'react';

const Transactions = ({ transactionData, handleTransactionClick }) => {
  const [detailedData, setDetailedData] = useState({});
  const [loading, setLoading] = useState({});

  useEffect(() => {
    const fetchDetails = async (txid) => {
      try {
        setLoading(prev => ({ ...prev, [txid]: true }));
        const response = await fetch(`/api/transactions/${txid}`);
        const data = await response.json();
        setDetailedData(prev => ({ ...prev, [txid]: data }));
      } catch (error) {
        console.error(`Error fetching details for ${txid}:`, error);
      } finally {
        setLoading(prev => ({ ...prev, [txid]: false }));
      }
    };

    // Fetch details for transactions that we don't have yet
    transactionData.forEach(tx => {
      if (!detailedData[tx.txid]) {
        fetchDetails(tx.txid);
      }
    });
  }, [transactionData]);

  const formatBTC = (value) => parseFloat(value).toFixed(8);

  const renderTransaction = (tx) => {
    const txDetails = detailedData[tx.txid];
    const isLoading = loading[tx.txid];

    // Merge basic and detailed data
    const transaction = {
      txid: tx.txid,
      total_input_value: txDetails?.total_input_value || tx.total_input_value,
      total_output_value: txDetails?.total_output_value || tx.total_output_value,
      fee: txDetails?.fee_rate || tx.fee_rate,
      size: txDetails?.size || tx.size
    };

    // Use detailed data if available, otherwise fall back to basic data
    const inputs = (txDetails?.input || tx.input || []).map(input => ({
      address: input.address,
      value: input.value
    }));

    const outputs = (txDetails?.output || tx.output || []).map(output => ({
      address: output.address,
      value: output.value,
      scriptPubKey: {
        type: output.script_pubkey?.includes('OP_RETURN') ? 'nulldata' : 'pubkeyhash'
      }
    }));

    return (
      <div key={transaction.txid} className="bg-gray-900 p-4 rounded-lg shadow text-white relative">
        {isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        )}

        <h2
          className="text-lg font-bold mb-4 text-center cursor-pointer hover:text-blue-400"
          onClick={() => handleTransactionClick(transaction.txid)}
        >
          {transaction.txid}
        </h2>

        <div className="flex justify-between items-center mb-4">
          <div>{formatBTC(transaction.total_input_value)} BTC</div>
          <div className="text-sm">
            {transaction.fee} sat/vB = {(transaction.fee * transaction.size / 100000000).toFixed(8)} BTC
          </div>
          <div>{formatBTC(transaction.total_output_value)} BTC</div>
        </div>

        <div className="flex justify-between">
          <div className="w-1/2 pr-2">
            <h3 className="text-sm font-semibold mb-2">Inputs</h3>
            <ul className="space-y-2">
              {inputs.map((input, index) => (
                <li key={index} className="flex justify-between items-center">
                  <span className="text-red-400 truncate mr-2" style={{ maxWidth: '70%' }}>
                    {input.address}
                  </span>
                  <span>{formatBTC(input.value)} BTC</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="w-1/2 pl-2">
            <h3 className="text-sm font-semibold mb-2">Outputs</h3>
            <ul className="space-y-2">
              {outputs.map((output, index) => {
                const isOpReturn = output.scriptPubKey?.type === 'nulldata';
                return (
                  <li key={index}>
                    <div className="flex justify-between items-center">
                      <span
                        className={`truncate mr-2 ${
                          isOpReturn
                            ? 'text-yellow-300 animate-pulse cursor-pointer'
                            : 'text-blue-400'
                        }`}
                        style={{
                          maxWidth: '70%',
                          boxShadow: isOpReturn ? '0 0 10px #FCD34D' : 'none'
                        }}
                      >
                        {isOpReturn ? 'OP_RETURN' : output.address}
                      </span>
                      <span>{formatBTC(output.value)} BTC</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold mb-4 text-center text-white">
        Transactions ({transactionData.length} total)
      </h3>
      {transactionData.map(renderTransaction)}
    </div>
  );
};

export default Transactions;