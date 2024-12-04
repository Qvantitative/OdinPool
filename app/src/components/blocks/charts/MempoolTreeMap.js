// app/components/blocks/charts/MempoolTreeMap.js

import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';

const MempoolTreeMap = () => {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [transactions, setTransactions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });
  const containerRef = useRef(null);

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
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(width, 100),
          height: Math.max(height, 100)
        });
      }
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateDimensions);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
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

  // D3 Visualization
  useEffect(() => {
    if (!processedData || !dimensions.width || !dimensions.height || loading) {
      return;
    }

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();
    // Remove any existing tooltips
    d3.select('body').selectAll('.mempool-tooltip').remove();

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr('width', dimensions.width)
      .attr('height', dimensions.height);

    // Create hierarchy and treemap layout
    const root = d3
      .hierarchy(processedData)
      .sum((d) => d.size)
      .sort((a, b) => b.value - a.value);

    const treemap = d3
      .treemap()
      .size([dimensions.width, dimensions.height])
      .paddingOuter(1)
      .paddingInner(1)
      .round(true);

    treemap(root);

    // Color scale - Updated to use Viridis
    const maxTimeInMempool = d3.max(root.leaves(), (d) => d.data.timeInMempool) || 1;
    const colorScale = d3
      .scaleSequential(d3.interpolateViridis)
      .domain([0, maxTimeInMempool]);

    // Create tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'mempool-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('max-width', '300px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    // Draw rectangles
    const cells = svg
      .selectAll('g')
      .data(root.leaves())
      .join('g')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

    cells
      .append('rect')
      .attr('width', (d) => Math.max(0, d.x1 - d.x0))
      .attr('height', (d) => Math.max(0, d.y1 - d.y0))
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
              <strong>Txid:</strong> ${d.data.fullTxid}<br/>
              <strong>Size:</strong> ${d.data.size.toLocaleString()} bytes<br/>
              <strong>Fee:</strong> ${d.data.fee.toLocaleString()} sats<br/>
              <strong>Fee Rate:</strong> ${(d.data.fee / d.data.size).toFixed(2)} sats/byte<br/>
              <strong>Time in Mempool:</strong> ${d.data.timeInMempool} seconds
            </div>`
          );
      })
      .on('mousemove', function(event) {
        tooltip
          .style('top', (event.pageY - 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
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

    // Cleanup
    return () => {
      d3.select('body').selectAll('.mempool-tooltip').remove();
    };
  }, [processedData, dimensions, loading]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-gray-900 rounded-lg p-4"
      style={{
        minHeight: '500px',
        minWidth: '300px'
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
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default MempoolTreeMap;