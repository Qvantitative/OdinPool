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
    return 'rgba(128, 128, 128, 0.4)'; // Gray for 0% change
  }
  return percentChange > 0
    ? 'rgba(22, 199, 132, 0.4)' // Green for positive change
    : 'rgba(207, 43, 43, 0.4)'; // Red for negative change
};

const getBubbleStroke = (percentChange) => {
  if (percentChange === 0) {
    return 'rgba(128, 128, 128, 0.6)'; // Gray for 0% change
  }
  return percentChange > 0
    ? 'rgba(22, 199, 132, 0.6)' // Green for positive change
    : 'rgba(207, 43, 43, 0.6)'; // Red for negative change
};

const TrendingRunes = () => {
  const [runes, setRunes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 1600, height: 600 });
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  // Update dimensions based on container size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = Math.max(400, window.innerHeight * 0.6);
        setDimensions({ width: containerWidth, height: containerHeight });
      }
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

    // Scale bubble sizes based on screen width
    const baseMinSize = 400;
    const baseMaxSize = 1000;
    const baseWidth = 1600;  // Our reference width
    const scaleFactor = dimensions.width / baseWidth;
    const MIN_SIZE = baseMinSize * scaleFactor;
    const MAX_SIZE = baseMaxSize * scaleFactor;

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
        const x = radius + margin + Math.random() * (dimensions.width - 2 * (radius + margin));
        const y = radius + margin + Math.random() * (dimensions.height - 2 * (radius + margin));

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
  }, [runes, dimensions]);

  useEffect(() => {
    if (!normalizedData.length) return;

    // Remove any existing tooltips
    d3.select('body').selectAll('.runes-tooltip').remove();

    // Create tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'runes-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '16px')
      .style('border-radius', '8px')
      .style('font-size', '14px')
      .style('max-width', '300px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('border', '1px solid rgba(168, 85, 247, 0.2)')
      .style('backdrop-filter', 'blur(4px)');

    const svg = d3.select(svgRef.current);

    const groups = svg.selectAll('g')
      .data(normalizedData)
      .join('g')
      .on('mouseover', (event, d) => {
        tooltip
          .style('visibility', 'visible')
          .html(
            `<div class="space-y-2">
              <div class="font-bold text-purple-400">${d.rune_name}</div>
              <div class="text-sm space-y-1">
                <div>
                  <span class="text-gray-400">24h Volume:</span>
                  <span class="font-medium">${formatNumber(d.volume)}</span>
                </div>
                <div>
                  <span class="text-gray-400">Price Change:</span>
                  <span class="font-medium ${d.percentChange >= 0 ? 'text-green-400' : 'text-red-400'}">
                    ${d.percentChange.toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span class="text-gray-400">Current Price:</span>
                  <span class="font-medium">${formatNumber(d.unit_price_sats)} sats</span>
                </div>
                <div>
                  <span class="text-gray-400">Holders:</span>
                  <span class="font-medium">${formatNumber(d.holder_count)}</span>
                </div>
              </div>
            </div>`
          );

        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .style('opacity', 0.8);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('top', `${event.pageY + 10}px`)
          .style('left', `${event.pageX + 10}px`);
      })
      .on('mouseout', (event) => {
        tooltip.style('visibility', 'hidden');
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .style('opacity', 1);
      });

    // Update circles and text
    groups.selectAll('circle.glow')
      .data(d => [d])
      .join('circle')
      .attr('class', 'glow')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => d.r + 2)
      .attr('fill', 'transparent')
      .attr('stroke', d => getBubbleStroke(d.percentChange))
      .attr('stroke-width', '2')
      .style('filter', 'blur(3px)');

    groups.selectAll('circle.main')
      .data(d => [d])
      .join('circle')
      .attr('class', 'main')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => d.r)
      .attr('fill', d => getBubbleFill(d.percentChange))
      .attr('opacity', 0.9);

    // Only show names if screen width is large enough
    if (dimensions.width >= 768) {  // 768px is a common tablet breakpoint
      groups.selectAll('text.name')
        .data(d => [d])
        .join('text')
        .attr('class', 'name')
        .attr('x', d => d.x)
        .attr('y', d => d.y - 10)
        .attr('text-anchor', 'middle')
        .attr('font-size', d => Math.max(12, d.r / 5))
        .attr('fill', '#FFFFFF')
        .attr('pointer-events', 'none')
        .text(d => abbreviateName(d.rune_name, 6));
    } else {
      // Remove name texts if screen is too small
      groups.selectAll('text.name').remove();
    }

    groups.selectAll('text.percent')
      .data(d => [d])
      .join('text')
      .attr('class', 'percent')
      .attr('x', d => d.x)
      .attr('y', d => d.y + 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', d => Math.max(10, d.r / 6))
      .attr('fill', d => d.percentChange === 0 ? '#808080' : d.percentChange > 0 ? '#16C784' : '#CF2B2B')
      .attr('pointer-events', 'none')
      .text(d => `${d.percentChange.toFixed(2)}%`);

    return () => {
      d3.select('body').selectAll('.runes-tooltip').remove();
    };
  }, [normalizedData]);

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
    <div
      ref={containerRef}
      className="relative w-full bg-gray-900 rounded-lg overflow-hidden"
    >
      <div className="relative w-full" style={{ height: `${dimensions.height}px` }}>
        <svg
          ref={svgRef}
          className="w-full h-full"
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width={dimensions.width} height={dimensions.height} fill="#111827" />
        </svg>
      </div>
    </div>
  );
};

export default TrendingRunes;