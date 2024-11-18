// app/components/blocks/TransactionDetails

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

        // Reset states when loading new transaction
        setExpandedOpReturn(null);
        setRuneData(null);
        setInscriptionData(null);

        // Check if transaction has OP_RETURN output and fetch rune data immediately
        const hasOpReturn = data.outputs.some(output =>
          output.scriptPubKey && output.scriptPubKey.type === 'nulldata'
        );

        if (hasOpReturn) {
          try {
            const runeResponse = await fetch(`/api/rune/${transactionId}`);
            if (runeResponse.ok) {
              const runeData = await runeResponse.json();
              setRuneData(runeData);
            }
          } catch (runeError) {
            console.error('Error fetching initial rune data:', runeError);
          }
        }

        // Fetch inscription data
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

  const handleOpReturnClick = async (index) => {
    setExpandedOpReturn(expandedOpReturn === index ? null : index);
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
              <li key={index} className="flex justify-between items-center">
                <span className="text-red-400 truncate mr-2" style={{ maxWidth: '70%' }}>{input.address}</span>
                <span>{formatBTC(input.value)} BTC</span>
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
                  <div className="flex justify-between items-center">
                    <span
                      className={`truncate mr-2 ${
                        isOpReturn
                          ? 'text-yellow-300 animate-pulse cursor-pointer'
                          : 'text-blue-400'
                      }`}
                      style={{
                        maxWidth: '70%',
                        boxShadow: isOpReturn ? '0 0 10px #FCD34D' : 'none',
                      }}
                      onClick={isOpReturn ? () => handleOpReturnClick(index) : undefined}
                    >
                      {isOpReturn ? 'OP_RETURN' : output.address}
                    </span>
                    <span>{formatBTC(output.value)} BTC</span>
                  </div>
                  {expandedOpReturn === index && runeData && (
                    <div className="mt-2 ml-4 p-2 bg-gray-800 rounded">
                      <div className="mb-2">
                        <p><strong>Rune Name:</strong> {runeData.formattedRuneName || 'Not available'}</p>
                        <p><strong>Symbol:</strong> {runeData.symbol || 'Not available'}</p>
                        {runeData.error && (
                          <p className="text-red-400 text-sm mt-1">{runeData.error}</p>
                        )}
                      </div>
                      {inscriptionData && (
                        <div>
                          <p className="mb-1"><strong>Inscription ID:</strong></p>
                          <p className="text-xs break-all mb-2">{inscriptionData.id}</p>
                          <p><strong>Content Type:</strong> {inscriptionData.content_type}</p>
                          <p><strong>Content Length:</strong> {inscriptionData.content_length}</p>
                          {inscriptionData.content_type?.startsWith('image/') && (
                            <div className="mt-2 flex justify-center">
                              <img
                                src={`/content/${inscriptionData.id}`}
                                alt={`Inscription ${inscriptionData.id}`}
                                className="w-24 h-24 object-cover rounded border border-gray-600"
                              />
                            </div>
                          )}
                          {inscriptionData.content_type?.startsWith('text/') && (
                            <pre className="mt-2 bg-gray-700 p-2 rounded text-xs overflow-auto max-h-40">
                              {inscriptionData.content}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetails;