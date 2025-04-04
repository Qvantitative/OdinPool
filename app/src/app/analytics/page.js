// app/analytics/page.js

"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';

// Components
import BlockChart from '../../components/blocks/charts/BlockChart';
import Navbar from '../../components/blocks/Navbar';
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
import InscriptionsLatest from '../../components/blocks/InscriptionsLatest';
import Wallet from '../../components/blocks/Wallet';
import ProjectActivities from '../../components/blocks/charts/ProjectActivities';
import Ord from '../../components/blocks/Ord';
import MempoolTreeMap from '../../components/blocks/charts/MempoolTreeMap';

const BubbleMaps = dynamic(() => import('../../components/blocks/BubbleMaps'), { ssr: false });
const TrendingWrapper = dynamic(() => import('../../components/blocks/TrendingWrapper'), { ssr: false });

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
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedView, setSelectedView] = useState('mempool');
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [showBubbleChart, setShowBubbleChart] = useState(false);
  const [projectRankings, setProjectRankings] = useState([]);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [rankingsError, setRankingsError] = useState(null);
  const [showTrending, setShowTrending] = useState(false);
  const [showRunes, setShowRunes] = useState(false);

  // New state variable for transfer intervals
  const [transferIntervals, setTransferIntervals] = useState([]);

  // Refs
  const scrollContainerRef = useRef(null);

  // Define charts and tablesCards arrays
  const charts = [
    { name: 'Block Chart', value: 'BlockChart', component: <BlockChart blockData={blockData} /> },
    { name: 'Correlation Heatmap', value: 'CorrelationHeatmap', component: <CorrelationHeatmap blockData={blockData} /> },
    { name: 'Mining Pool Bar Chart', value: 'MiningPoolBarChart', component: <MiningPoolBarChart blockData={blockData} /> },
    { name: 'Mining Pool Pie Chart', value: 'MiningPoolPieChart', component: <MiningPoolPieChart blockData={blockData} /> },
    { name: 'Pareto Chart of Top Addresses', value: 'ParetoChart', component: <ParetoChart /> },
    { name: 'Project Activities', value: 'ProjectActivities', component: <ProjectActivities transferIntervals={transferIntervals} /> },
    // Add other charts if any
  ];

  const tablesCards = [
    { name: 'Bitcoin Block Table', value: 'BitcoinBlockTable', component: <BitcoinBlockTable /> },
    { name: 'Fee Estimate Card', value: 'FeeEstimateCard', component: <FeeEstimateCard /> },
    { name: 'Block Rewards Card', value: 'BlockRewardsCard', component: <BlockRewardsCard timePeriod="1d" /> },
    // Add other tables/cards if any
  ];

  // Effect: Initialize WebSocket and fetch initial data
  useEffect(() => {
    // Initial fetch
    fetchInitialData();

    // Set up polling interval
    const pollInterval = setInterval(() => {
      fetchInitialData();
    }, 60000); // Poll every minute

    // Horizontal scroll handler
    const handleWheel = (e) => {
      if (scrollContainerRef.current) {
        e.preventDefault();
        scrollContainerRef.current.scrollLeft += e.deltaY;
      }
    };

    const container = scrollContainerRef.current;
    container?.addEventListener('wheel', handleWheel, { passive: false });

    // Cleanup
    return () => {
      clearInterval(pollInterval);
      container?.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Fetch initial block data, upcoming block, and transfer intervals
  const fetchInitialData = async () => {
    await Promise.all([fetchBlockData(), fetchUpcomingBlock(), fetchTransferIntervals()]);
  };

  // Fetch block data
  const fetchBlockData = async () => {
    try {
      const maxBlocks = 144 * 30;
      const response = await fetch(`/api/blocks?limit=${maxBlocks}`);
      if (!response.ok) throw new Error('Failed to fetch blocks from the database');

      const data = await response.json();

      setBlockData((prevBlocks) => {
        // Check if newest block already exists
        const latestBlock = data[0];
        const blockExists = prevBlocks.some(
          (block) => block.block_height === latestBlock.block_height
        );

        if (blockExists) {
          console.log('Block already exists, no update necessary');
          return prevBlocks;
        }

        // Process and update blocks
        const processedData = processBlockData(data);
        return processedData;
      });

      // Update upcoming block based on latest data
      const processedData = processBlockData(data);
      console.log("Processed Block:", processedData)
      setUpcomingBlock(generateUpcomingBlock(processedData[0]));
    } catch (err) {
      console.error('Error fetching block data:', err);
      setError('There was an error loading the data. Please try again later.');
    }
  };

  // Fetch upcoming block data
  const fetchUpcomingBlock = async () => {
    try {
      const response = await fetch('/api/blocks?limit=1', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      if (data && data.length > 0) {
        const latestBlock = data[0];
        const upcomingBlockData = {
          block_height: latestBlock.block_height + 1,
          fees_estimate: latestBlock.fees_estimate,
          feeSpan: {
            min: latestBlock.min_fee,
            max: latestBlock.max_fee
          },
          transactions: 0,
          timestamp: new Date().getTime(),
          mining_pool: latestBlock.mining_pool,
          inscriptions: latestBlock.inscriptions
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

  // New function to fetch transfer intervals
  const fetchTransferIntervals = async () => {
    try {
      const response = await fetch('/api/transfer-intervals');
      if (!response.ok) throw new Error('Failed to fetch transfer intervals');

      const data = await response.json();
      console.log( 'Project Activities:', data)
      setTransferIntervals(data);
    } catch (err) {
      console.error('Error fetching transfer intervals:', err);
      // Handle error as needed
    }
  };

  // Helper functions remain the same
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

    return processedData;
  };

  const generateUpcomingBlock = (latestBlock) => {
    if (!latestBlock) return null;
    return {
      ...latestBlock,
      block_height: latestBlock.block_height + 1,
    };
  };

  // Fetch project rankings for BubbleMaps
  const fetchProjectRankings = useCallback(async (projectSlug = null) => {
    if (!projectSlug) return;

    setRankingsLoading(true);
    setRankingsError(null);

    try {
      const url = new URL('/api/project-rankings', window.location.origin);
      url.searchParams.append('project', projectSlug);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch project rankings');
      }

      let data = await response.json();

      // Handle both array and object response formats
      if (!Array.isArray(data)) {
        data = data[projectSlug] || [];
      }

      // Transform data to include formatted values
      const transformedData = data.map(ranking => ({
        ...ranking,
        holding_percentage: parseFloat(ranking.holding_percentage).toFixed(2),
        formattedAddress: `${ranking.address.slice(0, 6)}...${ranking.address.slice(-4)}`,
        rank_display: `#${ranking.rank}`
      }));

      setProjectRankings(transformedData);
    } catch (error) {
      console.error('Error fetching project rankings:', error);
      setRankingsError(error.message);
    } finally {
      setRankingsLoading(false);
    }
  }, []);

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

  // Update the handleShowBubbleChart function
  const handleShowBubbleChart = useCallback(() => {
    setShowBubbleChart(true);
    setSelectedView('bubbleMap'); // Add this line
    setShowTrending(false);
    setShowRunes(false);
    setSelectedCollection((prev) => prev || 'bitcoin-puppets');
    setExpandedContent(null);
    setSelectedBlock(null);
  }, []);

  // Function to handle 'Trending Collections' view
  const handleShowTrendingCollections = () => {
    setSelectedView('trendingCollections');
    setShowBubbleChart(false);
    // Reset any other states if necessary
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

  const handleAddressClick = (address) => {
    setExpandedContent({
      type: 'Wallet',
      addressData: { address }
    });
  };

  const handleShowMempool = () => {
    setSelectedView('mempool');
    setShowBubbleChart(false);
  };

  const handleShowTransactions = () => setSelectedView('transactions');

  const handleShowAnalytics = () => {
    setSelectedView('analytics');
    setShowBubbleChart(false); // Add this line
  };

  const handleCollectionChange = useCallback((collection) => {
    setSelectedCollection(collection);
  }, []);

  // UseEffect to handle collection changes
  useEffect(() => {
    if (selectedCollection && showBubbleChart) {
      fetchProjectRankings(selectedCollection);
    }
  }, [selectedCollection, showBubbleChart, fetchProjectRankings]);

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
      <Navbar
        onShowMempool={handleShowMempool}
        onShowTransactions={handleShowTransactions}
        onShowAnalytics={handleShowAnalytics}
        onShowBubbleMap={handleShowBubbleChart}
        onShowTrendingCollections={handleShowTrendingCollections}
        selectedView={selectedView}
        onSearch={async ({ type, value }) => {
          if (type === 'Transaction ID') {
            setExpandedContent({ type: 'Transaction', id: value });
          } else if (type === 'Block Height') {
            try {
              const response = await fetch(`/api/ord/block/${value}`);
              if (!response.ok) throw new Error(`Block not found for height: ${value}`);
              const blockData = await response.json();
              setExpandedContent({ type: 'Block', block: blockData });
            } catch (error) {
              console.error('Error fetching block:', error);
              setError(`Error fetching block: ${error.message}`);
            }
          } else if (type === 'Wallet Address') {
            try {
              const response = await fetch(`/api/ord/address/${value}`);
              if (!response.ok) throw new Error(`Address not found: ${value}`);
              const addressData = await response.json();
              setExpandedContent({ type: 'Wallet', addressData });
            } catch (error) {
              console.error('Error fetching address:', error);
              setError(`Error fetching address: ${error.message}`);
            }
          }
        }}
      />

      {/* Fixed Header with BlockDisplay */}
      <header className="fixed top-16 left-0 right-0 bg-gray-800 px-4 pt-4 pb-2 z-40">
        <div className="flex justify-between items-stretch">
          <div className="flex custom-scrollbar" style={{ maxHeight: '300px', whiteSpace: 'nowrap' }}>
            {upcomingBlock && <UpcomingBlockDisplay block={upcomingBlock} />}
          </div>
          <div className="border-l border-dotted border-gray-500 mx-4"></div>
          <div
            ref={scrollContainerRef}
            className="flex overflow-x-auto custom-scrollbar flex-grow"
            style={{ maxHeight: '300px', whiteSpace: 'nowrap' }}
          >
            {sortedBlockData.map((block) => (
              <BlockDisplay key={block.block_height} block={block} onBlockClick={handleBlockClick} />
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-8 pt-96">
        {/* Page Header */}
        <section className="mb-6">
          <h1 className="text-4xl font-extrabold text-center pt-4 text-white mb-2">Onchain Data Analytics</h1>
          <p className="text-center text-white">Real-time blockchain data and analytics dashboard</p>
        </section>

        {/* Conditional Rendering Based on expandedContent, selectedBlock, showBubbleChart, or selectedView */}
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
              <BlockDataTable
                block={expandedContent.block}
                onAddressClick={handleAddressClick}
              />
            ) : expandedContent.type === 'Wallet' ? (
              <Wallet
                address={expandedContent.addressData.address}
                onAddressClick={handleAddressClick}
              />
            ) : null}
          </section>
        ) : selectedBlock ? (
          <section className="container mx-auto p-8 pt-10">
            <button
              onClick={handleBackFromBlockClick}
              className="mb-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Back to Analytics
            </button>
            <BlockDataTable
              block={selectedBlock}
              onAddressClick={handleAddressClick}
            />
          </section>
        ) : selectedView === 'mempool' ? (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: MempoolTreeMap */}
            <div className="bg-gray-800 rounded-lg p-4 h-full" style={{ height: "600px" }}>
              <MempoolTreeMap transactionData={blockData.flatMap(block => block.transactions || [])} />
            </div>

            {/* Right Column: Ord */}
            <div className="bg-gray-800 rounded-lg p-4 h-full" style={{ height: "600px" }}>
              <Ord onAddressClick={handleAddressClick} />
            </div>
          </section>
        ) : selectedView === 'transactions' ? (
          <section>
            {/* Render the Transactions view */}
            {/* You can create a TransactionsList component or similar */}
          </section>
        ) : selectedView === 'analytics' ? (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Left Column: Charts */}
            <div className="space-y-10">
              {/* Chart Selector */}
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-white mb=2">Select Chart</h2>
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
        ) : selectedView === 'bubbleMap' && showBubbleChart ? (
          <section className="container mx-auto">
            <div className="w-full h-[calc(100vh-300px)]">
              <BubbleMaps
                projectRankings={projectRankings}
                rankingsLoading={rankingsLoading}
                rankingsError={rankingsError}
                selectedCollection={selectedCollection}
                onCollectionChange={handleCollectionChange}
              />
            </div>
          </section>
        ) : selectedView === 'trendingCollections' ? (
          <section>
            <TrendingWrapper />
          </section>
        ) : (
          <section>
            {/* Default content or redirect */}
            <div className="text-center py-8">
              <h2 className="text-2xl font-semibold text-white mb-4">No View Selected</h2>
              <p className="text-gray-300 mb-4">Please select a view from the navigation bar above.</p>
              <button
                onClick={() => setSelectedView('mempool')}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                View Mempool
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default AnalyticsPage;
