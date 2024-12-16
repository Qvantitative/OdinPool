// app/components/blocks/TrendingRunes.js

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';

const formatSupply = (value) => {
  if (value === null || value === undefined) return 'N/A';

  const trillion = 1_000_000_000_000;
  const billion = 1_000_000_000;
  const million = 1_000_000;
  const thousand = 1_000;

  const absValue = Math.abs(value);

  if (absValue >= trillion) {
    return `${(value / trillion).toFixed(2)}T`;
  } else if (absValue >= billion) {
    return `${(value / billion).toFixed(2)}B`;
  } else if (absValue >= million) {
    return `${(value / million).toFixed(2)}M`;
  } else if (absValue >= thousand) {
    return `${(value / thousand).toFixed(2)}K`;
  }

  return value.toString();
};

const TrendingRunes = () => {
  const [runes, setRunes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  // Fetch runes data
  const fetchRunesData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/trending-runes');
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setRunes(data.data);
    } catch (error) {
      setError('Error fetching runes data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Memoize sorted runes
  const sortedRunes = useMemo(() => {
    let sortableRunes = [...runes];
    if (sortConfig.key !== null) {
      sortableRunes.sort((a, b) => {
        if (sortConfig.key === 'rune_name') {
          return sortConfig.direction === 'ascending'
            ? a.rune_name.localeCompare(b.rune_name)
            : b.rune_name.localeCompare(a.rune_name);
        } else {
          const aValue = a[sortConfig.key] ?? 0;
          const bValue = b[sortConfig.key] ?? 0;
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

  // Fetch data on mount
  useEffect(() => {
    fetchRunesData();
  }, [fetchRunesData]);

  return (
    <div className="w-full max-w-[1600px] mx-auto mt-8">
      <div className="w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Trending Runes</h2>
        </div>

        {error && <div className="text-red-500">{error}</div>}
        {loading && <div>Loading...</div>}

        {!loading && (
          <div className="scroll-container w-full" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="table-auto border-collapse border border-gray-500 w-full text-sm">
              <thead>
                <tr>
                  <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('rune_number')}>
                    # {sortConfig.key === 'rune_number' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('rune_name')}>
                    Name {sortConfig.key === 'rune_name' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('holder_count')}>
                    Holders {sortConfig.key === 'holder_count' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('total_volume')}>
                    Volume {sortConfig.key === 'total_volume' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('avg_price_sats')}>
                    Avg Price (sats) {sortConfig.key === 'avg_price_sats' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('marketcap')}>
                    Market Cap {sortConfig.key === 'marketcap' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('circulating_supply')}>
                    Supply {sortConfig.key === 'circulating_supply' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('mint_progress')}>
                    Mint Progress {sortConfig.key === 'mint_progress' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedRunes.map((rune) => (
                  <tr key={rune.id}>
                    <td className="border border-gray-400 px-2 py-1">
                      {rune.rune_number}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-bold">
                        {rune.rune_name}
                      </span>
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {formatSupply(rune.holder_count)}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {formatSupply(rune.total_volume)}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {rune.avg_price_sats ?? 'N/A'}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {formatSupply(rune.marketcap)}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {formatSupply(rune.circulating_supply)}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {(rune.mint_progress * 100).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(TrendingRunes);