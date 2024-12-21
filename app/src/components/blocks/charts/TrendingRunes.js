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

    // Sort by market cap to ensure larger bubbles are in the back
    const sortedRunes = [...runes].sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));

    const maxMarketCap = Math.max(...sortedRunes.map(r => r.market_cap || 0));
    const maxVolume = Math.max(...sortedRunes.map(r => r.volume_24h || 0));

    return sortedRunes.slice(0, 50).map((rune, index) => {
      // Calculate size based on market cap (range: 30-100)
      const size = 30 + ((rune.market_cap || 0) / maxMarketCap) * 70;

      // Create a spiral layout
      const theta = index * (Math.PI * 2) / 30;
      const radius = 40 * Math.sqrt(index / 30);
      const x = 50 + radius * Math.cos(theta);
      const y = 50 + radius * Math.sin(theta);

      // Calculate percentage change for color intensity
      const percentChange = ((rune.volume_24h || 0) / (rune.total_volume || 1) - 1) * 100;
      const volumeRatio = (rune.volume_24h || 0) / maxVolume;
      const colorIntensity = Math.floor(255 * volumeRatio);

      return {
        ...rune,
        size,
        x,
        y,
        percentChange,
        color: `rgb(${colorIntensity}, 0, 0)`
      };
    });
  }, [runes]);

  if (loading) return (
    <div className="w-full h-96 flex items-center justify-center text-gray-400">
      Loading...
    </div>
  );

  if (error) return (
    <div className="w-full h-96 flex items-center justify-center text-red-500">
      {error}
    </div>
  );

  return (
    <div className="w-full bg-gray-900 rounded-lg overflow-hidden">
      <div className="relative w-full" style={{ minHeight: '600px' }}>
        <svg
          className="w-full h-[600px]"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width="100" height="100" fill="#111827" />
          {normalizedData.map((rune) => (
            <g
              key={rune.rune_ticker}
              transform={`translate(${rune.x},${rune.y})`}
              onMouseEnter={() => setHoveredRune(rune)}
              onMouseLeave={() => setHoveredRune(null)}
              className="cursor-pointer transition-all duration-300"
            >
              <circle
                r={rune.size / 10}
                fill={rune.color}
                opacity={hoveredRune?.rune_ticker === rune.rune_ticker ? 0.9 : 0.7}
                className="transition-opacity duration-300"
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
            className="absolute bg-gray-800 text-white p-4 rounded shadow-lg text-sm"
            style={{
              left: `${hoveredRune.x}%`,
              top: `${hoveredRune.y}%`,
              transform: 'translate(-50%, -120%)',
              zIndex: 10
            }}
          >
            <div className="font-bold mb-1">{hoveredRune.rune_name}</div>
            <div>Market Cap: {formatNumber(hoveredRune.market_cap)}</div>
            <div>24h Volume: {formatNumber(hoveredRune.volume_24h)}</div>
            <div>Holders: {formatNumber(hoveredRune.holder_count)}</div>
            <div className={`${hoveredRune.percentChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {hoveredRune.percentChange.toFixed(2)}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendingRunes;