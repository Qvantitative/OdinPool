// app/components/blocks/charts/TransactionsTreeMap.js

import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import debounce from 'lodash/debounce';

const TransactionsTreeMap = ({ transactionData }) => {
  const svgRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  // Add error state
  const [error, setError] = useState(null);

  // Add data validation
  const validData = useMemo(() => {
    if (!Array.isArray(transactionData) || transactionData.length === 0) {
      setError('Invalid or empty transaction data');
      return false;
    }
    return true;
  }, [transactionData]);

  // Optimize data processing with better memoization
  const processedData = useMemo(() => {
    if (!validData) return null;

    // Take only top 50 transactions instead of 100 for initial performance
    const topTransactions = transactionData
      .filter(tx => tx && typeof tx.size === 'number' && typeof tx.fee === 'number')
      .sort((a, b) => b.size - a.size)
      .slice(0, 50);

    return {
      name: "Transactions",
      children: topTransactions.map(tx => ({
        name: tx.txid,
        size: tx.size,
        fee: tx.fee,
        totalFee: (tx.fee * tx.size / 100000000).toFixed(8)
      }))
    };
  }, [transactionData, validData]);

  // Optimize color scale calculation
  const colorScale = useMemo(() => {
    if (!validData) return null;
    const maxSize = Math.max(...transactionData.map(d => d.size));
    return d3.scaleSequential(d3.interpolateBlues)
      .domain([0, maxSize]);
  }, [transactionData, validData]);

  useEffect(() => {
    if (!validData || !processedData || !svgRef.current) return;

    let isMounted = true;
    setIsLoading(true);

    // Break down rendering into smaller chunks using requestAnimationFrame
    const render = () => {
      if (!isMounted) return;

      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const container = svgRef.current.parentElement;
      const width = container.clientWidth;
      const height = 400;

      svg
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .style("font", "10px sans-serif");

      const treemap = d3.treemap()
        .size([width, height])
        .padding(1)
        .round(true);

      const root = d3.hierarchy(processedData)
        .sum(d => d.size)
        .sort((a, b) => b.value - a.value);

      treemap(root);

      // Split rendering into chunks
      const leaves = root.leaves();
      const chunkSize = 10;
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
            .attr("fill", colorScale(d.data.size))
            .attr("stroke", "#fff")
            .attr("stroke-width", 1);

          if ((d.x1 - d.x0) > 40 && (d.y1 - d.y0) > 25) {
            cell.append("text")
              .attr("x", 3)
              .attr("y", 12)
              .style("fill", "white")
              .style("font-size", "10px")
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

    // Debounce the initial render
    const debouncedRender = debounce(render, 100);
    debouncedRender();

    // Optimize resize handler
    const handleResize = debounce(() => {
      if (isMounted) {
        render();
      }
    }, 250);

    window.addEventListener("resize", handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener("resize", handleResize);
    };
  }, [processedData, colorScale, validData]);

  if (error) {
    return (
      <div className="flex justify-center items-center h-[400px] bg-gray-900 rounded-lg text-red-500">
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[400px] bg-gray-900 rounded-lg">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 p-4 rounded-lg">
      <div className="relative w-full h-[400px]">
        <svg ref={svgRef} className="w-full h-full" />
      </div>
      <div className="mt-2 text-center text-sm text-gray-400">
        Showing top 50 transactions by size. Hover for details.
      </div>
    </div>
  );
};

export default TransactionsTreeMap;