// app/components/blocks/charts/MempoolTreeMap.js

import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';

// Helper function to format bytes into human readable format
const formatBytes = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return '0 vB';

  const sizes = [
    'vB',    // Byte
    'KvB',  // Kilobyte
    'MvB',  // Megabyte
    'GvB',  // Gigabyte
    'TvB',  // Terabyte
    'PvB',  // Petabyte
    'EvB',  // Exabyte
    'ZB',  // Zettabyte
    'YvB'   // Yottabyte
  ];

  // Calculate the appropriate unit
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  // Handle overflow for extremely large numbers
  if (i >= sizes.length) {
    return 'Value too large';
  }

  // Convert to the appropriate unit and format
  const value = bytes / Math.pow(1024, i);

  // Handle special case for bytes (no decimal places needed)
  if (i === 0) {
    return `${Math.round(value)} ${sizes[i]}`;
  }

  return `${value.toFixed(decimals)} ${sizes[i]}`;
};

const MempoolTreeMap = () => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [transactions, setTransactions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });

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
        setDimensions({
          width: containerRect.width - 32,
          height: containerRect.height - 60 // Account for header height
        });
      }
    };

    updateDimensions();

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(updateDimensions);
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

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

  // Helper function to format txid
  const formatTxid = (txid) => {
    return `${txid.substring(0, 8)}...${txid.substring(txid.length - 8)}`;
  };

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
    // Reverse the color scale by swapping the domain values
    const colorScale = d3
      .scaleSequential(d3.interpolateViridis)
      .domain([maxTimeInMempool, 0]);

    // Enhanced tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'mempool-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '12px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('max-width', '300px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.1)');

    const cells = svg
      .selectAll('g')
      .data(root.leaves())
      .join('g')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

    cells
      .append('rect')
      .attr('width', (d) => Math.max(1, d.x1 - d.x0))
      .attr('height', (d) => Math.max(1, d.y1 - d.y0))
      .attr('fill', (d) => colorScale(d.data.timeInMempool))
      .attr('opacity', 1)
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .on('mouseover', function (event, d) {
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
      })
      .on('mousemove', (event) => {
        tooltip
          .style('top', `${event.pageY - 10}px`)
          .style('left', `${event.pageX + 10}px`);
      })
      .on('mouseout', function() {
        tooltip.style('visibility', 'hidden');
        d3.select(this)
          .transition()
          .duration(200)
          .attr('stroke-width', 1)
          .attr('opacity', 1);
      });

    // Add labels for larger rectangles
    cells
      .filter(d => (d.x1 - d.x0) > 40 && (d.y1 - d.y0) > 20)
      .append('text')
      .attr('x', 4)
      .attr('y', 14)
      .text(d => d.data.name)
      .attr('fill', 'white')
      .attr('font-size', '10px');

    return () => {
      d3.select('body').selectAll('.mempool-tooltip').remove();
    };
  }, [processedData, dimensions, loading]);

  return (
    <div className="w-full h-full bg-gray-900 p-4">
      <h2 className="text-2xl font-bold text-white">
        Latest Unconfirmed Transactions
      </h2>
      <div
        ref={containerRef}
        className="w-full h-full relative rounded-lg"
        style={{
          minHeight: '500px',
          minWidth: '300px',
          height: 'calc(100% - 2rem)',
          width: '100%'
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