// app/components/blocks/charts/MempoolTreeMap.js

import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';

// Helper function to format bytes into human readable format
const formatBytes = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return '0 vB';
  const sizes = ['vB', 'KvB', 'MvB', 'GvB', 'TvB', 'PvB', 'EvB', 'ZB', 'YvB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  if (i >= sizes.length) return 'Value too large';
  const value = bytes / Math.pow(1024, i);
  return i === 0 ? `${Math.round(value)} ${sizes[i]}` : `${value.toFixed(decimals)} ${sizes[i]}`;
};

const MempoolTreeMap = () => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/mempool');
        if (!response.ok) throw new Error('Failed to fetch data');
        const data = await response.json();
        setTransactions(data);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        // Set a minimum height for mobile
        const minHeight = 300;
        // Calculate aspect ratio based on screen width
        const aspectRatio = window.innerWidth < 768 ? 1 : 1.5;
        const calculatedHeight = Math.max(
          minHeight,
          Math.min(containerRect.width / aspectRatio, window.innerHeight * 0.7)
        );

        setDimensions({
          width: containerRect.width - 32,
          height: calculatedHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Format txid
  const formatTxid = (txid) => `${txid.substring(0, 8)}...${txid.substring(txid.length - 8)}`;

  // Process data for D3
  const processedData = useMemo(() => {
    if (!transactions.length) return null;
    return {
      name: 'Mempool',
      children: transactions
        .filter((tx) => tx && tx.size > 0)
        .map((tx) => ({
          name: tx.txid.substring(0, 8) + '...',
          size: tx.size,
          value: tx.total_input_value || 0,
          fee: tx.fee || 0,
          timeInMempool: tx.mempool_time
            ? Math.round((Date.now() - new Date(tx.mempool_time).getTime()) / 1000)
            : 0,
          fullTxid: tx.txid,
        })),
    };
  }, [transactions]);

  // D3 Visualization
  useEffect(() => {
    if (!processedData || dimensions.width <= 0 || dimensions.height <= 0 || loading) {
      return;
    }

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();
    d3.select('body').selectAll('.mempool-tooltip').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .attr('viewBox', [0, 0, dimensions.width, dimensions.height]);

    const root = d3
      .hierarchy(processedData)
      .sum((d) => d.size)
      .sort((a, b) => b.value - a.value);

    const treemap = d3
      .treemap()
      .size([dimensions.width, dimensions.height])
      .paddingOuter(3)
      .paddingInner(1)
      .round(true);

    treemap(root);

    const maxTimeInMempool = d3.max(root.leaves(), (d) => d.data.timeInMempool) || 1;
    const colorScale = d3
      .scaleSequential(d3.interpolateViridis)
      .domain([maxTimeInMempool, 0]);

    // Mobile-friendly tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'mempool-tooltip')
      .style('position', 'fixed') // Changed from absolute to fixed
      .style('visibility', 'hidden')
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '12px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('max-width', '90vw') // Limited by viewport width
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.1)')
      .style('word-wrap', 'break-word'); // Allow text wrapping

    const cells = svg
      .selectAll('g')
      .data(root.leaves())
      .join('g')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

    const handleTooltipPosition = (event) => {
      const tooltipWidth = 250; // Approximate tooltip width
      const tooltipHeight = 150; // Approximate tooltip height
      const padding = 10;

      let left = event.pageX + padding;
      let top = event.pageY + padding;

      // Adjust position if tooltip would overflow viewport
      if (left + tooltipWidth > window.innerWidth) {
        left = window.innerWidth - tooltipWidth - padding;
      }
      if (top + tooltipHeight > window.innerHeight) {
        top = window.innerHeight - tooltipHeight - padding;
      }

      return { left, top };
    };

    cells
      .append('rect')
      .attr('width', (d) => Math.max(1, d.x1 - d.x0))
      .attr('height', (d) => Math.max(1, d.y1 - d.y0))
      .attr('fill', (d) => colorScale(d.data.timeInMempool))
      .attr('opacity', 1)
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .on('touchstart mouseover', function (event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('stroke-width', 2)
          .attr('opacity', 0.8);

        tooltip
          .style('visibility', 'visible')
          .html(
            `<div>
              <strong>Transaction:</strong> ${formatTxid(d.data.fullTxid)}<br/>
              <strong>Size:</strong> ${formatBytes(d.data.size)}<br/>
              <strong>Fee:</strong> ${d.data.fee.toLocaleString()} sats<br/>
              <strong>Fee Rate:</strong> ${(d.data.fee / d.data.size).toFixed(2)} sats/B<br/>
              <strong>Time in Mempool:</strong> ${d.data.timeInMempool} seconds
            </div>`
          );

        const { left, top } = handleTooltipPosition(event);
        tooltip
          .style('left', `${left}px`)
          .style('top', `${top}px`);
      })
      .on('touchend mouseout', function() {
        tooltip.style('visibility', 'hidden');
        d3.select(this)
          .transition()
          .duration(200)
          .attr('stroke-width', 1)
          .attr('opacity', 1);
      });

    // Add labels only for rectangles that are large enough
    cells
      .filter(d => {
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
        // Adjust minimum sizes based on screen width
        const minWidth = window.innerWidth < 768 ? 30 : 40;
        const minHeight = window.innerWidth < 768 ? 15 : 20;
        return width > minWidth && height > minHeight;
      })
      .append('text')
      .attr('x', 4)
      .attr('y', 14)
      .text(d => d.data.name)
      .attr('fill', 'white')
      .attr('font-size', window.innerWidth < 768 ? '8px' : '10px');

    return () => {
      d3.select('body').selectAll('.mempool-tooltip').remove();
    };
  }, [processedData, dimensions, loading]);

  return (
    <div className="w-full h-full bg-gray-900 p-4">
      <h2 className="text-2xl font-bold text-white mb-4">
        Latest Unconfirmed Transactions
      </h2>
      <div
        ref={containerRef}
        className="w-full relative rounded-lg"
        style={{
          minHeight: '300px',
          height: '100%'
        }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-white">Loading...</div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-red-400">Error: {error}</div>
          </div>
        )}
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ display: 'block' }}
        />
      </div>
    </div>
  );
};

export default MempoolTreeMap;