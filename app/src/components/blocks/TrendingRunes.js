// app/components/blocks/TrendingRunes.js

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import TrendingRunesChart from '../charts/TrendingRunes';

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

    if (absValue >= trillion) {
      return `${(numValue / trillion).toFixed(decimals)}T`;
    } else if (absValue >= billion) {
      return `${(numValue / billion).toFixed(decimals)}B`;
    } else if (absValue >= million) {
      return `${(numValue / million).toFixed(decimals)}M`;
    } else if (absValue >= thousand) {
      return `${(numValue / thousand).toFixed(decimals)}K`;
    }

    return numValue.toFixed(decimals);
  } catch (error) {
    console.error('Error formatting number:', error);
    return 'N/A';
  }
};

const formatPrice = (value) => {
  if (value === null || value === undefined) return 'N/A';
  try {
    const numValue = Number(value);
    return isNaN(numValue) ? 'N/A' : numValue.toFixed(8);
  } catch {
    return 'N/A';
  }
};

const TrendingRunes = () => {
  const [viewMode, setViewMode] = useState('table');
  const [runes, setRunes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'volume_24h', direction: 'descending' });
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchRunesData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/runes/activities/summary?page=${page}&limit=100`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setRunes(data.data);
      setPagination(data.pagination);
    } catch (error) {
      setError('Error fetching runes data.');
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const sortedRunes = useMemo(() => {
    let sortableRunes = [...runes];
    if (sortConfig.key !== null) {
      sortableRunes.sort((a, b) => {
        if (sortConfig.key === 'rune_name' || sortConfig.key === 'rune_ticker') {
          return sortConfig.direction === 'ascending'
            ? (a[sortConfig.key] || '').localeCompare(b[sortConfig.key] || '')
            : (b[sortConfig.key] || '').localeCompare(a[sortConfig.key] || '');
        } else {
          const aValue = Number(a[sortConfig.key]) || 0;
          const bValue = Number(b[sortConfig.key]) || 0;
          return sortConfig.direction === 'ascending'
            ? aValue - bValue
            : bValue - aValue;
        }
      });
    }
    return sortableRunes;
  }, [runes, sortConfig]);

  const handleSort = useCallback((key) => {
    setSortConfig((prevConfig) => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'ascending'
        ? 'descending'
        : 'ascending'
    }));
  }, []);

  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
    fetchRunesData(newPage);
  }, [fetchRunesData]);

  useEffect(() => {
    fetchRunesData(currentPage);
  }, [fetchRunesData, currentPage]);

  return (
    <div className="w-full max-w-[1600px] mx-auto mt-8">
      <div className="w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Trending Runes</h2>
          <div className="flex space-x-4">
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-md transition-colors duration-200 ${
                viewMode === 'table'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`px-4 py-2 rounded-md transition-colors duration-200 ${
                viewMode === 'chart'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Bubble Chart
            </button>
          </div>
        </div>

        {error && <div className="text-red-500">{error}</div>}

        {viewMode === 'chart' ? (
          <TrendingRunesChart
            runes={sortedRunes}
            loading={loading}
            error={error}
          />
        ) : (
          <>
            {loading && <div>Loading...</div>}
            {!loading && (
              <div className="scroll-container w-full" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="table-auto border-collapse border border-gray-500 w-full text-sm">
              <thead>
                <tr>
                  <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('rune_ticker')}>
                    Ticker {sortConfig.key === 'rune_ticker' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th className="border border-gray-400 px-2 py-1">
                    Symbol
                  </th>
                  <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('rune_name')}>
                    Name {sortConfig.key === 'rune_name' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('holder_count')}>
                    Holders {sortConfig.key === 'holder_count' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('volume_24h')}>
                    24h Volume {sortConfig.key === 'volume_24h' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('total_volume')}>
                    Total Volume {sortConfig.key === 'total_volume' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('unit_price_sats')}>
                    Price (sats) {sortConfig.key === 'unit_price_sats' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('market_cap')}>
                    Market Cap {sortConfig.key === 'market_cap' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedRunes.map((rune) => (
                  <tr key={rune.rune_ticker}>
                    <td className="border border-gray-400 px-2 py-1">
                      {rune.rune_ticker}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {rune.symbol}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-bold">
                        {rune.rune_name}
                      </span>
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {formatNumber(rune.holder_count, 0)}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {formatNumber(rune.volume_24h)}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {formatNumber(rune.total_volume)}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {formatPrice(rune.unit_price_sats)}
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
      </div>
    </div>
  );
};

export default memo(TrendingRunes);