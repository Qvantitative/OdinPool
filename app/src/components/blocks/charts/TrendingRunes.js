import React, { useMemo, useState } from 'react';

const TrendingRunesChart = ({ runes, loading, error }) => {
  const [hoveredRune, setHoveredRune] = useState(null);

  const normalizedData = useMemo(() => {
    if (!runes?.length) return [];

    // Find max Market Cap & Volume to scale bubble size & color intensity
    const maxMarketCap = Math.max(...runes.map((r) => r.market_cap || 0));
    const maxVolume = Math.max(...runes.map((r) => r.volume_24h || 0));

    // Show top 30 runes in a spiral
    return runes.slice(0, 30).map((rune, index) => {
      const marketCapRatio = (rune.market_cap || 0) / maxMarketCap;
      const volumeRatio = (rune.volume_24h || 0) / maxVolume;

      // Bubble size: min 30, up to ~100 px
      const size = 30 + marketCapRatio * 70;

      // Golden spiral layout:
      const phi = (1 + Math.sqrt(5)) / 2;
      const i = index + 1;
      const theta = i * phi * Math.PI;
      const distance = Math.sqrt(i) / Math.sqrt(runes.length);

      // x,y in [0..100] -> use as percentages in the SVG viewBox
      const x = distance * Math.cos(theta) * 40 + 50;
      const y = distance * Math.sin(theta) * 40 + 50;

      // Color intensity is based on 24h volume
      const colorIntensity = Math.floor(volumeRatio * 200);

      return {
        ...rune,
        size,
        x,
        y,
        color: `rgb(${colorIntensity}, ${colorIntensity}, 255)`
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
    <div className="w-full relative">
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
              fill={rune.color}
              opacity={hoveredRune?.rune_ticker === rune.rune_ticker ? '0.9' : '0.7'}
              className="transition-all duration-300"
            />
            <text
              textAnchor="middle"
              dy=".3em"
              fontSize={rune.size / 30}
              fill="white"
              className="pointer-events-none select-none"
            >
              {rune.rune_ticker}
            </text>
          </g>
        ))}
      </svg>

      {/* Hover tooltip */}
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
        </div>
      )}

      <div className="mt-4 text-center text-sm text-gray-600">
        Bubble size represents market cap • Color intensity represents 24h volume
      </div>
    </div>
  );
};

// Simple number formatter
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
