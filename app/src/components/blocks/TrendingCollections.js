// app/components/blocks/TrendingCollections.js

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import TrendingGraph from './charts/TrendingChart';
import TreeMapChart from './charts/TreeMapChart';
import BubbleMaps from './BubbleMaps';

const MemoizedTreeMapChart = memo(TreeMapChart);
const MemoizedTrendingGraph = memo(TrendingGraph);
const MemoizedBubbleMaps = memo(BubbleMaps);

// Collection name mappings - make sure these match EXACTLY with your backend/API
const collectionNameMappings = {
  'Bitcoin Puppets': 'bitcoin-puppets',
  'BitcoinPuppets': 'bitcoin-puppets',
  'bitcoin puppets': 'bitcoin-puppets',
  'bitcoin-puppets': 'bitcoin-puppets',
  'nodemonkes': 'nodemonkes',
  'NodeMonkes': 'nodemonkes',
  'basedangels': 'basedangels',
  'BasedAngels': 'basedangels',
  'quantum_cats': 'quantum-cats',
  'Quantum Cats': 'quantum-cats',
  // Add any other variations you might encounter
};

// Update the normalizeCollectionName function
const normalizeCollectionName = (name) => {
  if (!name) return '';

  // First check if we have an exact mapping
  const normalized = collectionNameMappings[name];
  if (normalized) return normalized;

  // Normalize name: replace spaces and hyphens with underscores
  const normalizedName = name
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .trim();

  return normalizedName;
};

