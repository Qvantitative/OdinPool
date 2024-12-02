// app/components/blocks/charts/TransactionTreeMap.js

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const TransactionsTreeMap = ({ transactionData }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    console.log('Raw transaction data:', transactionData);

    if (!transactionData?.length) {
      console.log('No transaction data available');
      return;
    }

    // Clear any existing SVG content
    d3.select(svgRef.current).selectAll("*").remove();

    // Process and filter valid transactions
    const validTransactions = transactionData.map(tx => ({
      txid: tx.txid,
      size: tx.size || 0,
      duration: tx.confirmation_duration?.seconds ||
                (tx.confirmation_duration?.minutes * 60) ||
                (tx.confirmation_duration?.hours * 3600) || 0,
      fee: parseFloat(tx.fee) || 0,
      block_height: tx.block_height,
      total_input_value: tx.total_input_value,
      total_output_value: tx.total_output_value,
      confirmation_time: tx.confirmation_duration ?
        `${tx.confirmation_duration.hours || 0}h ${tx.confirmation_duration.minutes || 0}m ${tx.confirmation_duration.seconds || 0}s` :
        'Pending'
    })).filter(tx => tx.size > 0);

    // Sort transactions by duration (descending) and split into rows
    const numRows = 10; // Number of vertical sections
    validTransactions.sort((a, b) => a.duration - b.duration);

    const transactionsPerRow = Math.ceil(validTransactions.length / numRows);
    const rows = Array.from({ length: numRows }, (_, i) => ({
      name: `row-${i}`,
      children: validTransactions.slice(i * transactionsPerRow, (i + 1) * transactionsPerRow)
    }));

    // Create hierarchical data structure
    const data = {
      name: "Transactions",
      children: rows
    };

    if (validTransactions.length === 0) {
      const svg = d3.select(svgRef.current)
        .attr("width", 960)
        .attr("height", 600);

      svg.append("text")
        .attr("x", 480)
        .attr("y", 300)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", "white")
        .style("font-size", "14px")
        .text("Processing transaction data...");

      return;
    }

    // Set up dimensions and create SVG
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const width = 960 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create treemap layout with fixed row heights
    const treemap = d3.treemap()
      .size([width, height])
      .paddingOuter(3)
      .paddingTop(20)
      .paddingInner(2)
      .round(true);

    const root = d3.hierarchy(data)
      .sum(d => d.size); // Size based on transaction bytes

    treemap(root);

    // Create color scale for fees
    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
      .domain([0, d3.max(validTransactions, d => d.fee)]);

    // Create and configure tooltip
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
      .style("pointer-events", "none")
      .style("z-index", "1000");

    // Add row labels with timing information
    svg.selectAll(".row-label")
      .data(root.children)
      .enter()
      .append("text")
      .attr("class", "row-label")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0 - 5)
      .style("font-size", "10px")
      .style("fill", "white")
      .text((d, i) => {
        const minTime = Math.min(...d.leaves().map(leaf => leaf.data.duration));
        const maxTime = Math.max(...d.leaves().map(leaf => leaf.data.duration));
        return `${Math.floor(minTime/60)}-${Math.ceil(maxTime/60)} min`;
      });

    // Add rectangles for each transaction
    const cell = svg.selectAll("g.cell")
      .data(root.leaves())
      .enter().append("g")
      .attr("class", "cell")
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

    cell.append("rect")
      .attr("width", d => Math.max(0, d.x1 - d.x0))
      .attr("height", d => Math.max(0, d.y1 - d.y0))
      .style("fill", d => colorScale(d.data.fee))
      .style("stroke", "#fff")
      .style("stroke-width", "1px")
      .on("mouseover", (event, d) => {
        tooltip.style("visibility", "visible")
          .html(`
            <div>
              <strong>Transaction ID:</strong><br/>
              <span style="font-size: 10px;">${d.data.txid}</span><br/>
              <strong>Block Height:</strong> ${d.data.block_height}<br/>
              <strong>Size:</strong> ${d.data.size} bytes<br/>
              <strong>Fee:</strong> ${d.data.fee} sat/vB<br/>
              <strong>Input:</strong> ${d.data.total_input_value} BTC<br/>
              <strong>Output:</strong> ${d.data.total_output_value} BTC<br/>
              <strong>Confirmation Time:</strong> ${d.data.confirmation_time}
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

    // Cleanup
    return () => {
      tooltip.remove();
    };
  }, [transactionData]);

  return (
    <div className="bg-gray-900 p-4 rounded-lg">
      <h3 className="text-xl font-semibold mb-4 text-center text-white">
        Transaction Distribution
      </h3>
      <div className="overflow-auto">
        <svg ref={svgRef} className="w-full" style={{ minWidth: '960px' }}></svg>
      </div>
      <div className="mt-4 text-center text-sm text-gray-400">
        Hover over rectangles to see transaction details. Transactions are organized by confirmation time (faster at top).
        Rectangle size represents transaction size in bytes, color intensity represents fee rate.
      </div>
    </div>
  );
};

export default TransactionsTreeMap;