import React, { useState, useEffect, useMemo } from 'react';

const formatNumber = (value, decimals = 2) => {
  if (!value) return 'N/A';
  try {
    const num = Number(value);
    if (isNaN(num)) return 'N/A';
    const abs = Math.abs(num);
    if (abs >= 1e12) return `${(num / 1e12).toFixed(decimals)}T`;
    if (abs >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
    if (abs >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
    if (abs >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
    return num.toFixed(decimals);
  } catch {
    return 'N/A';
  }
};

// Helper to convert a negative or positive percentChange to a color
// More negative => redder; more positive => greener
// This is just a simple clamp from -50% to +50%; adjust as you wish
const getBubbleColor = (percentChange) => {
  const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

  // For a 2-color stop: -50% => 0 => red, +50% => 1 => green
  // We’ll assume an extreme of ±50% for color extremes
  const ratio = (clamp(percentChange, -50, 50) + 50) / 100; // from 0 to 1

  // Interpolate between red (#CF2B2B) and green (#16C784)
  const redStart = [207, 43, 43];
  const greenEnd = [22, 199, 132];
  const r = Math.round(redStart[0] + (greenEnd[0] - redStart[0]) * ratio);
  const g = Math.round(redStart[1] + (greenEnd[1] - redStart[1]) * ratio);
  const b = Math.round(redStart[2] + (greenEnd[2] - redStart[2]) * ratio);

  // Return as CSS radial gradient for a “bubble-like” style
  return `radial-gradient(circle at 30% 30%, rgb(${r}, ${g}, ${b}), rgb(${r - 30}, ${g - 30}, ${b - 30}))`;
};

const TrendingRunes = () => {
  const [runes, setRunes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hoveredRune, setHoveredRune] = useState(null);

  useEffect(() => {
    const fetchRunes = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          '/api/runes/activities/summary?page=1&limit=100'
        );
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        setRunes(data.data);
      } catch (err) {
        setError('Error fetching runes data');
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRunes();
  }, []);

  const normalizedData = useMemo(() => {
    if (!runes?.length) return [];

    // Sort by market cap so that bigger caps are “behind” (drawn first)
    const sortedRunes = [...runes].sort(
      (a, b) => (b.market_cap || 0) - (a.market_cap || 0)
    );

    const maxMarketCap = Math.max(
      ...sortedRunes.map((r) => r.market_cap || 0)
    );

    return sortedRunes.slice(0, 50).map((rune) => {
      // Bubble size range: 20–100
      const size = 20 + ((rune.market_cap || 0) / maxMarketCap) * 80;

      // Random layout for a “scattered” bubble chart
      // Keep them within 5–95% range so they don’t get cut off
      const x = 5 + Math.random() * 90;
      const y = 5 + Math.random() * 90;

      // We'll define percentChange as (24hVol / totalVol - 1) * 100 or your preferred logic
      const percentChange =
        ((rune.volume_24h || 0) / (rune.total_volume || 1) - 1) * 100;

      return {
        ...rune,
        size,
        x,
        y,
        percentChange,
        color: getBubbleColor(percentChange),
      };
    });
  }, [runes]);

  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-96 flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden">
      <div className="relative w-full" style={{ minHeight: '600px' }}>
        <svg
          className="w-full h-[600px]"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background */}
          <rect width="100" height="100" fill="#111827" />

          {/* Bubbles */}
          {normalizedData.map((rune) => {
            const isHovered = hoveredRune?.rune_ticker === rune.rune_ticker;
            return (
              <g
                key={rune.rune_ticker}
                transform={`translate(${rune.x},${rune.y})`}
                onMouseEnter={() => setHoveredRune(rune)}
                onMouseLeave={() => setHoveredRune(null)}
                className="cursor-pointer transition-transform duration-200"
                style={{
                  transform: `translate(${rune.x}%, ${rune.y}%) scale(${
                    isHovered ? 1.1 : 1
                  })`,
                }}
              >
                {/* Outer "glow" effect */}
                <circle
                  r={rune.size / 8 + 2}
                  fill="transparent"
                  stroke={
                    rune.percentChange >= 0
                      ? 'rgba(22, 199, 132, 0.3)' // greenish glow
                      : 'rgba(207, 43, 43, 0.3)' // reddish glow
                  }
                  strokeWidth="2"
                  style={{
                    filter: 'blur(3px)',
                  }}
                />

                {/* Main bubble */}
                <circle
                  r={rune.size / 10}
                  fill={rune.color}
                  opacity={0.9}
                />

                {/* Ticker Text (top) */}
                <text
                  textAnchor="middle"
                  dy={-rune.size / 20} // push upward
                  fontSize={rune.size / 30 + 1}
                  fill="#ffffff"
                  className="pointer-events-none select-none font-bold"
                >
                  {rune.rune_ticker}
                </text>

                {/* Percent Change (bottom) */}
                <text
                  textAnchor="middle"
                  dy={rune.size / 20 + 4} // push downward
                  fontSize={rune.size / 35}
                  className="pointer-events-none select-none font-semibold"
                  fill={rune.percentChange >= 0 ? '#16C784' : '#CF2B2B'}
                >
                  {rune.percentChange.toFixed(2)}%
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredRune && (
          <div
            className="absolute bg-gray-800 text-white p-3 rounded shadow-lg text-sm"
            style={{
              left: `${hoveredRune.x}%`,
              top: `${hoveredRune.y}%`,
              transform: 'translate(-50%, -120%)',
              zIndex: 10,
            }}
          >
            <div className="font-bold mb-1">{hoveredRune.rune_name}</div>
            <div>Market Cap: {formatNumber(hoveredRune.market_cap)}</div>
            <div>24h Volume: {formatNumber(hoveredRune.volume_24h)}</div>
            <div>Holders: {formatNumber(hoveredRune.holder_count)}</div>
            <div
              className={
                hoveredRune.percentChange >= 0
                  ? 'text-green-400'
                  : 'text-red-400'
              }
            >
              {hoveredRune.percentChange.toFixed(2)}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendingRunes;
