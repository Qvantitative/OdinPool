// app/components/blocks/charts/TransactionsTreeMap.js

import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import debounce from 'lodash/debounce';

const TransactionsTreeMap = ({ transactionData }) => {
  const svgRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  // Memoize the processed data
  const processedData = useMemo(() => ({
    name: "Transactions",
    // Only take the top 100 largest transactions for initial render
    children: transactionData
      .sort((a, b) => b.size - a.size)
      .slice(0, 100)
      .map(tx => ({
        name: tx.txid,
        size: tx.size,
        fee: tx.fee,
        totalFee: (tx.fee * tx.size / 100000000).toFixed(8)
      }))
  }), [transactionData]);

  // Memoize the color scale
  const colorScale = useMemo(() => {
    return d3.scaleSequential(d3.interpolateBlues)
      .domain([0, d3.max(transactionData, d => d.size) || 0]);
  }, [transactionData]);

  useEffect(() => {
    if (!transactionData?.length || !svgRef.current) return;
    setIsLoading(true);

    // Clear any existing SVG content
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Get actual dimensions from parent container
    const container = svgRef.current.parentElement;
    const width = container.clientWidth;
    const height = 400; // Fixed height for better performance

    // Set up the SVG with the new dimensions
    svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .style("font", "10px sans-serif");

    // Create the treemap layout
    const treemap = d3.treemap()
      .size([width, height])
      .padding(1)
      .round(true);

    // Create the root node and compute the layout
    const root = d3.hierarchy(processedData)
      .sum(d => d.size)
      .sort((a, b) => b.value - a.value);

    // Generate the treemap layout
    treemap(root);

    // Use requestAnimationFrame for smooth rendering
    requestAnimationFrame(() => {
      // Create container for cells
      const cell = svg.selectAll("g")
        .data(root.leaves())
        .join("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

      // Add rectangles
      cell.append("rect")
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr("fill", d => colorScale(d.data.size))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
          // Highlight on hover
          d3.select(this)
            .attr("stroke", "#ffd700")
            .attr("stroke-width", 2);

          const tooltip = d3.select("#treemap-tooltip");
          tooltip
            .style("opacity", 1)
            .html(`
              <div class="bg-gray-800 p-2 rounded shadow">
                <div class="text-xs truncate w-48">${d.data.name}</div>
                <div class="text-sm">Size: ${d.data.size} bytes</div>
                <div class="text-sm">Fee: ${d.data.fee} sat/vB</div>
              </div>
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
          d3.select(this)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1);
          d3.select("#treemap-tooltip").style("opacity", 0);
        });

      // Add labels to larger rectangles
      cell.append("text")
        .attr("x", 3)
        .attr("y", 12)
        .style("fill", "white")
        .style("font-size", "10px")
        .style("pointer-events", "none")
        .filter(d => (d.x1 - d.x0) > 40 && (d.y1 - d.y0) > 25)
        .text(d => `${d.data.size}b`);

      setIsLoading(false);
    });

    // Handle window resize
    const handleResize = debounce(() => {
      const newWidth = container.clientWidth;
      svg
        .attr("width", newWidth)
        .attr("viewBox", [0, 0, newWidth, height]);
    }, 250);

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [processedData, colorScale]);

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
        <div
          id="treemap-tooltip"
          className="absolute pointer-events-none transition-opacity duration-200"
          style={{ opacity: 0 }}
        />
      </div>
      <div className="mt-2 text-center text-sm text-gray-400">
        Showing top 100 transactions by size. Hover for details.
      </div>
    </div>
  );
};

export default TransactionsTreeMap;