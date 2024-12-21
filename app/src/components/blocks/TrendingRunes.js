import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TrendingRunesChart from './TrendingRunes';

const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined) return 'N/A';
  try {
    const numValue = Number(value);
    if (isNaN(numValue)) return 'N/A';

    const trillion = 1_000_000_000_000;
    const billion = 1_000_000_000;
    const million = 1_000_000;
    const thousand = 1_000;

    const absValue = Math.abs(numValue);

    if (absValue >= trillion) return `${(numValue / trillion).toFixed(decimals)}T`;
    if (absValue >= billion) return `${(numValue / billion).toFixed(decimals)}B`;
    if (absValue >= million) return `${(numValue / million).toFixed(decimals)}M`;
    if (absValue >= thousand) return `${(numValue / thousand).toFixed(decimals)}K`;

    return numValue.toFixed(decimals);
  } catch {
    return 'N/A';
  }
};

const TrendingRunes = () => {
  const [runes, setRunes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'volume_24h', direction: 'descending' });
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState('table');

  const fetchRunesData = useCallback(async (page = 1) => {
    console.log(`Fetching runes data for page ${page}`);
    setLoading(true);
    try {
      const response = await fetch(`/api/runes/activities/summary?page=${page}&limit=100`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      console.log('Fetched runes data:', data);
      setRunes(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching runes data:', err);
      setError('Error fetching runes data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const sortedRunes = useMemo(() => {
    console.log('Sorting runes:', runes, sortConfig);
    const sortableRunes = [...runes];
    if (sortConfig.key) {
      sortableRunes.sort((a, b) => {
        if (sortConfig.key === 'rune_name' || sortConfig.key === 'rune_ticker') {
          return sortConfig.direction === 'ascending'
            ? (a[sortConfig.key] || '').localeCompare(b[sortConfig.key] || '')
            : (b[sortConfig.key] || '').localeCompare(a[sortConfig.key] || '');
        } else {
          const aValue = Number(a[sortConfig.key]) || 0;
          const bValue = Number(b[sortConfig.key]) || 0;
          return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        }
      });
    }
    return sortableRunes;
  }, [runes, sortConfig]);

  const handleSort = useCallback((key) => {
    console.log(`Sorting by key: ${key}`);
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending',
    }));
  }, []);

  const handlePageChange = useCallback(
    (newPage) => {
      console.log(`Changing to page ${newPage}`);
      setCurrentPage(newPage);
      fetchRunesData(newPage);
    },
    [fetchRunesData]
  );

  useEffect(() => {
    console.log('Initial data fetch for page 1');
    fetchRunesData(currentPage);
  }, [fetchRunesData, currentPage]);

  const handleViewChange = (newView) => {
    console.log(`Switching to ${newView} view`);
    setView(newView);
  };

  return (
    <div className="w-full">
      {error && <div className="text-red-500">{error}</div>}

      {/* View Toggle Buttons */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => handleViewChange('table')}
          className={`px-4 py-2 rounded ${
            view === 'table'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Table View
        </button>
        <button
          onClick={() => handleViewChange('chart')}
          className={`px-4 py-2 rounded ${
            view === 'chart'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Chart View
        </button>
      </div>

      {/* Conditional Rendering for Views */}
      {view === 'chart' ? (
        <TrendingRunesChart runes={sortedRunes} loading={loading} error={error} />
      ) : (
        <>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="scroll-container w-full" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <table className="table-auto border-collapse border border-gray-500 w-full text-sm">
                <thead>
                  <tr>
                    <th
                      className="border border-gray-400 px-2 py-1 cursor-pointer"
                      onClick={() => handleSort('rune_ticker')}
                    >
                      Ticker{' '}
                      {sortConfig.key === 'rune_ticker' &&
                        (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                    </th>
                    <th className="border border-gray-400 px-2 py-1">Symbol</th>
                    <th
                      className="border border-gray-400 px-2 py-1 cursor-pointer"
                      onClick={() => handleSort('rune_name')}
                    >
                      Name{' '}
                      {sortConfig.key === 'rune_name' &&
                        (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                    </th>
                    <th
                      className="border border-gray-400 px-2 py-1 cursor-pointer"
                      onClick={() => handleSort('holder_count')}
                    >
                      Holders{' '}
                      {sortConfig.key === 'holder_count' &&
                        (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                    </th>
                    <th
                      className="border border-gray-400 px-2 py-1 cursor-pointer"
                      onClick={() => handleSort('volume_24h')}
                    >
                      24h Volume{' '}
                      {sortConfig.key === 'volume_24h' &&
                        (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                    </th>
                    <th
                      className="border border-gray-400 px-2 py-1 cursor-pointer"
                      onClick={() => handleSort('market_cap')}
                    >
                      Market Cap{' '}
                      {sortConfig.key === 'market_cap' &&
                        (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRunes.map((rune) => (
                    <tr key={rune.rune_ticker}>
                      <td className="border border-gray-400 px-2 py-1">{rune.rune_ticker}</td>
                      <td className="border border-gray-400 px-2 py-1">{rune.symbol}</td>
                      <td className="border border-gray-400 px-2 py-1">{rune.rune_name}</td>
                      <td className="border border-gray-400 px-2 py-1">
                        {formatNumber(rune.holder_count)}
                      </td>
                      <td className="border border-gray-400 px-2 py-1">
                        {formatNumber(rune.volume_24h)}
                      </td>
                      <td className="border border-gray-400 px-2 py-1">
                        {formatNumber(rune.market_cap)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {pagination && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => handlePageChange(pagination.prevPage)}
                disabled={!pagination.hasPrevPage}
                className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.nextPage)}
                disabled={!pagination.hasNextPage}
                className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TrendingRunes;
