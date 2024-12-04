// app/components/blocks/charts/MempoolTreeMap.js

import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';

const MempoolTreeMap = () => {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [transactions, setTransactions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
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
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
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
        .filter(tx => tx && tx.size > 0)
        .map(tx => ({
          name: tx.txid.substring(0, 8) + '...',
          size: tx.size,
          value: tx.total_input_value || 0,
          fee: tx.fee || 0,
          timeInMempool: tx.mempool_time ?
            Math.round((Date.now() - new Date(tx.mempool_time).getTime()) / 1000) : 0,
          fullTxid: tx.txid
        }))
    };
  }, [transactions]);

  // D3 Visualization
  useEffect(() => {
    if (!processedData || !dimensions.width || !dimensions.height || loading) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', dimensions.width)
      .attr('height', dimensions.height);

    // Create tooltip
    const tooltip = d3.select(tooltipRef.current)
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none');

    // Create hierarchy and treemap layout
    const root = d3.hierarchy(processedData)
      .sum(d => d.size)
      .sort((a, b) => b.value - a.value);

    const treemap = d3.treemap()
      .size([dimensions.width, dimensions.height])
      .paddingOuter(1)
      .paddingInner(1)
      .round(true);

    treemap(root);

    // Create color scale based on fee rate
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, d3.max(root.leaves(), d => d.data.fee / d.data.size) || 1]);

    // Draw rectangles
    const cells = svg.selectAll('g')
      .data(root.leaves())
      .join('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    cells.append('rect')
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => colorScale(d.data.fee / d.data.size))
      .attr('opacity', 0.8)
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .on('mouseover', (event, d) => {
        tooltip
          .style('visibility', 'visible')
          .html(`
            <div>
              <strong>TxID:</strong> ${d.data.fullTxid}<br/>
              <strong>Value:</strong> ${d.data.value.toFixed(8)} BTC<br/>
              <strong>Fee:</strong> ${d.data.fee.toFixed(8)} sat/vB<br/>
              <strong>Size:</strong> ${d.data.size} bytes<br/>
              <strong>Time in mempool:</strong> ${d.data.timeInMempool}s
            </div>
          `);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('top', (event.pageY - 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
      })
      .on('mouseout', () => {
        tooltip.style('visibility', 'hidden');
      });

    // Add labels for larger rectangles
    cells.each(function(d) {
      const cell = d3.select(this);
      const width = d.x1 - d.x0;
      const height = d.y1 - d.y0;

      if (width > 60 && height > 50) {
        cell.append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('fill', 'white')
          .attr('font-size', '10px')
          .text(d.data.name);
      }
    });

  }, [processedData, dimensions, loading]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-gray-500">Loading mempool transactions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" />
      <div ref={tooltipRef} />
    </div>
  );
};

export default MempoolTreeMap;