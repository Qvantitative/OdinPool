import React from 'react';

const Transactions = ({ transactionData, handleTransactionClick }) => {
  const formatBTC = (value) => parseFloat(value).toFixed(8);

  const renderTransaction = (tx) => {
    // Destructure the transaction data to match TransactionDetails structure
    const transaction = {
      txid: tx.txid,
      total_input_value: tx.total_input_value,
      total_output_value: tx.total_output_value,
      fee: tx.fee_rate,
      size: tx.size
    };

    // Ensure inputs and outputs match the expected format
    const inputs = tx.input ? tx.input.map(input => ({
      address: input.address,
      value: input.value
    })) : [];

    const outputs = tx.output ? tx.output.map(output => ({
      address: output.address,
      value: output.value,
      scriptPubKey: {
        type: output.script_pubkey?.includes('OP_RETURN') ? 'nulldata' : 'pubkeyhash'
      }
    })) : [];

    return (
      <div key={transaction.txid} className="bg-gray-900 p-4 rounded-lg shadow text-white">
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
                ))}
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