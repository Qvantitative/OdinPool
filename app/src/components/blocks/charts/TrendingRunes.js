import React, { useMemo, useState } from 'react';

const TrendingRunesChart = ({ runes, loading, error }) => {
  const [hoveredRune, setHoveredRune] = useState(null);

  const normalizedData = useMemo(() => {
    if (!runes?.length) return [];
    const sortedRunes = [...runes].sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));

    const maxMarketCap = Math.max(...sortedRunes.map(r => r.market_cap || 0));
    const maxVolume = Math.max(...sortedRunes.map(r => r.volume_24h || 0));

    return sortedRunes.slice(0, 50).map((rune, index) => ({
      ...rune,
      size: 30 + ((rune.market_cap || 0) / maxMarketCap) * 70,
      x: 50 + 40 * Math.sqrt(index) * Math.cos(index),
      y: 50 + 40 * Math.sqrt(index) * Math.sin(index),
      color: `rgb(${Math.floor(255 * ((rune.volume_24h || 0) / maxVolume))}, 0, 0)`,
    }));
  }, [runes]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <svg className="w-full h-96">
      {normalizedData.map((rune) => (
        <g key={rune.rune_ticker} transform={`translate(${rune.x},${rune.y})`}>
          <circle r={rune.size / 10} fill={rune.color} />
          <text textAnchor="middle" dy=".3em" fontSize={rune.size / 30}>{rune.rune_ticker}</text>
        </g>
      ))}
    </svg>
  );
};

export default TrendingRunesChart;
