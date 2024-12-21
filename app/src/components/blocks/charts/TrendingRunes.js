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

const getBubbleFill = (percentChange) => {
  // Green if up, red if down, partial opacity
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

    // Sort by market cap so bigger caps are drawn behind (first in the array).
    const sortedRunes = [...runes].sort(
      (a, b) => (b.market_cap || 0) - (a.market_cap || 0)
    );

    // For bubble sizes
    const maxMarketCap = Math.max(
      ...sortedRunes.map((r) => r.market_cap || 0)
    );

    // We’ll place up to these many bubbles
    const maxBubbles = 50;
    // Attempts per bubble for random placement
    const maxAttempts = 500;
    // Range for bubble size in px-like units (used in viewBox space)
    const MIN_SIZE = 50;
    const MAX_SIZE = 500;
    // Margin from the edges
    const margin = 5;

    const placedBubbles = [];

    for (let i = 0; i < sortedRunes.length && placedBubbles.length < maxBubbles; i++) {
      const rune = sortedRunes[i];
      // Pick a size based on market cap
      const size =
        MIN_SIZE + ((rune.market_cap || 0) / maxMarketCap) * (MAX_SIZE - MIN_SIZE);

      // Convert size to radius in the SVG’s coordinate system
      const radius = size / 10;

      // Simple 24h % change calculation
      const percentChange =
        ((rune.volume_24h || 0) / (rune.total_volume || 1) - 1) * 100;

      let placed = false;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Random x,y in [radius+margin, 100-(radius+margin)]
        const x = radius + margin + Math.random() * (100 - 2 * (radius + margin));
        const y = radius + margin + Math.random() * (100 - 2 * (radius + margin));

        // Check overlap with previously placed bubbles
        let overlap = false;
        for (const pb of placedBubbles) {
          const dx = x - pb.x;
          const dy = y - pb.y;
          const distSq = dx * dx + dy * dy;
          const minDist = radius + pb.r;
          if (distSq < minDist * minDist) {
            overlap = true;
            break;
          }
        }

        if (!overlap) {
          placedBubbles.push({
            ...rune,
            size,
            r: radius,
            x,
            y,
            percentChange,
          });
          placed = true;
          break;
        }
      }

      // If we can’t place it after maxAttempts, we skip.
      if (!placed) {
        console.warn(`Could not place ${rune.rune_name} after ${maxAttempts} tries.`);
      }
    }

    return placedBubbles;
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
          width="100%"
          height="800" // or whatever height you want
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
                onMouseEnter={() => setHoveredRune(rune)}
                onMouseLeave={() => setHoveredRune(null)}
                className="cursor-pointer transition-transform duration-200"
                // Move the group to (x%, y%), then apply hover scale.
                style={{
                  transform: `translate(${rune.x}%, ${rune.y}%) scale(${
                    isHovered ? 1.1 : 1
                  })`,
                }}
              >
                {/* Glow outline */}
                <circle
                  r={rune.r + 2}
                  fill="transparent"
                  stroke={getBubbleStroke(rune.percentChange)}
                  strokeWidth="2"
                  style={{ filter: 'blur(3px)' }}
                />
                {/* Main bubble */}
                <circle
                  r={rune.r}
                  fill={getBubbleFill(rune.percentChange)}
                  opacity={0.9}
                />

                {/* Name (abbreviated) in center (upper text) */}
                <text
                  textAnchor="middle"
                  dy="-0.3em"
                  fontSize={Math.max(1.8, rune.size / 28)}
                  fill="#FFFFFF"
                  className="pointer-events-none select-none font-bold"
                >
                  {abbreviateName(rune.rune_name || '', 6)}
                </text>

                {/* 24h % change (lower text) */}
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
