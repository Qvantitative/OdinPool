// app/components/blocks/charts/MempoolTreeMap.js

import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';

const MempoolTreeMap = ({ transactionData = [] }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 vB';
    const sizes = ['vB', 'KvB', 'MvB', 'GvB', 'TvB', 'PvB', 'EvB', 'ZB', 'YvB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    if (i >= sizes.length) return 'Value too large';
    const value = bytes / Math.pow(1024, i);
    return i === 0 ? `${Math.round(value)} ${sizes[i]}` : `${value.toFixed(decimals)} ${sizes[i]}`;
  };

  const formatTxid = (txid) => `${txid.substring(0, 8)}...${txid.substring(txid.length - 8)}`;

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const parent = container.parentElement;
        const parentRect = parent.getBoundingClientRect();

        const minDimension = 300;
        const width = Math.max(minDimension, parentRect.width);
        const height = Math.max(minDimension, parentRect.height || window.innerHeight * 0.7);

        setDimensions({ width, height });
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);

    if (containerRef.current?.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const processedData = useMemo(() => {
    if (!transactionData.length) return null;
    return {
      name: 'Transactions',
      children: transactionData
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
  }, [transactionData]);

  useEffect(() => {
    if (!processedData || dimensions.width <= 0 || dimensions.height <= 0) {
      return;
    }

    // Clear previous content
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    d3.select('body').selectAll('.mempool-tooltip').remove();

    // Setup SVG
    svg
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .attr('viewBox', [0, 0, dimensions.width, dimensions.height]);

    // Create tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'mempool-tooltip')
      .style('position', 'fixed')
      .style('visibility', 'hidden')
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '12px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('max-width', '90vw')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.1)')
      .style('word-wrap', 'break-word');

    // Create hierarchy
    const root = d3
      .hierarchy(processedData)
      .sum((d) => d.size)
      .sort((a, b) => b.value - a.value);

    // Create treemap layout
    const treemap = d3
      .treemap()
      .size([dimensions.width, dimensions.height])
      .paddingOuter(3)
      .paddingInner(1)
      .round(true);

    treemap(root);

    // Create color scale
    const maxTimeInMempool = d3.max(root.leaves(), (d) => d.data.timeInMempool) || 1;
    const colorScale = d3
      .scaleSequential(d3.interpolateViridis)
      .domain([maxTimeInMempool, 0]);

    // Handle tooltip positioning
    const handleTooltipPosition = (event) => {
      const tooltipWidth = 250;
      const tooltipHeight = 150;
      const padding = 10;

      let left = event.pageX + padding;
      let top = event.pageY + padding;

      if (left + tooltipWidth > window.innerWidth) {
        left = window.innerWidth - tooltipWidth - padding;
      }
      if (top + tooltipHeight > window.innerHeight) {
        top = window.innerHeight - tooltipHeight - padding;
      }

      return { left, top };
    };

    // Create cells
    const cells = svg
      .selectAll('g')
      .data(root.leaves())
      .join('g')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

    // Add rectangles
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

    // Add labels
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
  }, [processedData, dimensions]);

  return (
    <div className="w-full h-full bg-gray-900 p-4">
      <h2 className="text-xl font-bold text-white mb-4">
        Block Transactions
      </h2>
      <div
        ref={containerRef}
        className="relative rounded-lg overflow-hidden"
      >
        {!transactionData.length && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-white">No transaction data available</div>
          </div>
        )}
        <svg
          ref={svgRef}
          className="w-full h-full"
        />
      </div>
    </div>
  );
};

export default MempoolTreeMap;