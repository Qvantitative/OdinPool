import React from 'react';

const Transactions = ({ transactionData, handleTransactionClick }) => {
  const renderTransaction = (tx) => {
    const isOpReturn =
      tx.output && Array.isArray(tx.output)
        ? tx.output.some(
            (output) =>
              output.script_pubkey && output.script_pubkey.includes('OP_RETURN')
          )
        : false;

    return (
      <div
        key={tx.txid}
        className={`p-4 bg-gray-800 rounded-lg shadow ${
          isOpReturn ? 'bg-yellow-100 animate-pulse' : ''
        }`}
      >
        <div
          className="text-lg font-bold text-center mb-4 cursor-pointer hover:underline"
          onClick={() => handleTransactionClick(tx.txid)}
        >
          {tx.txid}
        </div>

        <div className="flex justify-between items-start">
          {/* Inputs */}
          <div className="w-5/12">
            <div className="text-sm text-gray-400 mb-2">Inputs</div>
            {tx.input && tx.input.length > 0 ? (
              tx.input.map((input, idx) => (
                <div key={`${tx.txid}-input-${idx}`} className="text-red-400 truncate mb-1">
                  {input.script_sig}
                  <span className="text-gray-400 ml-2">
                    {parseFloat(input.value).toFixed(8)} BTC
                  </span>
                </div>
              ))
            ) : (
              <div className="text-gray-400">No Inputs Available</div>
            )}
            <div className="text-sm font-semibold mt-2">
              Total Input Value: {parseFloat(tx.total_input_value).toFixed(8)} BTC
            </div>
          </div>

          {/* Fee Information */}
          <div className="text-sm text-center">
            <div>{tx.fee_rate || 'N/A'} sat/vB</div>
            <div>= {tx.fee ? parseFloat(tx.fee).toFixed(8) : 'N/A'} BTC</div>
          </div>

          {/* Outputs */}
          <div className="w-5/12 text-right">
            <div className="text-sm text-gray-400 mb-2">Outputs</div>
            {tx.output && tx.output.length > 0 ? (
              tx.output.map((output, idx) => (
                <div key={`${tx.txid}-output-${idx}`}>
                  <div className="flex justify-end items-center">
                    <span className={`truncate mr-2 ${output.isOpReturn ? 'text-yellow-300 animate-pulse cursor-pointer' : 'text-blue-400'}`}>
                      {output.script_pubkey}
                    </span>
                    <span>{parseFloat(output.value).toFixed(8)} BTC</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-400">No Outputs Available</div>
            )}
            <div className="text-sm font-semibold mt-2">
              Total Output Value: {parseFloat(tx.total_output_value).toFixed(8)} BTC
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4 text-center">
        Transactions ({transactionData.length} total)
      </h3>
      <div className="space-y-6">
        {transactionData.map(renderTransaction)}
      </div>
    </div>
  );
};

export default Transactions;
