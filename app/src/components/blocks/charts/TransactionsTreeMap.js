import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const TransactionsTreeMap = ({ transactionData }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!transactionData?.length) return;

    // Clear any existing SVG content
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up dimensions
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const width = 960 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    // Create the SVG container
    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Prepare the data
    const data = {
      name: "Transactions",
      children: transactionData.map(tx => ({
        name: tx.txid,
        size: tx.size,
        fee: tx.fee,
        totalFee: (tx.fee * tx.size / 100000000).toFixed(8)
      }))
    };

    // Create the treemap layout
    const treemap = d3.treemap()
      .size([width, height])
      .padding(1);

    // Create the root node
    const root = d3.hierarchy(data)
      .sum(d => d.size)
      .sort((a, b) => b.value - a.value);

    // Generate the treemap layout
    treemap(root);

    // Create color scale
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, d3.max(transactionData, d => d.size)]);

    // Create tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "treemap-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "rgba(0, 0, 0, 0.9)")
      .style("color", "white")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("max-width", "300px")
      .style("pointer-events", "none");

    // Add rectangles
    const cell = svg.selectAll("g")
      .data(root.leaves())
      .enter().append("g")
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

    cell.append("rect")
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .style("fill", d => colorScale(d.data.size))
      .style("stroke", "#fff")
      .style("stroke-width", "1px")
      .on("mouseover", (event, d) => {
        tooltip
          .style("visibility", "visible")
          .html(`
            <div>
              <strong>Transaction ID:</strong><br/>
              <span style="font-size: 10px;">${d.data.name}</span><br/>
              <strong>Size:</strong> ${d.data.size} bytes<br/>
              <strong>Fee Rate:</strong> ${d.data.fee} sat/vB<br/>
              <strong>Total Fee:</strong> ${d.data.totalFee} BTC
            </div>
          `);
      })
      .on("mousemove", (event) => {
        tooltip
          .style("top", (event.pageY - 10) + "px")
          .style("left", (event.pageX + 10) + "px");
      })
      .on("mouseout", () => {
        tooltip.style("visibility", "hidden");
      });

    // Add text labels to larger rectangles
    cell.append("text")
      .attr("x", d => (d.x1 - d.x0) / 2)
      .attr("y", d => (d.y1 - d.y0) / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", "10px")
      .style("fill", "white")
      .style("pointer-events", "none")
      .filter(d => (d.x1 - d.x0) > 60 && (d.y1 - d.y0) > 30)
      .text(d => `${d.data.size}b`);

    // Cleanup function
    return () => {
      tooltip.remove();
    };
  }, [transactionData]);

  return (
    <div className="bg-gray-900 p-4 rounded-lg">
      <h3 className="text-xl font-semibold mb-4 text-center text-white">
        Transaction Size Distribution
      </h3>
      <div className="overflow-auto">
        <svg ref={svgRef} className="w-full" style={{ minWidth: '960px' }}></svg>
      </div>
      <div className="mt-4 text-center text-sm text-gray-400">
        Hover over rectangles to see transaction details. Size of each rectangle represents transaction size in bytes.
      </div>
    </div>
  );
};

export default TransactionsTreeMap;