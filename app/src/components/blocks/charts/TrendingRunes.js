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

    const sortedRunes = [...runes].sort(
      (a, b) => (Number(b.volume_24h) || 0) - (Number(a.volume_24h) || 0)
    );

    const maxVolume = Math.max(
      ...sortedRunes.map((r) => Number(r.volume_24h) || 0)
    );

    const MIN_SIZE = 400; // Smaller minimum size
    const MAX_SIZE = 1000; // Smaller maximum size

    const placedBubbles = [];
    const maxBubbles = 50;
    const maxAttempts = 1000;
    const margin = 10;

    for (let i = 0; i < sortedRunes.length && placedBubbles.length < maxBubbles; i++) {
      const rune = sortedRunes[i];
      const volume = Number(rune.volume_24h) || 0;
      const size = MIN_SIZE + (volume / maxVolume) * (MAX_SIZE - MIN_SIZE);
      const radius = size / 10;

      const percentChange = Number(rune.unit_price_change) || 0;

      let placed = false;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = radius + margin + Math.random() * (1600 - 2 * (radius + margin)); // Wider area
        const y = radius + margin + Math.random() * (600 - 2 * (radius + margin)); // Narrower height

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
            volume
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
      <div className="relative w-full" style={{ minHeight: '600px' }}> {/* Reduced height */}
        <svg className="w-full h-full" viewBox="0 0 1600 600" preserveAspectRatio="none"> {/* Wider viewBox */}
          <rect width="1600" height="600" fill="#111827" />

          {normalizedData.map((rune) => (
            <g
              key={rune.rune_ticker}
              onMouseEnter={() => setHoveredRune(rune)}
              onMouseLeave={() => setHoveredRune(null)}
              className="cursor-pointer transition-transform duration-200"
            >
              <circle
                cx={rune.x}
                cy={rune.y}
                r={rune.r + 2}
                fill="transparent"
                stroke={getBubbleStroke(rune.percentChange)}
                strokeWidth="2"
                style={{ filter: 'blur(3px)' }}
              />
              <circle
                cx={rune.x}
                cy={rune.y}
                r={rune.r}
                fill={getBubbleFill(rune.percentChange)}
                opacity={0.9}
              />
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
      </div>
    </div>
  );
};

export default TrendingRunes;
