// app/components/blocks/BubbleMaps.js

"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';

const collections = ['bitcoin-puppets',  'nodemonkes', 'basedangels', 'quantum_cats'];

const Tooltip = ({ holder, x, y }) => {
  if (!holder) return null;

  return (
    <div
      className="absolute z-50 bg-black/90 rounded-lg p-4 shadow-xl border border-purple-500/20 backdrop-blur-sm text-white pointer-events-none"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        maxWidth: '300px',
        transform: 'translate(-50%, -120%)'
      }}
    >
      <div className="space-y-2">
        <div className="font-bold text-purple-400">Rank #{holder.rank}</div>
        <div className="text-sm space-y-1">
          <div>
            <span className="text-gray-400">Address:</span>{' '}
            <span className="font-mono text-xs">{`${holder.address.slice(0, 6)}...${holder.address.slice(-4)}`}</span>
          </div>
          <div>
            <span className="text-gray-400">Holdings:</span>{' '}
            <span className="font-medium">{holder.holding_count}</span>
          </div>
          <div>
            <span className="text-gray-400">Total Supply:</span>{' '}
            <span className="font-medium">{holder.total_project_supply}</span>
          </div>
          <div>
            <span className="text-gray-400">Percentage:</span>{' '}
            <span className="font-medium text-purple-300">
              {((holder.holding_count / holder.total_project_supply) * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const BubbleMaps = ({
  projectRankings = [],
  rankingsLoading,
  rankingsError,
  selectedCollection,
  onCollectionChange,
}) => {
  const containerRef = useRef(null);
  const [selectedHolder, setSelectedHolder] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Initialize container and set dimensions
  const initializeContainer = useCallback((node) => {
    if (node !== null) {
      containerRef.current = node;
      setDimensions({
        width: node.offsetWidth,
        height: window.innerHeight * 0.8,
      });
    }
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: window.innerHeight * 0.8,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generate pseudo-random number for bubble positioning
  const getPseudoRandomNumber = (seed) => {
    let x = 0;
    for (let i = 0; i < seed.length; i++) {
      x = (x << 5) - x + seed.charCodeAt(i);
      x |= 0;
    }
    return (x >>> 0) / 4294967295;
  };

  // Calculate bubble properties based on holder data
  const getBubbleProperties = useCallback((holder) => {
    if (holder.rank > 100) return null;

    const totalSupply = holder.total_project_supply;
    const holdingPercentage = holder.holding_count / totalSupply;

    const minRadius = 6;
    const maxRadius = 40;
    const maxHoldingCount = Math.max(...projectRankings.map((h) => h.holding_count));
    const holdingRatio = holder.holding_count / maxHoldingCount;
    const radius = minRadius + (maxRadius - minRadius) * holdingRatio;

    const centerPullFactor = holdingRatio;
    const angle = getPseudoRandomNumber(holder.address) * Math.PI * 2;
    const randomFactor = getPseudoRandomNumber('distance' + holder.address);

    const maxDistance = Math.min(dimensions.width, dimensions.height) * 0.45;
    const distance = maxDistance * Math.pow(1 - centerPullFactor, 0.7) * (0.6 + randomFactor * 0.4);

    const x = dimensions.width / 2 + Math.cos(angle) * distance;
    const y = dimensions.height / 2 + Math.sin(angle) * distance;

    let color;
    if (holder.rank <= 3) {
      color = 'rgba(77, 255, 77, 0.7)'; // Top 3 - bright green
    } else if (holder.rank <= 10) {
      color = 'rgba(255, 77, 77, 0.7)'; // Top 4-10 - bright red
    } else if (holder.rank <= 50) {
      color = 'rgba(147, 51, 234, 0.6)'; // Top 11-50 - medium purple
    } else {
      color = 'rgba(147, 51, 234, 0.4)'; // Top 51-100 - light purple
    }

    return {
      radius,
      x,
      y,
      color,
      holdingPercentage: (holdingPercentage * 100).toFixed(2),
    };
  }, [dimensions, projectRankings]);

  // Generate bubble properties list
  const bubblePropsList = useMemo(() => {
    if (!projectRankings || projectRankings.length === 0 || dimensions.width === 0) return [];
    return projectRankings
      .filter((holder) => holder.rank <= 100)
      .map((holder) => ({
        holder,
        bubbleProps: getBubbleProperties(holder),
      }))
      .filter((item) => item.bubbleProps !== null);
  }, [projectRankings, dimensions.width, getBubbleProperties]);

  // Generate connection lines between bubbles
  const connectionLines = useMemo(() => {
    const connections = [];
    const maxConnections = 2;

    bubblePropsList.forEach((item1, i) => {
      const { holder: holder1, bubbleProps: props1 } = item1;

      const clusterSize = 10;
      const currentCluster = Math.floor(holder1.rank / clusterSize);

      const neighbors = bubblePropsList
        .slice(i + 1)
        .filter(({ holder: h2 }) => {
          const neighborCluster = Math.floor(h2.rank / clusterSize);
          return Math.abs(currentCluster - neighborCluster) <= 1;
        })
        .slice(0, maxConnections);

      neighbors.forEach(({ holder: holder2, bubbleProps: props2 }) => {
        const midX = (props1.x + props2.x) / 2;
        const midY = (props1.y + props2.y) / 2;
        const dx = props2.x - props1.x;
        const dy = props2.y - props1.y;
        const normalX = -dy * 0.2;
        const normalY = dx * 0.2;

        connections.push(
          <g key={`${holder1.address}-${holder2.address}`}>
            <path
              d={`M ${props1.x} ${props1.y}
                  Q ${midX + normalX} ${midY + normalY} ${props2.x} ${props2.y}`}
              stroke="rgba(147, 51, 234, 0.2)"
              strokeWidth={1}
              fill="none"
              className="transition-all duration-300"
            />
            <circle
              cx={midX + normalX}
              cy={midY + normalY}
              r={1}
              fill="rgba(147, 51, 234, 0.4)"
            />
          </g>
        );
      });
    });

    return connections;
  }, [bubblePropsList]);

  // Handle bubble hover events
  const handleBubbleHover = useCallback((holder, x, y) => {
    setSelectedHolder(holder);
    setTooltipPosition({ x, y });
  }, []);

  // Loading state
  if (rankingsLoading) {
    return (
      <div className="w-full h-screen bg-[#13111C] flex flex-col items-center justify-center">
        <div className="absolute top-4 right-4 z-10">
          <select
            className="bg-black/80 text-white p-2 rounded-lg border border-white/20"
            value={selectedCollection || ''}
            onChange={(e) => onCollectionChange?.(e.target.value)}
          >
            <option value="">Select Collection</option>
            {collections.map(collection => (
              <option key={collection} value={collection}>
                {collection}
              </option>
            ))}
          </select>
        </div>
        <div className="text-white text-lg">Loading rankings data...</div>
      </div>
    );
  }

  // Error state
  if (rankingsError) {
    return (
      <div className="w-full h-screen bg-[#13111C] flex flex-col items-center justify-center">
        <div className="absolute top-4 right-4 z-10">
          <select
            className="bg-black/80 text-white p-2 rounded-lg border border-white/20"
            value={selectedCollection || ''}
            onChange={(e) => onCollectionChange?.(e.target.value)}
          >
            <option value="">Select Collection</option>
            {collections.map(collection => (
              <option key={collection} value={collection}>
                {collection}
              </option>
            ))}
          </select>
        </div>
        <div className="text-red-500 text-lg">Error: {rankingsError}</div>
      </div>
    );
  }

  // Empty state
  if (!projectRankings?.length) {
    return (
      <div className="w-full h-screen bg-[#13111C] flex flex-col items-center justify-center">
        <div className="absolute top-4 right-4 z-10">
          <select
            className="bg-black/80 text-white p-2 rounded-lg border border-white/20"
            value={selectedCollection || ''}
            onChange={(e) => onCollectionChange?.(e.target.value)}
          >
            <option value="">Select Collection</option>
            {collections.map(collection => (
              <option key={collection} value={collection}>
                {collection}
              </option>
            ))}
          </select>
        </div>
        <div className="text-white text-lg">
          {selectedCollection ?
            `No rankings available for ${selectedCollection}` :
            'Please select a collection'
          }
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div
      ref={initializeContainer}
      className="w-full h-full bg-gray-800 relative overflow-hidden rounded-lg shadow-lg"
    >
      <div className="absolute top-4 right-4 z-10">
        <select
          className="bg-black/80 text-white p-2 rounded-lg border border-white/20"
          value={selectedCollection || ''}
          onChange={(e) => onCollectionChange?.(e.target.value)}
        >
          <option value="">Select Collection</option>
          {collections.map(collection => (
            <option key={collection} value={collection}>
              {collection}
            </option>
          ))}
        </select>
      </div>

      <Tooltip
        holder={selectedHolder}
        x={tooltipPosition.x}
        y={tooltipPosition.y}
      />

      {dimensions.width > 0 && (
        <svg width={dimensions.width} height={dimensions.height}>
          <defs>
            <radialGradient id="bg-gradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(147, 51, 234, 0.1)" />
              <stop offset="100%" stopColor="rgba(147, 51, 234, 0)" />
            </radialGradient>
          </defs>

          <circle
            cx={dimensions.width / 2}
            cy={dimensions.height / 2}
            r={dimensions.width * 0.3}
            fill="url(#bg-gradient)"
            className="animate-pulse"
          />

          <g className="connections">{connectionLines}</g>

          <g className="bubbles">
            {bubblePropsList.map(({ holder, bubbleProps }) => {
              const { radius, x, y, color } = bubbleProps;

              return (
                <g
                  key={holder.address}
                  className="holder-bubble group"
                  onMouseEnter={() => handleBubbleHover(holder, x, y)}
                  onMouseLeave={() => setSelectedHolder(null)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + 2}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.3)"
                    strokeWidth={2}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={color}
                    className="cursor-pointer"
                  />
                </g>
              );
            })}
          </g>
        </svg>
      )}

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
      </div>
    </div>
  );
};

export default BubbleMaps;