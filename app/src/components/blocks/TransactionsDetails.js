import React, { useState, useEffect } from 'react';

const TransactionDetails = ({ transactionId }) => {
  const [transactionData, setTransactionData] = useState(null);
  const [inscriptionData, setInscriptionData] = useState(null);
  const [error, setError] = useState(null);
  const [runeData, setRuneData] = useState(null);
  const [expandedOpReturn, setExpandedOpReturn] = useState(null);

  useEffect(() => {
    const fetchTransactionDetails = async () => {
      if (!transactionId) {
        setError('No transaction ID provided');
        return;
      }

      try {
        const response = await fetch(`/api/transactions/${transactionId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setTransactionData(data);

        // Reset states
        setExpandedOpReturn(null);
        setRuneData(null);
        setInscriptionData(null);

        // Fetch rune data if there's an OP_RETURN output
        const hasOpReturn = data.outputs.some(output =>
          output.scriptPubKey && output.scriptPubKey.type === 'nulldata'
        );

        if (hasOpReturn) {
          const runeResponse = await fetch(`/api/rune/${transactionId}`);
          if (runeResponse.ok) {
            const runeData = await runeResponse.json();
            setRuneData(runeData);
          }
        }

        // Fetch inscription data if exists
        const inscriptionId = transactionId + 'i0';
        const inscriptionResponse = await fetch(`/api/ord/inscription/${inscriptionId}`);
        if (inscriptionResponse.ok) {
          const inscription = await inscriptionResponse.json();
          setInscriptionData(inscription);
        }
      } catch (error) {
        console.error('Error fetching transaction details:', error);
        setError(`Failed to fetch transaction details: ${error.message}`);
      }
    };

    fetchTransactionDetails();
  }, [transactionId]);

  const formatBTC = (value) => parseFloat(value).toFixed(8);

  const handleOpReturnClick = (index) => {
    setExpandedOpReturn(expandedOpReturn === index ? null : index);
  };

  const renderRuneTransfer = (output, index) => {
    if (!runeData?.edicts) return null;

    const edict = runeData.edicts.find(e => e.output === index);
    if (!edict) return null;

    return (
      <div className="text-sm text-gray-400">
        <span className="text-red-400">{edict.amount.toString()}</span> ZEUS•RUNES•WORLD
      </div>
    );
  };

  if (error) return <div className="text-red-500">{error}</div>;
  if (!transactionData) return <div className="text-white">Loading...</div>;

  const { transaction, inputs, outputs } = transactionData;

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow text-white">
      <h2 className="text-lg font-bold mb-4 text-center">{transaction.txid}</h2>
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
              <li key={index}>
                <div className="flex flex-col">
                  <div className="flex justify-between items-center">
                    <span className="text-red-400 truncate mr-2" style={{ maxWidth: '70%' }}>
                      {input.address}
                    </span>
                    <span>{formatBTC(input.value)} BTC</span>
                  </div>
                  {index === 0 && runeData?.edicts && (
                    <div className="text-sm text-gray-400">
                      <span className="text-red-400">2,239</span> ZEUS•RUNES•WORLD
                    </div>
                  )}
                  {index === 1 && runeData?.edicts && (
                    <div className="text-sm text-gray-400">
                      <span className="text-red-400">2,200</span> ZEUS•RUNES•WORLD
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="w-1/2 pl-2">
          <h3 className="text-sm font-semibold mb-2">Outputs</h3>
          <ul className="space-y-2">
            {outputs.map((output, index) => {
              const isOpReturn = output.scriptPubKey && output.scriptPubKey.type === 'nulldata';
              return (
                <li key={index}>
                  <div className="flex flex-col">
                    <div className="flex justify-between items-center">
                      <span
                        className={`truncate mr-2 ${
                          isOpReturn
                            ? 'text-yellow-300 cursor-pointer'
                            : 'text-blue-400'
                        }`}
                        style={{ maxWidth: '70%' }}
                        onClick={isOpReturn ? () => handleOpReturnClick(index) : undefined}
                      >
                        {isOpReturn ? 'OP_RETURN (🌋 Runestone message)' : output.address}
                      </span>
                      <span>{formatBTC(output.value)} BTC</span>
                    </div>
                    {renderRuneTransfer(output, index + 1)}
                  </div>
                  {expandedOpReturn === index && (
                    <div className="mt-2 ml-4 p-2 bg-gray-800 rounded">
                      <div className="text-sm">
                        <pre className="overflow-x-auto">{JSON.stringify(runeData, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
  );
};

export default TransactionDetails;