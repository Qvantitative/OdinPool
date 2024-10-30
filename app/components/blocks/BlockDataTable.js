// app/components/blocks/BlockDataTable

import React, { useState, useEffect } from 'react';
import Inscriptions from './Inscriptions';
import Runes from './Runes';
import Transactions from './Transactions';

const BlockDataTable = ({ block }) => {
  const [blockDetails, setBlockDetails] = useState(null);
  const [transactionData, setTransactionData] = useState([]);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('inscriptions');

  const { block_height } = block || {};

  useEffect(() => {
    const fetchBlockDetails = async () => {
      try {
        const response = await fetch(
          `http://localhost:3001/api/ord/block/${block_height}`
        );
        console.log('Response:', response)
        if (!response.ok) {
          throw new Error(
            `Failed to fetch block details: ${response.statusText}`
          );
        }
        const blockData = await response.json();
        console.log('Fetched Block Details:', blockData); // Debugging line
        setBlockDetails(blockData);

        const transactionResponse = await fetch(
          `http://localhost:3001/api/transactions?block_height=${block_height}`
        );
        if (!transactionResponse.ok) {
          throw new Error(
            `Failed to fetch transactions: ${transactionResponse.statusText}`
          );
        }
        const transactionData = await transactionResponse.json();
        setTransactionData(transactionData);
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    };

    fetchBlockDetails();
  }, [block_height]);

  const handleSectionClick = (section) => {
    setActiveSection(section);
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
        <Inscriptions blockDetails={blockDetails} />
      )}

      {activeSection === 'runes' && blockDetails && blockDetails.runes && (
        <Runes runes={blockDetails.runes} />
      )}

      {activeSection === 'transactions' && transactionData.length > 0 && (
        <Transactions transactionData={transactionData} />
      )}

      {error && <div className="text-red-500 mt-4">Error: {error}</div>}
    </div>
  );
};

export default BlockDataTable;