// Function to format display names nicely
const formatDisplayName = (name) => {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Update the getDisplayName function to handle more cases
const getDisplayName = (normalizedName) => {
  // Find the first mapping that matches this normalized name
  const displayEntry = Object.entries(collectionNameMappings)
    .find(([display, normalized]) => normalized === normalizedName);

  if (displayEntry) {
    return displayEntry[0];
  }

  // If no mapping found, format it nicely
  return formatDisplayName(normalizedName);
};

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

const transformRankingsData = (rawData) => {
  if (!Array.isArray(rawData)) return [];

  return rawData
    .filter(item => (
      item?.cohort === 'ordinal' &&
      item?.collectionSymbol &&
      typeof item?.name === 'string'
    ))
    .map((item, index) => ({
      rank: index + 1,
      address: item.name || 'unknown',
      holding_count: parseInt(item.count || 0),
      total_project_supply: 10000, // You might want to get this from your API
      collection: item.collectionSymbol.toLowerCase()
    }));
};

const TrendingCollections = ({
  inscriptionStats,
  statsLoading,
  statsError,
}) => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState({});
  const [fpInBTC, setFpInBTC] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [prevSelectedCollection, setPrevSelectedCollection] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [currentView, setCurrentView] = useState('list');
  const [viewHistory, setViewHistory] = useState(['list']);
  const [projectRankings, setProjectRankings] = useState([]);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [rankingsError, setRankingsError] = useState(null);

  const BUBBLE_MAP_SUPPORTED_COLLECTIONS = [
    'bitcoin-puppets',
    'nodemonkes',
    'basedangels',
    'quantum-cats'
  ];

  // Fetch collections stats
  const fetchCollectionStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/proxy?url=https://api-mainnet.magiceden.dev/collection_stats/search/bitcoin');
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      console.log(data)
      setCollections(data);
    } catch (error) {
      setError((prev) => ({ ...prev, collections: 'Error fetching collection statistics.' }));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch project rankings when selectedCollection changes
  useEffect(() => {
    if (selectedCollection) {
      const fetchProjectRankings = async () => {
        setRankingsLoading(true);
        try {
          const response = await fetch(`/api/project-rankings?project=${selectedCollection}`);
          if (!response.ok) throw new Error(`Failed to fetch project rankings`);
          const rawData = await response.json();

          // Transform the data into the format BubbleMaps expects
          const transformedData = transformRankingsData(rawData);

          // Only set project rankings if we have valid transformed data
          if (transformedData.length > 0) {
            setProjectRankings(transformedData);
            setRankingsError(null);
          } else {
            throw new Error('No valid rankings data available');
          }
        } catch (error) {
          setProjectRankings([]);
          setRankingsError(error.message);
        } finally {
          setRankingsLoading(false);
        }
      };
      fetchProjectRankings();
    }
  }, [selectedCollection]);

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
    const normalizedCollectionName = normalizeCollectionName(collectionName);
    setPrevSelectedCollection(selectedCollection);
    setSelectedCollection(normalizedCollectionName);
    setViewHistory(prev => [...prev, 'chart']);
    setCurrentView('chart');
  }, [selectedCollection]);

  const handleBack = useCallback(() => {
    setViewHistory(prev => {
      const newHistory = [...prev];
      newHistory.pop();
      const previousView = newHistory[newHistory.length - 1] || 'list';
      setCurrentView(previousView);
      return newHistory;
    });
  }, []);

  const handleShowTreemap = useCallback(() => {
    setViewHistory(prev => [...prev, 'treemap']);
    setCurrentView('treemap');
  }, []);

  const handleSort = useCallback((key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'ascending'
        ? 'descending'
        : 'ascending'
    }));
  }, []);

  const toggleFloorPrice = useCallback(() => {
    setFpInBTC(prev => !prev);
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchCollectionStats();
  }, [fetchCollectionStats]);

  // Get the normalized collection name for bubble maps
  const normalizedSelectedCollection = selectedCollection;

  const renderChartView = () => (
    <div className="w-full flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{getDisplayName(selectedCollection)}</h2>
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded-md"
            onClick={handleBack}
          >
            {viewHistory[viewHistory.length - 2] === 'treemap' ? 'Back to Treemap' : 'Back to List'}
          </button>
        </div>
        <div className="w-full" style={{ height: '600px' }}>
          <MemoizedTrendingGraph
            collectionName={selectedCollection}
            refreshData={prevSelectedCollection === selectedCollection}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">Holder Distribution</h3>
        <div className="w-full" style={{ height: '600px' }}>
          {BUBBLE_MAP_SUPPORTED_COLLECTIONS.includes(selectedCollection) && projectRankings.length > 0 ? (
            <MemoizedBubbleMaps
              projectRankings={projectRankings}
              rankingsLoading={rankingsLoading}
              rankingsError={rankingsError}
              selectedCollection={selectedCollection}
              onCollectionChange={(collection) => {
                console.log('Collection Change Event:', collection);
                setSelectedCollection(collection);
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800 rounded-lg">
              <div className="text-center">
                <div className="text-xl text-gray-400 mb-2">
                  {rankingsLoading ? 'Loading...' : 'No Bubble Map Available'}
                </div>
                <div className="text-sm text-gray-500">
                  {rankingsLoading
                    ? 'Fetching holder distribution data...'
                    : 'Holder distribution visualization is not available for this collection'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

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
                <thead>
                  <tr>
                    <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('name')}>
                      Collection {sortConfig.key === 'name' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                    </th>
                    <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('fp')}>
                      Floor Price (BTC) {sortConfig.key === 'fp' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                    </th>
                    <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('fpPctChg')}>
                      1D % Change {sortConfig.key === 'fpPctChg' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                    </th>
                    <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('vol')}>
                      Volume {sortConfig.key === 'vol' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                    </th>
                    <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('marketCapUsd')}>
                      Market Cap {sortConfig.key === 'marketCapUsd' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                    </th>
                    <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('ownerCount')}>
                      Owner Count {sortConfig.key === 'ownerCount' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                    </th>
                    <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('listedCount')}>
                      Listed Count {sortConfig.key === 'listedCount' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sortedCollections.slice(0, 100).map((collection, index) => (
                    <tr key={index} onClick={() => handleCollectionClick(collection.name)} className="cursor-pointer">
                      <td className="border border-gray-400 px-2 py-1">
                        <div className="flex items-center space-x-2">
                          <img
                            src={collection.image}
                            alt={collection.name}
                            className="w-8 h-8 object-cover rounded-full"
                          />
                          <span className="font-bold truncate" style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {collection.name}
                          </span>
                        </div>
                      </td>
                      <td className="border border-gray-400 px-2 py-1">
                        <div onClick={toggleFloorPrice} className="cursor-pointer">
                          {fpInBTC
                            ? `${parseFloat(collection.fp ?? 0).toFixed(4)} BTC`
                            : `$${((collection.fp ?? 0) * collection.currencyUsdRate).toFixed(4)}`}
                        </div>
                      </td>
                      <td className="border border-gray-400 px-2 py-1">
                        <div className={`text-xs ${collection.fpPctChg >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {collection.fpPctChg !== undefined && collection.fpPctChg !== null
                            ? `${collection.fpPctChg >= 0 ? '+' : ''}${collection.fpPctChg.toFixed(2)}%`
                            : 'N/A'}
                        </div>
                      </td>
                      <td className="border border-gray-400 px-2 py-1">
                        {collection.vol !== undefined && collection.vol !== null
                          ? parseFloat(collection.vol).toFixed(4)
                          : 'N/A'}
                      </td>
                      <td className="border border-gray-400 px-2 py-1">
                        {formatMarketCap(collection.marketCapUsd)}
                      </td>
                      <td className="border border-gray-400 px-2 py-1">
                        {collection.ownerCount !== undefined && collection.ownerCount !== null
                          ? collection.ownerCount
                          : 'N/A'}
                      </td>
                      <td className="border border-gray-400 px-2 py-1">
                        {collection.listedCount !== undefined && collection.listedCount !== null
                          ? collection.listedCount
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {currentView === 'chart' && renderChartView()}
    </div>
  );
};

export default memo(TrendingCollections);
