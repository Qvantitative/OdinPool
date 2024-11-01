// app/analytics/page.js

"use client";

import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

// Components
import BlockChart from '../../components/blocks/charts/BlockChart';

import FeeEstimateCard from '../../components/blocks/FeeEstimateCard';
import BlockRewardsCard from '../../components/blocks/BlockRewardsCard';
import BlockDisplay from '../../components/blocks/BlockDisplay';
import UpcomingBlockDisplay from '../../components/blocks/UpcomingBlockDisplay';
import BitcoinBlockTable from '../../components/blocks/BitcoinBlockTable';
import MiningPoolBarChart from '../../components/blocks/charts/MiningPoolBarChart';
import MiningPoolPieChart from '../../components/blocks/charts/MiningPoolPieChart';
import CorrelationHeatmap from '../../components/blocks/charts/CorrelationHeatmap';
import TransactionsDetails from '../../components/blocks/TransactionsDetails';
import TopAddresses from '../../components/blocks/TopAddresses';
import ParetoChart from '../../components/blocks/charts/ParetoChart';
import BlockDataTable from '../../components/blocks/BlockDataTable';

const AnalyticsPage = () => {
  // State Variables
  const [blockData, setBlockData] = useState([]);
  const [upcomingBlock, setUpcomingBlock] = useState(null);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [expandedContent, setExpandedContent] = useState(null);
  const [selectedChart, setSelectedChart] = useState('BlockChart');
  const [selectedTableCard, setSelectedTableCard] = useState('BitcoinBlockTable');
  const [searchType, setSearchType] = useState('Transaction ID');
  const [selectedBlock, setSelectedBlock] = useState(null); // New state variable

  // Refs
  const socketRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Define charts and tablesCards arrays
  const charts = [
    { name: 'Block Chart', value: 'BlockChart', component: <BlockChart blockData={blockData} /> },
    { name: 'Correlation Heatmap', value: 'CorrelationHeatmap', component: <CorrelationHeatmap blockData={blockData} /> },
    { name: 'Mining Pool Bar Chart', value: 'MiningPoolBarChart', component: <MiningPoolBarChart blockData={blockData} /> },
    { name: 'Mining Pool Pie Chart', value: 'MiningPoolPieChart', component: <MiningPoolPieChart blockData={blockData} /> },
    { name: 'Pareto Chart of Top Addresses', value: 'ParetoChart', component: <ParetoChart /> },
    // Add other charts if any
  ];

  const tablesCards = [
    { name: 'Bitcoin Block Table', value: 'BitcoinBlockTable', component: <BitcoinBlockTable /> },
    { name: 'Fee Estimate Card', value: 'FeeEstimateCard', component: <FeeEstimateCard /> },
    { name: 'Block Rewards Card', value: 'BlockRewardsCard', component: <BlockRewardsCard timePeriod="1d" /> },
    // Add other tables/cards if any
  ];

  // Determine the WebSocket protocol based on the page's protocol
  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  const socketUrl = `${wsProtocol}://odinpool.ai/socket.io`;

  // Initialize the WebSocket
  useEffect(() => {
    socketRef.current = io(socketUrl, {
      transports: ["websocket", "polling"],
      path: "/socket.io", // Ensure the path matches your Nginx configuration
    });
    fetchInitialData();

    socketRef.current.on('new-block', handleNewBlock);

    // Horizontal scroll handler
    const handleWheel = (e) => {
      if (scrollContainerRef.current) {
        e.preventDefault();
        scrollContainerRef.current.scrollLeft += e.deltaY;
      }
    };

    const container = scrollContainerRef.current;
    container?.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      socketRef.current.disconnect();
      container?.removeEventListener('wheel', handleWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch initial block data and upcoming block
  const fetchInitialData = async () => {
    await Promise.all([fetchBlockData(), fetchUpcomingBlock()]);
  };

  // Fetch block data
  const fetchBlockData = async () => {
    try {
      const maxBlocks = 144 * 30;
      const response = await fetch(`/api/blocks?limit=${maxBlocks}`);
      if (!response.ok) throw new Error('Failed to fetch blocks from the database');

      const data = await response.json();
      const processedData = processBlockData(data);
      setBlockData(processedData);
      setUpcomingBlock(generateUpcomingBlock(processedData[0]));
    } catch (err) {
      console.error('Error fetching block data:', err);
      setError('There was an error loading the data. Please try again later.');
    }
  };

  // Fetch upcoming block data
  const fetchUpcomingBlock = async () => {
    try {
      const response = await fetch('/api/bitcoin-blocks');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      if (data && Object.keys(data).length > 0) {
        const upcomingBlockData = {
          block_height: data.blockHeight + 1,
          fees_estimate: data.feeEstimate,
          feeSpan: data.feeSpan,
          transactions: 0,
          timestamp: new Date(data.timestamp).getTime(),
        };
        setUpcomingBlock(upcomingBlockData);
      } else {
        setUpcomingBlock(null);
      }
    } catch (err) {
      console.error('Error fetching upcoming block data:', err);
      setUpcomingBlock(null);
    }
  };

  // Process block data
  const processBlockData = (data) => {
    const processedData = data
      .map((block) => ({
        id: block.block_height,
        block_height: block.block_height,
        transactions: block.transactions,
        timestamp: block.timestamp ? new Date(block.timestamp).getTime() : null,
        fees_estimate: block.fees_estimate,
        feeSpan: { min: block.min_fee, max: block.max_fee },
        mining_pool: block.mining_pool || 'Unknown',
        inscriptions: block.inscriptions,
      }))
      .sort((a, b) => b.block_height - a.block_height);

    console.log('Processed blockData:', processedData.map((block) => block.inscriptions));

    return processedData;
  };

  // Generate upcoming block data
  const generateUpcomingBlock = (latestBlock) => {
    if (!latestBlock) return null;
    return {
      ...latestBlock,
      block_height: latestBlock.block_height + 1,
    };
  };

  // Handle new block received via WebSocket
  const handleNewBlock = (newBlock) => {
    console.log('New block received:', newBlock.block_height);
    const processedNewBlock = {
      ...newBlock,
      timestamp: newBlock.timestamp * 1000,
      mining_pool: newBlock.mining_pool || 'Unknown',
    };

    setBlockData((prevBlocks) => {
      console.log('Previous blockData:', prevBlocks.map((block) => block.block_height));

      const blockExists = prevBlocks.some((block) => block.block_height === newBlock.block_height);
      if (blockExists) {
        console.log('Block already exists, no update necessary');
        return prevBlocks;
      }

      const updatedBlocks = [processedNewBlock, ...prevBlocks].slice(0, 100);

      console.log('Updated blockData:', updatedBlocks.map((block) => block.block_height));

      return updatedBlocks;
    });

    setUpcomingBlock(generateUpcomingBlock(processedNewBlock));
    fetchUpcomingBlock();
  };

  // Handle search input change
  const handleSearchChange = (e) => setSearchInput(e.target.value);

  // Handle search form submission
  const handleSearchSubmit = async (e) => {
    e.preventDefault();

    if (searchType === 'Transaction ID') {
      setExpandedContent({ type: 'Transaction', id: searchInput.trim() });
    } else if (searchType === 'Block Height') {
      try {
        const response = await fetch(`/api/ord/block/${searchInput.trim()}`);
        if (!response.ok) throw new Error(`Block not found for height: ${searchInput.trim()}`);
        const blockData = await response.json();
        setExpandedContent({ type: 'Block', block: blockData });
      } catch (error) {
        console.error('Error fetching block:', error);
        setError(`Error fetching block: ${error.message}`);
      }
    } else if (searchType === 'Wallet Address') {
      try {
        const response = await fetch(`/api/ord/address/${searchInput.trim()}`);
        if (!response.ok) throw new Error(`Address not found: ${searchInput.trim()}`);
        const addressData = await response.json();
        setExpandedContent({ type: 'Wallet', addressData });
      } catch (error) {
        console.error('Error fetching address:', error);
        setError(`Error fetching address: ${error.message}`);
      }
    }
  };

  // Handle back button click
  const handleBackClick = () => {
    setExpandedContent(null);
    setSearchInput('');
    setSearchType('Transaction ID');
  };

  // Handle block click
  const handleBlockClick = (block) => {
    setSelectedBlock(block);
  };

  const handleBackFromBlockClick = () => {
    setSelectedBlock(null);
  };

  // Render error state
  if (error) {
    return (
      <div className="container mx-auto p-6 bg-gray min-h-screen">
        <h1 className="text-4xl font-bold text-red-600">Error</h1>
        <p className="text-white mt-4">{error}</p>
      </div>
    );
  }

  // Sort blockData before rendering
  const sortedBlockData = [...blockData]
    .sort((a, b) => b.block_height - a.block_height)
    .slice(0, 100); // Get only the last 100 blocks

  // Main render
  return (
    <div className="bg-gray min-h-screen relative">
      {/* Fixed Header with BlockDisplay */}
      <header className="fixed top-0 left-0 right-0 bg-gray-800 p-4 z-50">
        <div className="flex justify-between items-stretch">
          <div className="flex custom-scrollbar" style={{ maxHeight: '300px', whiteSpace: 'nowrap' }}>
            {upcomingBlock && <UpcomingBlockDisplay block={upcomingBlock} />}
          </div>
          <div className="border-l border-dotted border-gray-500 mx-4"></div>
          <div
            ref={scrollContainerRef}
            className="flex overflow-x-auto custom-scrollbar flex-grow"
            style={{ maxHeight: '300px', whiteSpace: 'nowrap', overflowX: 'hidden' }}
          >
            {sortedBlockData.map((block) => (
              <BlockDisplay key={block.block_height} block={block} onBlockClick={handleBlockClick} />
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-8 pt-64">
        {/* Page Header */}
        <section className="mb-10">
          <h1 className="text-4xl font-extrabold text-center pt-20 text-white mb-2">Bitcoin Taproot Analytics</h1>
          <p className="text-center text-white">Real-time blockchain data and analytics dashboard</p>
        </section>

        {/* Search Bar Section */}
        <section className="flex justify-center items-center mb-10">
          <form onSubmit={handleSearchSubmit} className="w-full max-w-md">
            <div className="flex items-center border-b border-teal-500 py-2">
              <select
                className="bg-gray-700 text-white p-2 rounded-l"
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
              >
                <option value="Transaction ID">Transaction ID</option>
                <option value="Block Height">Block Height</option>
                <option value="Wallet Address">Wallet Address</option>
              </select>
              <input
                className="appearance-none bg-transparent border-none w-full text-white mr-3 py-1 px-2 leading-tight focus:outline-none"
                type="text"
                placeholder={`Enter ${searchType}`}
                aria-label={searchType}
                value={searchInput}
                onChange={handleSearchChange}
              />
              <button
                className="flex-shrink-0 bg-teal-500 hover:bg-teal-700 text-sm text-white py-1 px-2 rounded-r"
                type="submit"
              >
                Search
              </button>
            </div>
          </form>
        </section>

        {/* Conditional Rendering Based on expandedContent or selectedBlock */}
        {expandedContent ? (
          <section className="container mx-auto p-8 pt-10">
            <button
              onClick={handleBackClick}
              className="mb-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Back to Analytics
            </button>

            {expandedContent.type === 'Transaction' ? (
              <TransactionsDetails transactionId={expandedContent.id} />
            ) : expandedContent.type === 'Block' ? (
              <BlockDataTable block={expandedContent.block} />
            ) : expandedContent.type === 'Wallet' ? (
              <div>
                {/* Display the same UI as handleAddressClick in BlockDataTable */}
                <h2 className="text-2xl font-bold mb-4">Address Details</h2>
                <div className="flex flex-wrap -mx-2">
                  {/* Inscriptions */}
                  {expandedContent.addressData.inscriptions && (
                    <div className="w-full lg:w-1/2 px-2">
                      <h3 className="text-xl font-semibold mb-4">Inscriptions</h3>
                      {/* Render inscriptions as in BlockDataTable */}
                    </div>
                  )}

                  {/* Outputs */}
                  {expandedContent.addressData.outputs && (
                    <div className="w-full lg:w-1/2 px-2">
                      <h3 className="text-xl font-semibold mb-4">Outputs</h3>
                      {/* Render outputs as in BlockDataTable */}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        ) : selectedBlock ? (
          // Render block data table if a block is clicked
          <section className="container mx-auto p-8 pt-10">
            <button
              onClick={handleBackFromBlockClick}
              className="mb-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Back to Analytics
            </button>
            <BlockDataTable block={selectedBlock} />
          </section>
        ) : (
          // Default content when no search is made
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Left Column: Charts */}
            <div className="space-y-10">
              {/* Chart Selector */}
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-white mb-2">Select Chart</h2>
                <select
                  className="bg-gray-700 text-white p-2 rounded shadow-lg transition duration-300"
                  value={selectedChart}
                  onChange={(e) => setSelectedChart(e.target.value)}
                >
                  {charts.map((chart) => (
                    <option key={chart.value} value={chart.value}>
                      {chart.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* Selected Chart */}
              <section className="p-6 bg-gray-500 rounded-lg shadow-lg transition duration-300">
                {charts.find((chart) => chart.value === selectedChart)?.component}
              </section>
            </div>

            {/* Right Column: Tables/Cards */}
            <div className="space-y-10">
              {/* Table/Card Selector */}
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-white mb-2">Select Table/Card</h2>
                <select
                  className="bg-gray-700 text-white p-2 rounded shadow-lg transition duration-300"
                  value={selectedTableCard}
                  onChange={(e) => setSelectedTableCard(e.target.value)}
                >
                  {tablesCards.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* Selected Table/Card */}
              <section className="p-6 bg-gray-500 rounded-lg shadow-lg transition duration-300">
                {tablesCards.find((item) => item.value === selectedTableCard)?.component}
              </section>
            </div>
          </section>
        )}

        {/* Return to Landing Page Link */}
        <a
          href="/landingPage"
          className="fixed bottom-4 right-4 bg-blue-500 text-white py-2 px-4 rounded-md shadow-lg hover:bg-blue-400"
        >
          Return to Landing Page
        </a>
      </main>
    </div>
  );
};

export default AnalyticsPage;
