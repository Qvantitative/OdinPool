// app/components/blocks/TransactionDetails

import React, { useState, useEffect } from 'react';

const TransactionDetails = ({ transactionId }) => {
  const [transactionData, setTransactionData] = useState(null);
  const [inscriptionData, setInscriptionData] = useState(null);
  const [error, setError] = useState(null);
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
        setInscriptionData(null);
      } catch (error) {
        console.error('Error fetching transaction details:', error);
        setError(`Failed to fetch transaction details: ${error.message}`);
      }
    };

    fetchTransactionDetails();
  }, [transactionId]);

  const handleOpReturnClick = async (index) => {
    if (expandedOpReturn === index) {
      setExpandedOpReturn(null);
      setInscriptionData(null);
    } else {
      setExpandedOpReturn(index);
      try {
        const inscriptionId = `${transactionId}i${index}`;
        const response = await fetch(`/api/inscription/${inscriptionId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch inscription data: ${response.statusText}`);
        }
        const data = await response.json();
        setInscriptionData(data);
      } catch (error) {
        console.error('Error fetching inscription data:', error);
        setError(`Failed to fetch inscription data: ${error.message}`);
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
        <div>{parseFloat(transaction.total_input_value).toFixed(8)} BTC</div>
        <div>{parseFloat(transaction.total_output_value).toFixed(8)} BTC</div>
      </div>

      <div className="flex justify-between">
        <div className="w-1/2 pr-2">
          <h3 className="text-sm font-semibold mb-2">Inputs</h3>
          <ul>
            {inputs.map((input, index) => (
              <li key={index}>{input.address}</li>
            ))}
          </ul>
        </div>
        <div className="w-1/2 pl-2">
          <h3 className="text-sm font-semibold mb-2">Outputs</h3>
          <ul>
            {outputs.map((output, index) => {
              const isOpReturn = output.scriptPubKey && output.scriptPubKey.type === 'nulldata';
              return (
                <li key={index}>
                  <div onClick={isOpReturn ? () => handleOpReturnClick(index) : undefined}>
                    {isOpReturn ? 'OP_RETURN' : output.address}
                  </div>
                  {expandedOpReturn === index && inscriptionData && (
                    <div>
                      {inscriptionData.rune ? (
                        <div>
                          <p><strong>Rune Name:</strong> {inscriptionData.rune}</p>
                        </div>
                      ) : (
                        <p>No Rune found</p>
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
