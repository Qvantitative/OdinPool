// app/components/blocks/TransactionDetails

import React, { useState, useEffect } from 'react';

const formatBTC = (value) => parseFloat(value).toFixed(8);

const OperationBadge = ({ type, className }) => (
  <span className={`px-2 py-1 ${className} text-white rounded-full text-sm`}>
    {type}
  </span>
);

const SizeIndicator = ({ size }) => (
  <div className="flex items-center justify-center gap-2 bg-gray-800 px-3 py-1 rounded-full">
    <span className="text-sm font-medium">{size} bytes</span>
  </div>
);

const RuneTransfer = ({ edict, runeData, direction = 'right' }) => {
  if (!edict) return null;

  return (
    <div className="text-sm text-gray-400 ml-4 flex items-center space-x-2">
      <span>{direction === 'right' ? '↳' : '↲'}</span>
      <span className="text-red-400" title="Amount">
        {Number(edict.amount).toLocaleString()}
      </span>
      <span className="text-yellow-300" title="Rune Name">
        {runeData.etching?.formattedRuneName || runeData.etching?.runeName || `${edict.id.block}:${edict.id.tx}`}
      </span>
    </div>
  );
};

const TransactionDetails = ({ transactionId }) => {
  const [transactionData, setTransactionData] = useState(null);
  const [inscriptionData, setInscriptionData] = useState(null);
  const [error, setError] = useState(null);
  const [runeData, setRuneData] = useState(null);
  const [expandedOpReturn, setExpandedOpReturn] = useState(null);

  const getRuneOperationType = (runeData) => {
    if (!runeData) return null;

    if (runeData.edicts && runeData.edicts.length > 0) {
      return {
        type: 'Transfer',
        className: 'bg-blue-600'
      };
    }

    if (runeData.etching) {
      const flags = runeData.etching.flags || 0;
      if (flags === 1) {
        return {
          type: 'Etch',
          className: 'bg-purple-600'
        };
      } else if (flags === 2) {
        return {
          type: 'Mint',
          className: 'bg-green-600'
        };
      }
    }

    return null;
  };

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
        console.log('Transaction data:', data); // Add this line
        setTransactionData(data);

        // Reset states
        setExpandedOpReturn(null);
        setRuneData(null);
        setInscriptionData(null);

        // Check for OP_RETURN outputs
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

  const renderRuneDetails = () => {
    if (!runeData) return null;

    const operation = getRuneOperationType(runeData);
    if (!operation) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <OperationBadge {...operation} />
          {runeData.etching && (
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">Rune:</span>
              <span className="text-yellow-300">
                {runeData.etching.formattedRuneName || runeData.etching.runeName}
              </span>
              {runeData.etching.symbol && (
                <>
                  <span className="text-gray-400">Symbol:</span>
                  <span className="text-2xl">{runeData.etching.symbol}</span>
                </>
              )}
            </div>
          )}
        </div>

        {operation.type === 'Transfer' && runeData.edicts && (
          <div className="mt-2">
            <span className="text-gray-400">Transfers: </span>
            <span className="text-white">
              {runeData.edicts.map(e => e.amount).reduce((a, b) => a + Number(b), 0).toLocaleString()} total
            </span>
          </div>
        )}

        {operation.type === 'Mint' && runeData.edicts && (
          <div className="mt-2">
            <span className="text-gray-400">Minting: </span>
            <span className="text-white">
              {runeData.edicts.map(e => e.amount).reduce((a, b) => a + Number(b), 0).toLocaleString()} tokens
            </span>
          </div>
        )}
      </div>
    );
  };

  const handleOpReturnClick = (index) => {
    setExpandedOpReturn(expandedOpReturn === index ? null : index);
  };

  if (error) return <div className="text-red-500">{error}</div>;
  if (!transactionData) return <div className="text-white">Loading...</div>;

  const { transaction, inputs, outputs } = transactionData;

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow text-white">
      <h2 className="text-lg font-bold mb-4 text-center break-all">
        {transaction.txid}
      </h2>

      {runeData && (
        <div className="flex justify-center mb-4">
          <OperationBadge {...getRuneOperationType(runeData)} />
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div>{formatBTC(transaction.total_input_value)} BTC</div>
        <div className="flex items-center space-x-4">
          <SizeIndicator size={transaction.size} />
          <div className="text-sm">
            {transaction.fee} sat/vB = {(transaction.fee * transaction.size / 100000000).toFixed(8)} BTC
          </div>
        </div>
        <div>{formatBTC(transaction.total_output_value)} BTC</div>
      </div>

      <div className="flex justify-between gap-4">
        {/* Inputs */}
        <div className="w-1/2">
          <h3 className="text-sm font-semibold mb-2">Inputs</h3>
          <ul className="space-y-2">
            {inputs.map((input, index) => (
              <li key={index}>
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-red-400 truncate mr-2" style={{ maxWidth: '70%' }}>
                      {input.address}
                    </span>
                    <span>{formatBTC(input.value)} BTC</span>
                  </div>
                  {runeData?.edicts && (
                    <RuneTransfer
                      edict={runeData.edicts[index]}
                      runeData={runeData}
                      direction="left"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Outputs */}
        <div className="w-1/2">
          <h3 className="text-sm font-semibold mb-2">Outputs</h3>
          <ul className="space-y-2">
            {outputs.map((output, index) => {
              const isOpReturn = output.scriptPubKey && output.scriptPubKey.type === 'nulldata';
              return (
                <li key={index}>
                  <div>
                    <div className="flex justify-between items-center">
                      <span
                        className={`truncate mr-2 ${isOpReturn ? 'text-yellow-300 cursor-pointer' : 'text-blue-400'}`}
                        style={{ maxWidth: '70%' }}
                        onClick={isOpReturn ? () => handleOpReturnClick(index) : undefined}
                      >
                        {isOpReturn ? 'OP_RETURN (🌋 Runestone message)' : output.address}
                      </span>
                      <span>{formatBTC(output.value)} BTC</span>
                    </div>
                    {runeData?.edicts && (
                      <RuneTransfer
                        edict={runeData.edicts.find(e => e.output === index)}
                        runeData={runeData}
                      />
                    )}
                    {expandedOpReturn === index && isOpReturn && (
                      <div className="mt-2 ml-4 p-2 bg-gray-800 rounded">
                        {renderRuneDetails()}
                      </div>
                    )}
                  </div>
                </li>
              )})}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetails;