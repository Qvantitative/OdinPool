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

const determineTooltipX = (x, containerWidth) => {
  const margin = 10;
  const tooltipWidth = 300;

  if (x < tooltipWidth / 2 + margin) {
    // Near left edge
    return x + margin;
  } else if (x > containerWidth - tooltipWidth / 2 - margin) {
    // Near right edge
    return x - tooltipWidth - margin;
  } else {
    // Default (centered)
    return x;
  }
};

const determineTooltipY = (y, containerHeight) => {
  const margin = 10;
  const tooltipHeight = 120;
  const topThird = containerHeight / 3;

  if (y < topThird) {
    // Top third of the chart
    return y; // Keep the Y coordinate, position tooltip to the side
  } else if (y < tooltipHeight + margin) {
    // Near top edge
    return y + margin;
  } else if (y > containerHeight - tooltipHeight - margin) {
    // Near bottom edge
    return y - tooltipHeight - margin;
  } else {
    // Default (centered)
    return y;
  }
};

const determineTooltipTransform = (x, y, containerWidth, containerHeight) => {
  const tooltipWidth = 300;
  const tooltipHeight = 120;
  const topThird = containerHeight / 3;

  if (y < topThird) {
    // Top third of the chart
    if (x < containerWidth / 2) {
      // Tooltip to the right for left-side bubbles
      return 'translate(10%, -50%)';
    } else {
      // Tooltip to the left for right-side bubbles
      return 'translate(-110%, -50%)';
    }
  } else if (x < tooltipWidth / 2) {
    // Near left edge
    return 'translate(0, -50%)';
  } else if (x > containerWidth - tooltipWidth / 2) {
    // Near right edge
    return 'translate(-100%, -50%)';
  } else if (y < tooltipHeight) {
    // Near top edge
    return 'translate(-50%, 10%)';
  } else if (y > containerHeight - tooltipHeight) {
    // Near bottom edge
    return 'translate(-50%, -120%)';
  } else {
    // Default
    return 'translate(-50%, -120%)';
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
  const [containerHeight, setContainerHeight] = useState(600);

  useEffect(() => {
    const updateHeight = () => {
      const screenHeight = window.innerHeight;
      setContainerHeight(screenHeight * 0.6); // Adjust height to 60% of screen height
    };
    updateHeight(); // Set initial height
    window.addEventListener('resize', updateHeight); // Update on resize
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const normalizedData = useMemo(() => {
    if (!runes?.length) return [];

    const sortedRunes = [...runes].sort(
      (a, b) => (Number(b.volume_24h) || 0) - (Number(a.volume_24h) || 0)
    );

    const maxVolume = Math.max(
      ...sortedRunes.map((r) => Number(r.volume_24h) || 0)
    );

    const MIN_SIZE = 400;
    const MAX_SIZE = 1000;
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
        const x = radius + margin + Math.random() * (1600 - 2 * (radius + margin));
        const y = radius + margin + Math.random() * (containerHeight - 2 * (radius + margin));

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
            volume,
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
  }, [runes, containerHeight]);

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
      <div className="relative w-full" style={{ height: `${containerHeight}px` }}>
        <svg className="w-full h-full" viewBox={`0 0 1600 ${containerHeight}`} preserveAspectRatio="none">
          <rect width="1600" height={containerHeight} fill="#111827" />

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