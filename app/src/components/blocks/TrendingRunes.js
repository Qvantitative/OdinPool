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
    setLoading(true);
    try {
      const response = await fetch(`/api/runes/activities/summary?page=${page}&limit=100`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setRunes(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError('Error fetching runes data.');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const sortedRunes = useMemo(() => {
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
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending'
    }));
  }, []);

  const handlePageChange = useCallback(
    (newPage) => {
      setCurrentPage(newPage);
      fetchRunesData(newPage);
    },
    [fetchRunesData]
  );

  useEffect(() => {
    fetchRunesData(currentPage);
  }, [fetchRunesData, currentPage]);

  const handleViewChange = (newView) => {
    console.log(`Switching to ${newView} view`);
    setView(newView);
  };

  return (
    <div className="w-full">
      {error && <div className="text-red-500">{error}</div>}

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

      {view === 'chart' ? (
        <TrendingRunesChart runes={sortedRunes} loading={loading} error={error} />
      ) : (
        <>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="scroll-container w-full" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <
::contentReference[oaicite:0]{index=0}

