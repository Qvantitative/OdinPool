import React, { useMemo, useState } from 'react';

const TrendingRunesChart = ({ runes, loading, error }) => {
  const [hoveredRune, setHoveredRune] = useState(null);

  const normalizedData = useMemo(() => {
    if (!runes?.length) return [];

    // Sort by market cap to ensure larger bubbles are in the back
    const sortedRunes = [...runes].sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));

    const maxMarketCap = Math.max(...sortedRunes.map(r => r.market_cap || 0));
    const maxVolume = Math.max(...sortedRunes.map(r => r.volume_24h || 0));
    const maxHolders = Math.max(...sortedRunes.map(r => r.holder_count || 0));

    return sortedRunes.slice(0, 50).map((rune, index) => {
      const marketCapRatio = (rune.market_cap || 0) / maxMarketCap;
      const volumeRatio = (rune.volume_24h || 0) / maxVolume;
      const holderRatio = (rune.holder_count || 0) / maxHolders;

      // Calculate bubble size based on market cap (30-100 range)
      const size = 30 + (marketCapRatio * 70);

      // Calculate position using a modified spiral layout
      const theta = index * (Math.PI * 2) / 30;
      const radius = 40 * Math.sqrt(index / 30);
      const x = 50 + radius * Math.cos(theta);
      const y = 50 + radius * Math.sin(theta);

      // Calculate color based on 24h volume (red intensity)
      const colorIntensity = Math.floor(255 * volumeRatio);

      // Calculate percentage change for display
      const percentChange = ((rune.volume_24h || 0) / (rune.total_volume || 1) - 1) * 100;

      return {
        ...rune,
        size,
        x,
        y,
        colorIntensity,
        percentChange
      };
    });
  }, [runes]);

  if (loading) {
    return <div className="w-full h-96 flex items-center justify-center">Loading...</div>;
  }

  if (error) {
    return <div className="w-full h-96 flex items-center justify-center text-red-500">{error}</div>;
  }

  return (
    <div className="w-full bg-gray-800 rounded-lg p-6">
      <div className="relative w-full">
        <svg className="w-full h-96" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {normalizedData.map((rune) => (
            <g
              key={rune.rune_ticker}
              transform={`translate(${rune.x},${rune.y})`}
              onMouseEnter={() => setHoveredRune(rune)}
              onMouseLeave={() => setHoveredRune(null)}
              className="cursor-pointer"
            >
              <circle
                r={rune.size / 10}
                fill={`rgb(${rune.colorIntensity}, 0, 0)`}
                opacity={hoveredRune?.rune_ticker === rune.rune_ticker ? 0.9 : 0.7}
                className="transition-all duration-300"
              />
              <text
                textAnchor="middle"
                dy=".3em"
                fontSize={rune.size / 30}
                fill="white"
                className="pointer-events-none select-none font-bold"
              >
                {rune.rune_ticker}
              </text>
            </g>
          ))}
        </svg>

        {hoveredRune && (
          <div
            className="absolute bg-gray-900 text-white p-4 rounded shadow-lg text-sm"
            style={{
              left: `${hoveredRune.x}%`,
              top: `${hoveredRune.y}%`,
              transform: 'translate(-50%, -120%)',
              zIndex: 10
            }}
          >
            <div className="font-bold">{hoveredRune.rune_name}</div>
            <div>Market Cap: {formatNumber(hoveredRune.market_cap)}</div>
            <div>24h Volume: {formatNumber(hoveredRune.volume_24h)}</div>
            <div>Holders: {formatNumber(hoveredRune.holder_count)}</div>
            <div>Change: {hoveredRune.percentChange.toFixed(2)}%</div>
          </div>
        )}
      </div>

      <div className="mt-4 text-center text-sm text-gray-400">
        Bubble size represents market cap • Color intensity represents 24h volume
      </div>
    </div>
  );
};

// Helper function for number formatting
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

export default TrendingRunesChart;