// app/components/blocks/charts/TransactionsTreeMap.js

import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import debounce from 'lodash/debounce';

const TransactionsTreeMap = ({ transactionData }) => {
  const svgRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data validation
  const validData = useMemo(() => {
    if (!Array.isArray(transactionData) || transactionData.length === 0) {
      setError('Invalid or empty transaction data');
      return false;
    }
    return true;
  }, [transactionData]);

  // Process and structure data for the treemap
  const processedData = useMemo(() => {
    if (!validData) return null;

    // Group transactions by block
    const blockGroups = transactionData.reduce((acc, tx) => {
      const blockKey = `Block ${tx.confirmation_duration}s`;
      if (!acc[blockKey]) {
        acc[blockKey] = {
          name: blockKey,
          children: [],
          duration: tx.confirmation_duration
        };
      }
      acc[blockKey].children.push({
        name: tx.txid,
        size: tx.size || 1, // Fallback to 1 if size is not available
        duration: tx.confirmation_duration,
        mempool_time: tx.mempool_time,
        confirmation_time: tx.confirmation_time
      });
      return acc;
    }, {});

    // Sort blocks by confirmation duration (ascending)
    const sortedBlocks = Object.values(blockGroups)
      .sort((a, b) => a.duration - b.duration);

    return {
      name: "Transactions",
      children: sortedBlocks
    };
  }, [transactionData, validData]);

  // Color scale based on confirmation duration
  const colorScale = useMemo(() => {
    if (!validData) return null;
    const maxDuration = Math.max(...transactionData.map(d => d.confirmation_duration));
    return d3.scaleSequential(d3.interpolateBlues)
      .domain([0, maxDuration]);
  }, [transactionData, validData]);

  useEffect(() => {
    if (!validData || !processedData || !svgRef.current) return;

    let isMounted = true;
    setIsLoading(true);

    const render = () => {
      if (!isMounted) return;

      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const container = svgRef.current.parentElement;
      const width = container.clientWidth;
      const height = 600; // Increased height for better visibility

      svg
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .style("font", "10px sans-serif");

      const treemap = d3.treemap()
        .size([width, height])
        .paddingTop(28)
        .paddingRight(4)
        .paddingBottom(4)
        .paddingLeft(4)
        .round(true);

      const root = d3.hierarchy(processedData)
        .sum(d => d.size)
        .sort((a, b) => b.value - a.value);

      treemap(root);

      // Create block title nodes
      const blockNodes = svg.selectAll("g")
        .data(root.children)
        .join("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

      blockNodes.append("rect")
        .attr("fill", "rgba(0,0,0,0.3)")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0);

      blockNodes.append("text")
        .attr("x", 4)
        .attr("y", 20)
        .attr("fill", "white")
        .attr("font-weight", "bold")
        .text(d => `${d.data.name} (${d.children.length} transactions)`);

      // Render transaction cells
      const leaves = root.leaves();
      const chunkSize = 20;
      let currentIndex = 0;

      const renderChunk = () => {
        if (!isMounted) return;

        const chunk = leaves.slice(currentIndex, currentIndex + chunkSize);

        chunk.forEach(d => {
          const cell = svg.append("g")
            .attr("transform", `translate(${d.x0},${d.y0})`);

          cell.append("rect")
            .attr("width", d.x1 - d.x0)
            .attr("height", d.y1 - d.y0)
            .attr("fill", colorScale(d.data.duration))
            .attr("stroke", "#fff")
            .attr("stroke-width", 0.5)
            .append("title")
            .text(`TxID: ${d.data.name}\nSize: ${d.data.size} bytes\nDuration: ${d.data.duration}s`);

          if ((d.x1 - d.x0) > 40 && (d.y1 - d.y0) > 25) {
            cell.append("text")
              .attr("x", 3)
              .attr("y", 12)
              .style("fill", "white")
              .style("font-size", "9px")
              .style("pointer-events", "none")
              .text(`${d.data.size}b`);
          }
        });

        currentIndex += chunkSize;

        if (currentIndex < leaves.length) {
          requestAnimationFrame(renderChunk);
        } else {
          setIsLoading(false);
        }
      };

      requestAnimationFrame(renderChunk);
    };

    const debouncedRender = debounce(render, 100);
    debouncedRender();

    const handleResize = debounce(() => {
      if (isMounted) render();
    }, 250);

    window.addEventListener("resize", handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener("resize", handleResize);
    };
  }, [processedData, colorScale, validData]);

  if (error) {
    return (
      <div className="flex justify-center items-center h-[600px] bg-gray-900 rounded-lg text-red-500">
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[600px] bg-gray-900 rounded-lg">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 p-4 rounded-lg">
      <div className="relative w-full h-[600px]">
        <svg ref={svgRef} className="w-full h-full" />
      </div>
      <div className="mt-2 text-center text-sm text-gray-400">
        Transactions grouped by confirmation duration. Size correlates to transaction size in bytes.
      </div>
    </div>
  );
};

export default TransactionsTreeMap;