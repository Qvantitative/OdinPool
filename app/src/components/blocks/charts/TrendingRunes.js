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
        const response = await fetch('/api/runes/activities/summary?page=1&limit=100');
        console.log("Runes Activities:", response)
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

    const maxMarketCap = Math.max(
      ...sortedRunes.map((r) => r.market_cap || 0)
    );

    // Bubble size range: scaled up by a factor of 10
    const MIN_SIZE = 500;
    const MAX_SIZE = 1000;

    const placedBubbles = [];
    const maxBubbles = 50; // Max bubbles to display
    const maxAttempts = 1000; // Attempts per bubble
    const margin = 10; // Extra margin from edges

    for (let i = 0; i < sortedRunes.length && placedBubbles.length < maxBubbles; i++) {
      const rune = sortedRunes[i];
      const size = MIN_SIZE + ((rune.market_cap || 0) / maxMarketCap) * (MAX_SIZE - MIN_SIZE);
      const radius = size / 10;

      const percentChange =
        ((rune.volume_24h || 0) / (rune.total_volume || 1) - 1) * 100;

      let placed = false;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = radius + margin + Math.random() * (1000 - 2 * (radius + margin));
        const y = radius + margin + Math.random() * (1000 - 2 * (radius + margin));

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
            x,
            y,
            r: radius,
            percentChange,
          });
          placed = true;
          break;
        }
      }

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
      <div className="relative w-full" style={{ minHeight: '1000px' }}>
        <svg className="w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
          {/* Background */}
          <rect width="1000" height="1000" fill="#111827" />

          {/* Bubbles */}
          {normalizedData.map((rune) => (
            <g
              key={rune.rune_ticker}
              onMouseEnter={() => setHoveredRune(rune)}
              onMouseLeave={() => setHoveredRune(null)}
              className="cursor-pointer transition-transform duration-200"
            >
              {/* Glow outline */}
              <circle
                cx={rune.x}
                cy={rune.y}
                r={rune.r + 2}
                fill="transparent"
                stroke={getBubbleStroke(rune.percentChange)}
                strokeWidth="2"
                style={{ filter: 'blur(3px)' }}
              />
              {/* Main bubble */}
              <circle
                cx={rune.x}
                cy={rune.y}
                r={rune.r}
                fill={getBubbleFill(rune.percentChange)}
                opacity={0.9}
              />
              {/* Bubble text */}
              <text
                x={rune.x}
                y={rune.y - 10}
                textAnchor="middle"
                fontSize={Math.max(12, rune.r / 5)}
                fill="#FFFFFF"
                className="pointer-events-none select-none font-bold"
              >
                {abbreviateName(rune.rune_name, 6)}
              </text>
              <text
                x={rune.x}
                y={rune.y + 20}
                textAnchor="middle"
                fontSize={Math.max(10, rune.r / 6)}
                fill={rune.percentChange >= 0 ? '#16C784' : '#CF2B2B'}
                className="pointer-events-none select-none"
              >
                {rune.percentChange.toFixed(2)}%
              </text>
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredRune && (
          <div
            className="absolute bg-gray-800 text-white p-3 rounded shadow-lg text-sm"
            style={{
              left: `${hoveredRune.x}px`,
              top: `${hoveredRune.y}px`,
              transform: 'translate(-50%, -120%)',
              zIndex: 10,
            }}
          >
            <div className="font-bold mb-1">{hoveredRune.rune_name}</div>
            <div>Market Cap: {formatNumber(hoveredRune.market_cap)}</div>
            <div>24h Volume: {formatNumber(hoveredRune.volume_24h)}</div>
            <div>Holders: {formatNumber(hoveredRune.holder_count)}</div>
            <div
              className={hoveredRune.percentChange >= 0 ? 'text-green-400' : 'text-red-400'}
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
