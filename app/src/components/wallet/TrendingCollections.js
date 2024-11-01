// app/components/wallet/TrendingCollections.js

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import TrendingGraph from './charts/TrendingChart';
import TreeMapChart from './charts/TreeMapChart';

// Memoize all components outside
const MemoizedTreeMapChart = memo(TreeMapChart);
const MemoizedTrendingGraph = memo(TrendingGraph);

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
  const [prevSelectedCollection, setPrevSelectedCollection] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  // Fetch collections stats - no console.log
  const fetchCollectionStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://cors-anywhere.herokuapp.com/https://api-mainnet.magiceden.dev/collection_stats/search/bitcoin`);
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

  // Memoize handlers
  const handleCollectionClick = useCallback((collectionName) => {
    if (collectionName === selectedCollection) {
      setPrevSelectedCollection(collectionName);
    } else {
      setSelectedCollection(collectionName);
      setPrevSelectedCollection(null);
    }
  }, [selectedCollection]);

  const handleBackToTreeMap = useCallback(() => {
    setSelectedCollection(null);
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

  // Fetch data only once on mount
  useEffect(() => {
    fetchCollectionStats();
  }, [fetchCollectionStats]);

  // Memoize the visualization section
  const visualizationSection = useMemo(() => (
    <div className="w-full h-full flex flex-col gap-4">
      {selectedCollection ? (
        <div className="w-full flex-grow flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">{selectedCollection}</h2>
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded-md"
              onClick={handleBackToTreeMap}
            >
              Back to TreeMap
            </button>
          </div>
          <div className="grid grid-rows-2 gap-4 flex-grow">
            <div className="w-full h-full">
              <MemoizedTrendingGraph
                collectionName={selectedCollection}
                refreshData={prevSelectedCollection === selectedCollection}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold mb-4">Market Cap Visualization</h2>
          <div className="w-full flex-grow grid grid-rows-2 gap-4">
            <div className="w-full h-full">
              <MemoizedTreeMapChart
                data={treeMapData}
                onCollectionClick={handleCollectionClick}
              />
            </div>
          </div>
        </>
      )}
    </div>
  ), [
    selectedCollection,
    prevSelectedCollection,
    handleBackToTreeMap,
    treeMapData,
    handleCollectionClick,
    inscriptionStats,
    statsLoading,
    statsError
  ]);

  return (
    <div className="grid grid-cols-2 gap-4 w-full max-w-[1600px] mx-auto mt-8" style={{ height: '400px', overflow: 'hidden' }}>
      {/* Table Section */}
      <div className="w-full h-full">
        <h2 className="text-xl font-bold mb-4">Top Ordinal Collections</h2>

        {Object.values(error).map((msg, idx) => (
          <div key={idx} className="text-red-500">{msg}</div>
        ))}

        {loading && <div>Loading...</div>}

        {!loading && (
          <div className="scroll-container w-full" style={{ maxHeight: '400px', overflowY: 'auto' }}>
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
                      {collection.marketCapUsd !== undefined && collection.marketCapUsd !== null
                        ? `$${parseFloat(collection.marketCapUsd).toFixed(2)}`
                        : 'N/A'}
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

      {/* TreeMap or TrendingGraph Section */}
      {visualizationSection}
    </div>
  );
};

export default memo(TrendingCollections);
