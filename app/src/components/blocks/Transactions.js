// app/components/blocks/Transactions.js

import React, { useState, useEffect } from 'react';

const formatBytes = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return '0 vB';
  const sizes = ['vB', 'KvB', 'MvB', 'GvB', 'TvB', 'PvB', 'EvB', 'ZB', 'YvB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  if (i >= sizes.length) return 'Value too large';
  const value = bytes / Math.pow(1024, i);
  return i === 0 ? `${Math.round(value)} ${sizes[i]}` : `${value.toFixed(decimals)} ${sizes[i]}`;
};

// Loading Circle Component
const LoadingCircle = () => (
  <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

const Transactions = ({ transactionData, handleTransactionClick }) => {
  const [detailedData, setDetailedData] = useState({});
  const [inscriptionData, setInscriptionData] = useState({});
  const [runeData, setRuneData] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [expandedOpReturns, setExpandedOpReturns] = useState({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [transactionsPerPage] = useState(10);

  // Calculate pagination values
  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const currentTransactions = transactionData.slice(
    indexOfFirstTransaction,
    indexOfLastTransaction
  );
  const totalPages = Math.ceil(transactionData.length / transactionsPerPage);

  useEffect(() => {
    if (transactionData.length > 0) {
      setIsInitialLoading(false);
    }
  }, [transactionData]);

  useEffect(() => {
    const fetchAllDetails = async (transaction) => {
      const transactionId = transaction.txid; // Get txid from transaction object
      try {
        setLoading(prev => ({ ...prev, [transactionId]: true }));

        // Single API call to get transaction details
        const response = await fetch(`/api/transactions/${transactionId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        // Set the detailed data
        setDetailedData(prev => ({ ...prev, [transactionId]: data }));

      } catch (error) {
        console.error(`Error fetching details for ${transactionId}:`, error);
        setErrors(prev => ({ ...prev, [transactionId]: error.message }));
      } finally {
        setLoading(prev => ({ ...prev, [transactionId]: false }));
      }
    };

    // Only fetch details for transactions on the current page
    currentTransactions.forEach(transaction => {
      const transactionId = transaction.txid;
      if (!detailedData[transactionId]) {
        fetchAllDetails(transaction);
      }
    });
  }, [currentPage, transactionData, detailedData]);

  const handleOpReturnClick = async (transactionId, index) => {
    const currentKey = `${transactionId}-${index}`;

    if (expandedOpReturns[currentKey]) {
      setExpandedOpReturns(prev => ({ ...prev, [currentKey]: false }));
      setRuneData(prev => ({ ...prev, [transactionId]: null }));
    } else {
      setExpandedOpReturns(prev => ({ ...prev, [currentKey]: true }));
      try {
        const response = await fetch(`/api/rune/${transactionId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch rune data');
        }
        const data = await response.json();
        setRuneData(prev => ({ ...prev, [transactionId]: data }));
      } catch (error) {
        console.error('Error fetching rune data:', error);
        setErrors(prev => ({ ...prev, [transactionId]: `Failed to fetch rune data: ${error.message}` }));
      }
    }
  };

  const formatBTC = (value) => parseFloat(value).toFixed(8);

  const Pagination = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    return (
      <div className="flex items-center justify-center space-x-2 mt-4">
        <button
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
        >
          &lt;&lt;
        </button>
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
        >
          &lt;
        </button>

        {startPage > 1 && (
          <>
            <button
              onClick={() => setCurrentPage(1)}
              className={`px-3 py-1 rounded ${currentPage === 1 ? 'bg-blue-500' : 'bg-gray-700'}`}
            >
              1
            </button>
            {startPage > 2 && <span className="px-2">...</span>}
          </>
        )}

        {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(number => (
          <button
            key={number}
            onClick={() => setCurrentPage(number)}
            className={`px-3 py-1 rounded ${
              currentPage === number ? 'bg-blue-500' : 'bg-gray-700'
            } text-white`}
          >
            {number}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-2">...</span>}
            <button
              onClick={() => setCurrentPage(totalPages)}
              className={`px-3 py-1 rounded ${
                currentPage === totalPages ? 'bg-blue-500' : 'bg-gray-700'
              }`}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
        >
          &gt;
        </button>
        <button
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
        >
          &gt;&gt;
        </button>
      </div>
    );
  };

  const renderTransaction = (transaction) => {
    const transactionId = transaction.txid;
    const txDetails = detailedData[transactionId];
    const isLoading = loading[transactionId];
    const error = errors[transactionId];
    const inscription = inscriptionData[transactionId];
    const rune = runeData[transactionId];

    if (error) {
      return (
        <div key={transactionId} className="bg-gray-900 p-4 rounded-lg shadow text-red-500">
          Error loading transaction {transactionId}: {error}
        </div>
      );
    }

    const currentTransaction = txDetails?.transaction || {
      txid: transactionId,
      total_input_value: transaction.total_input_value,
      total_output_value: transaction.total_output_value,
      fee: transaction.fee_rate,
      size: transaction.size
    };

    const inputs = txDetails?.inputs || transaction.input || [];
    const outputs = txDetails?.outputs || transaction.output || [];
    const confirmationDuration = currentTransaction.confirmation_duration;

    return (
      <div key={transactionId} className="bg-gray-900 p-4 rounded-lg shadow text-white relative">
        {isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        )}

        <h2
          className="text-lg font-bold mb-4 text-center cursor-pointer hover:text-blue-400 truncate overflow-auto max-w-full"
          onClick={() => handleTransactionClick(transactionId)}
        >
          {transactionId}
        </h2>

        <div className="flex justify-between items-center mb-4">
          <div>{formatBTC(currentTransaction.total_input_value)} BTC</div>
          <div className="flex flex-col items-center text-sm space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">{formatBytes(currentTransaction.size)}</span>
              <span className="text-gray-400">|</span>
              <span>{currentTransaction.fee} sat/vB</span>
              {confirmationDuration && (
                <>
                  <span className="text-gray-400">|</span>
                  <span>{confirmationDuration.hours}h {confirmationDuration.minutes}m {confirmationDuration.seconds}s</span>
                </>
              )}
            </div>
            <div className="text-gray-400">
              = {(currentTransaction.fee * currentTransaction.size / 100000000).toFixed(8)} BTC
            </div>
          </div>
          <div>{formatBTC(currentTransaction.total_output_value)} BTC</div>
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
                const isExpanded = expandedOpReturns[`${transactionId}-${index}`];

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
                        onClick={isOpReturn ? () => handleOpReturnClick(transactionId, index) : undefined}
                      >
                        {isOpReturn ? 'OP_RETURN' : output.address}
                      </span>
                      <span>{formatBTC(output.value)} BTC</span>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 ml-4 p-2 bg-gray-800 rounded">
                        {rune && (
                          <div className="mb-2">
                            <p><strong>Rune Name:</strong> {rune.formattedRuneName}</p>
                            <p><strong>Symbol:</strong> {rune.symbol}</p>
                          </div>
                        )}
                        {inscription && (
                          <div>
                            <p className="mb-1"><strong>Inscription ID:</strong></p>
                            <p className="text-xs break-all mb-2">{inscription.id}</p>
                            <p><strong>Content Type:</strong> {inscription.content_type}</p>
                            <p><strong>Content Length:</strong> {inscription.content_length}</p>
                            {inscription.content_type.startsWith('image/') && (
                              <div className="mt-2 flex justify-center">
                                <img
                                  src={`/content/${inscription.id}`}
                                  alt={`Inscription ${inscription.id}`}
                                  className="w-24 h-24 object-cover rounded border border-gray-600"
                                />
                              </div>
                            )}
                            {inscription.content_type.startsWith('text/') && (
                              <pre className="mt-2 bg-gray-700 p-2 rounded text-xs overflow-auto max-h-40">
                                {inscription.content}
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

  if (isInitialLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <LoadingCircle />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold mb-4 text-center text-white">
        Transactions ({transactionData.length} total)
      </h3>

      <div className="space-y-4">
        {currentTransactions.map(renderTransaction)}
      </div>
      <Pagination />
      <div className="text-center text-sm text-gray-400 mt-2">
        Page {currentPage} of {totalPages} |
        Showing transactions {indexOfFirstTransaction + 1}-
        {Math.min(indexOfLastTransaction, transactionData.length)} of {transactionData.length}
      </div>
    </div>
  );
};

export default Transactions;