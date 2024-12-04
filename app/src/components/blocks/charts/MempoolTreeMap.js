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
        console.log('Fetched transactions:', data);
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
        const newDimensions = {
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        };
        //console.log('Container dimensions:', newDimensions);
        setDimensions(newDimensions);
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
    if (!transactions.length) {
      //console.log('No transactions to process');
      return null;
    }

    const data = {
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
    console.log('Processed data:', data);
    return data;
  }, [transactions]);

  // D3 Visualization
  useEffect(() => {

    if (!processedData || !dimensions.width || !dimensions.height || loading) {
      //console.log('Skipping visualization due to missing requirements');
      return;
    }

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();
    //console.log('Cleared previous visualization');

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', dimensions.width)
      .attr('height', dimensions.height);
    //console.log('Created SVG with dimensions:', dimensions);

    // Create hierarchy
    const root = d3.hierarchy(processedData)
      .sum(d => d.size)
      .sort((a, b) => b.value - a.value);
    console.log('Created hierarchy:', root);

    const treemap = d3.treemap()
      .size([dimensions.width, dimensions.height])
      .paddingOuter(1)
      .paddingInner(1)
      .round(true);

    treemap(root);
    console.log('Applied treemap layout:', root.leaves());

    // Color scale
    const maxFeeRate = d3.max(root.leaves(), d => d.data.fee / d.data.size) || 1;
    console.log('Max fee rate:', maxFeeRate);
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, maxFeeRate]);

    // Draw rectangles
    const cells = svg.selectAll('g')
      .data(root.leaves())
      .join('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);
    //console.log('Created cell groups:', cells.size());

    cells.append('rect')
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => colorScale(d.data.fee / d.data.size))
      .attr('opacity', 0.8)
      .attr('stroke', 'white')
      .attr('stroke-width', 1);

    //console.log('Added rectangles to cells');

  }, [processedData, dimensions, loading]);

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ minHeight: '500px' }}>
      <pre className="absolute top-0 left-0 text-xs">
        Debug Info:
        Dimensions: {JSON.stringify(dimensions)}
        Loading: {loading.toString()}
        Error: {error || 'none'}
        Transactions: {transactions.length}
      </pre>
      <svg ref={svgRef} className="w-full h-full" />
      <div ref={tooltipRef} />
    </div>
  );
};

export default MempoolTreeMap;