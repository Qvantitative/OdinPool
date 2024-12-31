import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';

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
  if (percentChange === 0) {
    return 'rgba(128, 128, 128, 0.4)';
  }
  return percentChange > 0
    ? 'rgba(22, 199, 132, 0.4)'
    : 'rgba(207, 43, 43, 0.4)';
};

const getBubbleStroke = (percentChange) => {
  if (percentChange === 0) {
    return 'rgba(128, 128, 128, 0.6)';
  }
  return percentChange > 0
    ? 'rgba(22, 199, 132, 0.6)'
    : 'rgba(207, 43, 43, 0.6)';
};

const TrendingRunes = () => {
  const [runes, setRunes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [containerWidth, setContainerWidth] = useState(1600);
  const [containerHeight, setContainerHeight] = useState(600);
  const svgRef = useRef(null);

  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth;
      const height = Math.max(400, window.innerHeight * 0.6);
      setContainerWidth(width);
      setContainerHeight(height);
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const fetchRunes = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/runes/activities/summary?page=1&limit=100');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        setRunes(data.data || []);
      } catch (err) {
        console.error('Error fetching runes:', err);
        setError('Error fetching runes data');
      } finally {
        setLoading(false);
      }
    };
    fetchRunes();
  }, []);

  const normalizedData = useMemo(() => {
    if (!runes || !runes.length) return [];

    const sortedRunes = [...runes].sort(
      (a, b) => (Number(b.volume_24h) || 0) - (Number(a.volume_24h) || 0)
    );

    const maxVolume = Math.max(
      ...sortedRunes.map((r) => Number(r.volume_24h) || 0)
    );

    const MIN_SIZE = 400;
    const MAX_SIZE = 1000;
    const placedBubbles = [];
    const maxBubbles = 150;
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
        const x = radius + margin + Math.random() * (containerWidth - 2 * (radius + margin));
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
  }, [runes, containerWidth, containerHeight]);

  useEffect(() => {
    if (!normalizedData.length) return;

    const svg = d3.select(svgRef.current);
    svg.attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`);

    const groups = svg.selectAll('g')
      .data(normalizedData)
      .join('g');

    groups.selectAll('circle.main')
      .data(d => [d])
      .join('circle')
      .attr('class', 'main')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => d.r)
      .attr('fill', d => getBubbleFill(d.percentChange));

    groups.selectAll('text')
      .data(d => [d])
      .join('text')
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('text-anchor', 'middle')
      .text(d => abbreviateName(d.rune_name));
  }, [normalizedData, containerWidth, containerHeight]);

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
        <svg
          ref={svgRef}
          className="w-full h-full"
        >
        </svg>
      </div>
    </div>
  );
};

export default TrendingRunes;
