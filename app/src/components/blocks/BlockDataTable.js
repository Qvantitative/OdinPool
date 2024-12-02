// BlockDataTable.js

import React, { useState, useEffect } from 'react';
import Inscriptions from './Inscriptions';
import Runes from './Runes';
import Transactions from './Transactions';
import TransactionsTreeMap from './charts/TransactionsTreeMap';

const TreeMapLoadingPlaceholder = () => (
  <div className="bg-gray-900 p-4 rounded-lg animate-pulse">
    <h3 className="text-xl font-semibold mb-4 text-center text-white">
      Transaction Size Distribution
    </h3>
    <div className="w-full h-[600px] bg-gray-800 rounded-lg flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p className="text-gray-400 text-sm">Loading transaction visualization...</p>
      </div>
    </div>
    <div className="mt-4 text-center text-sm text-gray-400">
      Preparing transaction size distribution data...
    </div>
  </div>
);

const BlockDataTable = ({ block, onAddressClick }) => {
  const [blockDetails, setBlockDetails] = useState(null);
  const [transactionData, setTransactionData] = useState([]);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('inscriptions');
  const [showTreeMap, setShowTreeMap] = useState(false);
  const [isTreeMapLoading, setIsTreeMapLoading] = useState(false);

  const { block_height } = block || {};

  useEffect(() => {
    const fetchBlockDetails = async () => {
      try {
        const response = await fetch(`/api/ord/block/${block_height}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch block details: ${response.statusText}`);
        }
        const blockData = await response.json();
        setBlockDetails(blockData);

        const transactionResponse = await fetch(`/api/transactions?block_height=${block_height}`);
        if (!transactionResponse.ok) {
          throw new Error(`Failed to fetch transactions: ${transactionResponse.statusText}`);
        }
        const transactionData = await transactionResponse.json();
        setTransactionData(transactionData);

        if (activeSection === 'transactions') {
          setIsTreeMapLoading(true);
          setTimeout(() => {
            setShowTreeMap(true);
            setIsTreeMapLoading(false);
          }, 500);
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    };

    fetchBlockDetails();
    setShowTreeMap(false);
    setIsTreeMapLoading(false);
  }, [block_height, activeSection]);

  useEffect(() => {
    if (activeSection !== 'transactions') {
      setShowTreeMap(false);
      setIsTreeMapLoading(false);
    } else if (transactionData.length > 0) {
      setIsTreeMapLoading(true);
      setTimeout(() => {
        setShowTreeMap(true);
        setIsTreeMapLoading(false);
      }, 500);
    }
  }, [activeSection, transactionData]);

  const handleSectionClick = (section) => {
    setActiveSection(section);
  };

  const renderTransactionsSection = () => {
    if (!transactionData.length) return null;

    return (
      <div className="space-y-6">
        {isTreeMapLoading ? (
          <TreeMapLoadingPlaceholder />
        ) : (
          <div className={`transition-opacity duration-500 ${showTreeMap ? 'opacity-100' : 'opacity-0'}`}>
            {showTreeMap && <TransactionsTreeMap transactionData={transactionData} />}
          </div>
        )}
        <div className="mt-6">
          <Transactions transactionData={transactionData} />
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Block #{block_height} Details</h2>

      <div className="flex space-x-4 mb-4">
        <button
          className={`px-4 py-2 rounded ${activeSection === 'inscriptions' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => handleSectionClick('inscriptions')}
        >
          Inscriptions
        </button>
        <button
          className={`px-4 py-2 rounded ${activeSection === 'runes' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => handleSectionClick('runes')}
        >
          Runes
        </button>
        <button
          className={`px-4 py-2 rounded ${activeSection === 'transactions' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => handleSectionClick('transactions')}
        >
          Transactions
        </button>
      </div>

      {activeSection === 'inscriptions' && (
        <Inscriptions blockDetails={blockDetails} onAddressClick={onAddressClick} />
      )}

      {activeSection === 'runes' && blockDetails && blockDetails.runes && (
        <Runes runes={blockDetails.runes} />
      )}

      {activeSection === 'transactions' && renderTransactionsSection()}

      {error && <div className="text-red-500 mt-4">Error: {error}</div>}
    </div>
  );
};

export default BlockDataTable;