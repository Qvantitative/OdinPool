// app/components/blocks/TransactionDetails

import React, { useState, useEffect } from 'react';

const TransactionDetails = ({ transactionId }) => {
  const [transactionData, setTransactionData] = useState(null);
  const [inscriptionData, setInscriptionData] = useState({});
  const [error, setError] = useState(null);
  const [runeData, setRuneData] = useState({});
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
        setRuneData({});
        setInscriptionData({});
        setError(null);

        // No need to fetch rune and inscription data here
      } catch (error) {
        console.error('Error fetching transaction details:', error);
        setError(`Failed to fetch transaction details: ${error.message}`);
      }
    };

    fetchTransactionDetails();
  }, [transactionId]);

  const formatBTC = (value) => parseFloat(value).toFixed(8);

  const handleOpReturnClick = async (index) => {
    if (expandedOpReturn === index) {
      setExpandedOpReturn(null);
    } else {
      setExpandedOpReturn(index);

      // Fetch Rune data if not already fetched
      if (!runeData[index]) {
        try {
          const runeResponse = await fetch(`/api/rune/${transactionId}/${index}`);
          if (runeResponse.ok) {
            const data = await runeResponse.json();
            setRuneData((prev) => ({ ...prev, [index]: data }));
          } else {
            const errorText = await runeResponse.text();
            setRuneData((prev) => ({ ...prev, [index]: { error: errorText } }));
          }
        } catch (error) {
          console.error('Error fetching rune data:', error);
          setRuneData((prev) => ({ ...prev, [index]: { error: error.message } }));
        }
      }

      // Fetch Inscription data if not already fetched
      if (!inscriptionData[index]) {
        try {
          const inscriptionId = `${transactionId}i${index}`;
          const inscriptionResponse = await fetch(`/api/ord/inscription/${inscriptionId}`);
          if (inscriptionResponse.ok) {
            const data = await inscriptionResponse.json();
            setInscriptionData((prev) => ({ ...prev, [index]: data }));
          } else {
            const errorText = await inscriptionResponse.text();
            setInscriptionData((prev) => ({ ...prev, [index]: { error: errorText } }));
          }
        } catch (error) {
          console.error('Error fetching inscription data:', error);
          setInscriptionData((prev) => ({ ...prev, [index]: { error: error.message } }));
        }
      }
    }
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
          Fee: {transaction.fee} sat/vB ={' '}
          {(transaction.fee * transaction.size / 100000000).toFixed(8)} BTC
        </div>
        <div>{formatBTC(transaction.total_output_value)} BTC</div>
      </div>

      <div className="flex justify-between">
        <div className="w-1/2 pr-2">
          <h3 className="text-sm font-semibold mb-2">Inputs</h3>
          <ul className="space-y-2">
            {inputs.map((input) => (
              <li
                key={`${input.txid}-${input.vout}`}
                className="flex justify-between items-center"
              >
                <span
                  className="text-red-400 truncate mr-2"
                  style={{ maxWidth: '70%' }}
                >
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
              const isOpReturn =
                output.scriptPubKey && output.scriptPubKey.type === 'nulldata';
              return (
                <li key={output.address || `opreturn-${index}`}>
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
                  {expandedOpReturn === index && isOpReturn && (
                    <div className="mt-2 ml-4 p-2 bg-gray-800 rounded">
                      {runeData[index] && (
                        <div className="mb-2">
                          <p>
                            <strong>Rune Name:</strong>{' '}
                            {runeData[index].formattedRuneName || 'Not available'}
                          </p>
                          <p>
                            <strong>Symbol:</strong>{' '}
                            {runeData[index].symbol || 'Not available'}
                          </p>
                          {runeData[index].error && (
                            <p className="text-red-400 text-sm mt-1">
                              {runeData[index].error}
                            </p>
                          )}
                        </div>
                      )}
                      {inscriptionData[index] && (
                        <div>
                          {inscriptionData[index].error ? (
                            <p className="text-red-400 text-sm mt-1">
                              {inscriptionData[index].error}
                            </p>
                          ) : (
                            <>
                              <p className="mb-1">
                                <strong>Inscription ID:</strong>
                              </p>
                              <p className="text-xs break-all mb-2">
                                {inscriptionData[index].id}
                              </p>
                              <p>
                                <strong>Content Type:</strong>{' '}
                                {inscriptionData[index].content_type}
                              </p>
                              <p>
                                <strong>Content Length:</strong>{' '}
                                {inscriptionData[index].content_length}
                              </p>
                              {inscriptionData[index].content_type?.startsWith(
                                'image/'
                              ) && (
                                <div className="mt-2 flex justify-center">
                                  <img
                                    src={`/content/${inscriptionData[index].id}`}
                                    alt={`Inscription ${inscriptionData[index].id}`}
                                    className="w-24 h-24 object-cover rounded border border-gray-600"
                                  />
                                </div>
                              )}
                              {inscriptionData[index].content_type?.startsWith(
                                'text/'
                              ) && (
                                <pre className="mt-2 bg-gray-700 p-2 rounded text-xs overflow-auto max-h-40">
                                  {inscriptionData[index].content}
                                </pre>
                              )}
                            </>
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
