// app/components/blocks/charts/MempoolTreeMap.js

import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';

const MempoolTreeMap = () => {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [transactions, setTransactions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 }); // Set default dimensions
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
          width: Math.max(width, 100), // Ensure minimum width
          height: Math.max(height, 100) // Ensure minimum height
        });
      }
    };

    // Initial update
    updateDimensions();

    // Add resize observer
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Add window resize listener as backup
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

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Set viewBox for better scaling
    svg
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const root = d3
      .hierarchy(processedData)
      .sum((d) => d.size)
      .sort((a, b) => b.value - a.value);

    const treemap = d3
      .treemap()
      .size([dimensions.width, dimensions.height])
      .paddingOuter(3) // Increased padding
      .paddingInner(2)
      .round(true);

    treemap(root);

    const maxFeeRate = d3.max(root.leaves(), (d) => d.data.fee / d.data.size) || 1;
    const colorScale = d3
      .scaleSequential(d3.interpolateBlues)
      .domain([0, maxFeeRate]);

    // Enhanced tooltip
    const tooltip = d3
      .select(tooltipRef.current)
      .style('position', 'absolute')
      .style('opacity', 0)
      .style('pointer-events', 'none')
      .style('background', 'rgba(255, 255, 255, 0.95)')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('box-shadow', '0 2px 4px rgba(0,0,0,0.2)')
      .style('font-size', '12px')
      .style('color', 'black') // Explicitly set text color to black
      .style('max-width', '300px');

    const cells = svg
      .selectAll('g')
      .data(root.leaves())
      .join('g')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

    cells
      .append('rect')
      .attr('width', (d) => Math.max(0, d.x1 - d.x0))
      .attr('height', (d) => Math.max(0, d.y1 - d.y0))
      .attr('fill', (d) => colorScale(d.data.fee / d.data.size))
      .attr('opacity', 0.9)
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 1).attr('stroke-width', 2);
        tooltip
          .style('opacity', 1)
          .html(
            `<div style="color: black;">
              <strong>Txid:</strong> ${d.data.fullTxid}<br/>
              <strong>Size:</strong> ${d.data.size.toLocaleString()} bytes<br/>
              <strong>Fee:</strong> ${d.data.fee.toLocaleString()} sats<br/>
              <strong>Fee Rate:</strong> ${(d.data.fee / d.data.size).toFixed(2)} sats/byte<br/>
              <strong>Time in Mempool:</strong> ${d.data.timeInMempool} seconds
            </div>`
          );
      })
      .on('mousemove', function (event) {
        const padding = 5; // Reduced padding to position tooltip closer to cursor

        let left = event.pageX + padding;
        let top = event.pageY + padding;

        // Adjust position if tooltip would overflow window
        const tooltipWidth = tooltipRef.current.offsetWidth;
        const tooltipHeight = tooltipRef.current.offsetHeight;

        if (left + tooltipWidth > window.innerWidth) {
          left = event.pageX - tooltipWidth - padding;
        }
        if (top + tooltipHeight > window.innerHeight) {
          top = event.pageY - tooltipHeight - padding;
        }

        tooltip
          .style('left', `${left}px`)
          .style('top', `${top}px`);
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 0.9).attr('stroke-width', 1);
        tooltip.style('opacity', 0);
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
  }, [processedData, dimensions, loading]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-slate-100 rounded-lg p-4"
      style={{
        minHeight: '500px',
        minWidth: '300px'
      }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50">
          <div className="text-gray-600">Loading...</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50">
          <div className="text-red-600">Error: {error}</div>
        </div>
      )}
      <svg ref={svgRef} className="w-full h-full" />
      <div ref={tooltipRef} />
    </div>
  );
};

export default MempoolTreeMap;