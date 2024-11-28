import React, { useState, useEffect } from 'react';

const TransactionDetails = ({ transactionId }) => {
  const [transactionData, setTransactionData] = useState(null);
  const [inscriptionData, setInscriptionData] = useState(null);
  const [error, setError] = useState(null);
  const [runeData, setRuneData] = useState(null);
  const [expandedOpReturn, setExpandedOpReturn] = useState(null);
  const [inputRuneData, setInputRuneData] = useState(null);

  useEffect(() => {
    const fetchTransactionDetails = async () => {
      if (!transactionId) {
        setError('No transaction ID provided');
        return;
      }

      try {
        // Fetch basic transaction data
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
        setInputRuneData(null);

        // Fetch rune data if there's an OP_RETURN output
        const hasOpReturn = data.outputs.some(output => 
          output.scriptPubKey && output.scriptPubKey.type === 'nulldata'
        );
        
        if (hasOpReturn) {
          const runeResponse = await fetch(`/api/rune/${transactionId}`);
          if (runeResponse.ok) {
            const runeData = await runeResponse.json();
            setRuneData(runeData);

            // Fetch input addresses rune balances
            const inputAddresses = data.inputs.map(input => input.address);
            // You'll need to implement this API endpoint to get historical rune balances
            const inputRunesResponse = await fetch(`/api/rune/balances/${transactionId}`);
            if (inputRunesResponse.ok) {
              const inputRuneData = await inputRunesResponse.json();
              setInputRuneData(inputRuneData);
            }
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

  const renderInputRunes = (input, index) => {
    if (!inputRuneData) return null;

    const runeAmount = inputRuneData[input.address];
    if (!runeAmount) return null;

    return (
      <div className="flex items-center space-x-1 text-sm text-gray-400 ml-4">
        ↳ <img src="/zeus-logo.png" alt="ZEUS" className="w-4 h-4" />
        <span className="text-red-400">{runeAmount.toLocaleString()}</span>
        <span>ZEUS•RUNES•WORLD</span>
      </div>
    );
  };

  const renderRuneTransfer = (output, index) => {
    if (!runeData?.edicts) return null;
    
    const edict = runeData.edicts.find(e => e.output === index);
    if (!edict) return null;

    return (
      <div className="flex items-center space-x-1 text-sm text-gray-400 ml-4">
        ↳ <img src="/zeus-logo.png" alt="ZEUS" className="w-4 h-4" />
        <span className="text-red-400">{edict.amount.toString()}</span>
        <span>ZEUS•RUNES•WORLD</span>
      </div>
    );
  };

  if (error) return <div className="text-red-500">{error}</div>;
  if (!transactionData) return <div className="text-white">Loading...</div>;

  const { transaction, inputs, outputs } = transactionData;

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow text-white">
      <h2 className="text-lg font-bold mb-4 text-center">
        <a 
          href={`/tx/${transaction.txid}`}
          className="hover:text-blue-400 transition-colors"
        >
          {transaction.txid}
        </a>
      </h2>

      <div className="flex justify-between items-center mb-4">
        <div>{formatBTC(transaction.total_input_value)} BTC</div>
        <div className="text-sm">
          {transaction.fee} sat/vB = {(transaction.fee * transaction.size / 100000000).toFixed(8)} BTC
        </div>
        <div>{formatBTC(transaction.total_output_value)} BTC</div>
      </div>

      <div className="flex justify-between">
        {/* Inputs Section */}
        <div className="w-1/2 pr-2">
          <h3 className="text-sm font-semibold mb-2">Inputs</h3>
          <ul className="space-y-2">
            {inputs.map((input, index) => (
              <li key={index} className="space-y-1">
                <div className="flex justify-between items-center">
                  <a 
                    href={`/address/${input.address}`}
                    className="text-red-400 hover:text-red-300 truncate mr-2 transition-colors"
                    style={{ maxWidth: '70%' }}
                  >
                    {input.address}
                  </a>
                  <span>{formatBTC(input.value)} BTC</span>
                </div>
                {renderInputRunes(input, index)}
              </li>
            ))}
          </ul>
        </div>

        {/* Outputs Section */}
        <div className="w-1/2 pl-2">
          <h3 className="text-sm font-semibold mb-2">Outputs</h3>
          <ul className="space-y-2">
            {outputs.map((output, index) => {
              const isOpReturn = output.scriptPubKey && output.scriptPubKey.type === 'nulldata';
              return (
                <li key={index} className="space-y-1">
                  <div className="flex justify-between items-center">
                    {isOpReturn ? (
                      <span
                        className="text-yellow-300 cursor-pointer hover:text-yellow-200 truncate mr-2"
                        style={{ maxWidth: '70%' }}
                        onClick={() => handleOpReturnClick(index)}
                      >
                        OP_RETURN (🌋 Runestone message)
                      </span>
                    ) : (
                      <a 
                        href={`/address/${output.address}`}
                        className="text-blue-400 hover:text-blue-300 truncate mr-2 transition-colors"
                        style={{ maxWidth: '70%' }}
                      >
                        {output.address}
                      </a>
                    )}
                    <span>{formatBTC(output.value)} BTC</span>
                  </div>
                  {renderRuneTransfer(output, index + 1)}
                  {expandedOpReturn === index && isOpReturn && (
                    <div className="mt-2 ml-4 p-2 bg-gray-800 rounded">
                      <div className="text-sm space-y-2">
                        {runeData && (
                          <div>
                            <h4 className="font-semibold">Rune Transfer Details:</h4>
                            <pre className="overflow-x-auto text-xs mt-1">
                              {JSON.stringify(runeData, null, 2)}
                            </pre>
                          </div>
                        )}
                        {inscriptionData && (
                          <div>
                            <h4 className="font-semibold">Inscription Details:</h4>
                            <p>ID: {inscriptionData.id}</p>
                            <p>Content Type: {inscriptionData.content_type}</p>
                            {inscriptionData.content_type.startsWith('image/') && (
                              <img 
                                src={`/content/${inscriptionData.id}`}
                                alt="Inscription"
                                className="mt-2 max-w-full h-auto rounded"
                              />
                            )}
                          </div>
                        )}
                      </div>
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