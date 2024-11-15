// app/components/blocks/TrendingCollections.js

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import TrendingGraph from './charts/TrendingChart';
import TreeMapChart from './charts/TreeMapChart';

// Memoize all components outside
const MemoizedTreeMapChart = memo(TreeMapChart);
const MemoizedTrendingGraph = memo(TrendingGraph);

const formatMarketCap = (value) => {
  if (value === null || value === undefined) return 'N/A';

  const trillion = 1_000_000_000_000;
  const billion = 1_000_000_000;
  const million = 1_000_000;
  const thousand = 1_000;

  const absValue = Math.abs(value);

  if (absValue >= trillion) {
    return `$${(value / trillion).toFixed(2)}T`;
  } else if (absValue >= billion) {
    return `$${(value / billion).toFixed(2)}B`;
  } else if (absValue >= million) {
    return `$${(value / million).toFixed(2)}M`;
  } else if (absValue >= thousand) {
    return `$${(value / thousand).toFixed(2)}K`;
  }

  return `$${value.toFixed(2)}`;
};

const TrendingCollections = ({
  inscriptionStats,
  statsLoading,
  statsError
}) => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState({});
  const [fpInBTC, setFpInBTC] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [viewHistory, setViewHistory] = useState(['list']); // Initialize with 'list'

  const currentView = viewHistory[viewHistory.length - 1];

  // Fetch collections stats
  const fetchCollectionStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/proxy?url=https://api-mainnet.magiceden.dev/collection_stats/search/bitcoin`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setCollections(data);
    } catch (error) {
      setError((prev) => ({ ...prev, collections: 'Error fetching collection statistics.' }));
    } finally {
      setLoading(false);
    }
  }, []);

  // Memoize tree map data calculation
  const treeMapData = useMemo(() => collections.map((collection) => ({
    name: collection.name,
    MCAP: collection.marketCapUsd ?? 0,
    formattedMCAP: formatMarketCap(collection.marketCapUsd),
    fpPctChg: collection.fpPctChg ?? 0,
  })), [collections]);

  // Memoize sorted collections
  const sortedCollections = useMemo(() => {
    let sortableCollections = [...collections];
    if (sortConfig.key !== null) {
      sortableCollections.sort((a, b) => {
        if (sortConfig.key === 'name') {
          return sortConfig.direction === 'ascending'
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        } else {
          return sortConfig.direction === 'ascending'
            ? parseFloat(a[sortConfig.key] ?? 0) - parseFloat(b[sortConfig.key] ?? 0)
            : parseFloat(b[sortConfig.key] ?? 0) - parseFloat(a[sortConfig.key] ?? 0);
        }
      });
    }
    return sortableCollections;
  }, [collections, sortConfig]);

  // Handlers
  const handleCollectionClick = useCallback((collectionName) => {
    setSelectedCollection(collectionName);
    setViewHistory((prevHistory) => [...prevHistory, 'chart']);
  }, []);

  const handleShowTreemap = useCallback(() => {
    setViewHistory((prevHistory) => [...prevHistory, 'treemap']);
  }, []);

  const handleBack = useCallback(() => {
    setViewHistory((prevHistory) => prevHistory.slice(0, -1)); // Go back to the previous view
  }, []);

  const toggleFloorPrice = useCallback(() => {
    setFpInBTC(prev => !prev);
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchCollectionStats();
  }, [fetchCollectionStats]);

  return (
    <div className="w-full max-w-[1600px] mx-auto mt-8">
      {currentView === 'list' && (
        <div className="w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Top Ordinal Collections</h2>
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded-md"
              onClick={handleShowTreemap}
            >
              Show Treemap
            </button>
          </div>

          {Object.values(error).map((msg, idx) => (
            <div key={idx} className="text-red-500">{msg}</div>
          ))}

          {loading && <div>Loading...</div>}

          {!loading && (
            <div className="scroll-container w-full" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <table className="table-auto border-collapse border border-gray-500 w-full text-sm">
                {/* Table Header */}
                <thead>
                  <tr>
                    <th className="border border-gray-400 px-2 py-1">Collection</th>
                    {/* Other Headers */}
                  </tr>
                </thead>
                {/* Table Body */}
                <tbody>
                  {sortedCollections.slice(0, 100).map((collection, index) => (
                    <tr key={index} onClick={() => handleCollectionClick(collection.name)}>
                      <td>{collection.name}</td>
                      {/* Other Columns */}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {currentView === 'treemap' && (
        <div className="w-full flex flex-col gap-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Market Cap Visualization</h2>
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded-md"
              onClick={handleBack}
            >
              Back
            </button>
          </div>
          <div className="w-full" style={{ height: '600px' }}>
            <MemoizedTreeMapChart
              data={treeMapData}
              onCollectionClick={handleCollectionClick}
            />
          </div>
        </div>
      )}

      {currentView === 'chart' && (
        <div className="w-full flex flex-col gap-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{selectedCollection}</h2>
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded-md"
              onClick={handleBack}
            >
              Back
            </button>
          </div>
          <div className="w-full" style={{ height: '600px' }}>
            <MemoizedTrendingGraph
              collectionName={selectedCollection}
              refreshData
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(TrendingCollections);
