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

const abbreviateName = (name, maxLength = 6) => {
  if (!name) return '';
  return name.length <= maxLength ? name : name.slice(0, maxLength - 1) + '…';
};

// Simple color logic: green if up, red if down
// Use partial opacity to make the bubbles look less solid
const getBubbleFill = (percentChange) => {
  return percentChange >= 0
    ? 'rgba(22, 199, 132, 0.4)' // greenish
    : 'rgba(207, 43, 43, 0.4)'; // reddish
};

const getBubbleStroke = (percentChange) => {
  return percentChange >= 0
    ? 'rgba(22, 199, 132, 0.6)'
    : 'rgba(207, 43, 43, 0.6)';
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

    // Sort by market cap so that bigger caps get drawn first (behind smaller ones)
    const sortedRunes = [...runes].sort(
      (a, b) => (b.market_cap || 0) - (a.market_cap || 0)
    );

    const maxMarketCap = Math.max(
      ...sortedRunes.map((r) => r.market_cap || 0)
    );

    return sortedRunes.slice(0, 50).map((rune) => {
      // Bubble size range: 20–100
      const size = 20 + ((rune.market_cap || 0) / maxMarketCap) * 80;

      // Random layout for the scattered bubble effect
      const x = 5 + Math.random() * 90;
      const y = 5 + Math.random() * 90;

      // Simple way of computing a 24h percent change (modify to your liking):
      const percentChange =
        ((rune.volume_24h || 0) / (rune.total_volume || 1) - 1) * 100;

      return {
        ...rune,
        size,
        x,
        y,
        percentChange,
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
                {/* Subtle glow outline */}
                <circle
                  r={rune.size / 8 + 2}
                  fill="transparent"
                  stroke={getBubbleStroke(rune.percentChange)}
                  strokeWidth="2"
                  style={{
                    filter: 'blur(3px)',
                  }}
                />
                {/* Main bubble */}
                <circle
                  r={rune.size / 10}
                  fill={getBubbleFill(rune.percentChange)}
                  // Make it even more transparent if desired
                  opacity={0.9}
                />

                {/* Name (abbreviated) in the center (top) */}
                <text
                  textAnchor="middle"
                  dy="-0.3em"
                  fontSize={Math.max(1.8, rune.size / 28)}
                  fill="#FFFFFF"
                  className="pointer-events-none select-none font-bold"
                >
                  {abbreviateName(rune.rune_name || '', 6)}
                </text>

                {/* 24h % change in the center (bottom) */}
                <text
                  textAnchor="middle"
                  dy="0.9em"
                  fontSize={Math.max(1.4, rune.size / 32)}
                  fill={rune.percentChange >= 0 ? '#16C784' : '#CF2B2B'}
                  className="pointer-events-none select-none font-semibold"
                >
                  {rune.percentChange.toFixed(2)}%
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip with extra info */}
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
