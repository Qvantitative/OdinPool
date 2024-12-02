// BlockDataTable.js

import React, { useState, useEffect } from 'react';
import Inscriptions from './Inscriptions';
import Runes from './Runes';
import Transactions from './Transactions';
import TransactionsTreeMap from './charts/TransactionsTreeMap';

const BlockDataTable = ({ block, onAddressClick }) => {
  const [blockDetails, setBlockDetails] = useState(null);
  const [transactionData, setTransactionData] = useState([]);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('inscriptions');
  const [showTreeMap, setShowTreeMap] = useState(false);

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

        // Add a slight delay before showing the TreeMap
        setTimeout(() => {
          setShowTreeMap(true);
        }, 500);
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    };

    fetchBlockDetails();
    setShowTreeMap(false);
  }, [block_height]);

  useEffect(() => {
    if (activeSection !== 'transactions') {
      setShowTreeMap(false);
    } else {
      setTimeout(() => {
        setShowTreeMap(true);
      }, 500);
    }
  }, [activeSection]);

  const handleSectionClick = (section) => {
    setActiveSection(section);
  };

  const renderTransactionsSection = () => {
    if (!transactionData.length) return null;

    return (
      <div className="space-y-6">
        <div className={`transition-opacity duration-500 ${showTreeMap ? 'opacity-100' : 'opacity-0'}`}>
          {showTreeMap && <TransactionsTreeMap transactionData={transactionData} />}
        </div>
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