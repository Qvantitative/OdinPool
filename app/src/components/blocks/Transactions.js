import React from 'react';

const Transactions = ({ transactionData, handleTransactionClick }) => {
  const formatBTC = (value) => parseFloat(value).toFixed(8);

  const renderTransaction = (tx) => {
    return (
      <div key={tx.txid} className="bg-gray-900 p-4 rounded-lg shadow text-white mb-6">
        <h2
          className="text-lg font-bold mb-4 text-center cursor-pointer hover:text-blue-400"
          onClick={() => handleTransactionClick(tx.txid)}
        >
          {tx.txid}
        </h2>

        <div className="flex justify-between items-center mb-4">
          <div>{formatBTC(tx.total_input_value)} BTC</div>
          <div className="text-sm">
            {tx.fee_rate || 'N/A'} sat/vB = {tx.fee ? formatBTC(tx.fee) : 'N/A'} BTC
          </div>
          <div>{formatBTC(tx.total_output_value)} BTC</div>
        </div>

        <div className="flex justify-between">
          <div className="w-1/2 pr-2">
            <h3 className="text-sm font-semibold mb-2">Inputs</h3>
            <ul className="space-y-2">
              {tx.input && tx.input.length > 0 ? (
                tx.input.map((input, idx) => (
                  <li key={`${tx.txid}-input-${idx}`} className="flex justify-between items-center">
                    <span className="text-red-400 truncate mr-2" style={{ maxWidth: '70%' }}>
                      {input.script_sig}
                    </span>
                    <span>{formatBTC(input.value)} BTC</span>
                  </li>
                ))
              ) : (
                <li className="text-gray-400">No Inputs Available</li>
              )}
            </ul>
          </div>

          <div className="w-1/2 pl-2">
            <h3 className="text-sm font-semibold mb-2">Outputs</h3>
            <ul className="space-y-2">
              {tx.output && tx.output.length > 0 ? (
                tx.output.map((output, idx) => (
                  <li key={`${tx.txid}-output-${idx}`}>
                    <div className="flex justify-between items-center">
                      <span
                        className={`truncate mr-2 ${
                          output.script_pubkey && output.script_pubkey.includes('OP_RETURN')
                            ? 'text-yellow-300 animate-pulse cursor-pointer'
                            : 'text-blue-400'
                        }`}
                        style={{
                          maxWidth: '70%',
                          boxShadow: output.script_pubkey && output.script_pubkey.includes('OP_RETURN')
                            ? '0 0 10px #FCD34D'
                            : 'none'
                        }}
                      >
                        {output.script_pubkey}
                      </span>
                      <span>{formatBTC(output.value)} BTC</span>
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-gray-400">No Outputs Available</li>
              )}
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