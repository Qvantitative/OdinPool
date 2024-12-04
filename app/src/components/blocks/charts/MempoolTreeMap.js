// app/components/blocks/charts/MempoolTreeMap.js

import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';

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

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const minHeight = 300;
        const aspectRatio = window.innerWidth < 768 ? 1 : 1.5;
        const calculatedHeight = Math.max(
          minHeight,
          Math.min(containerRect.width / aspectRatio, window.innerHeight * 0.6)
        );

        setDimensions({
          width: containerRect.width - 16,
          height: calculatedHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const formatTxid = (txid) => `${txid.substring(0, 8)}...${txid.substring(txid.length - 8)}`;

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

  useEffect(() => {
    if (!processedData || dimensions.width <= 0 || dimensions.height <= 0 || loading) {
      return;
    }

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

    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'mempool-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('max-width', '300px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

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
      .attr('stroke', 'white')
      .attr('stroke-width', '1px')
      .on('mouseover', (event, d) => {
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

        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .style('stroke-width', '2px')
          .style('opacity', 0.8);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('top', `${event.pageY - 10}px`)
          .style('left', `${event.pageX + 10}px`);
      })
      .on('mouseout', (event) => {
        tooltip.style('visibility', 'hidden');
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .style('stroke-width', '1px')
          .style('opacity', 1);
      });

    cells
      .filter(d => {
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
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
    <div className="h-full flex flex-col bg-gray-900">
      <div className="flex justify-between items-center p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">Latest Unconfirmed Transactions</h1>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-md text-white transition-colors"
        >
          Refresh
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative rounded-lg"
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-md text-white transition-colors"
              >
                Try Again
              </button>
            </div>
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