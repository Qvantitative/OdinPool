// app/components/blocks/charts/TransactionTreeMap.js

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const TransactionsTreeMap = ({ transactionData, handleTransactionClick  }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    console.log('Raw transaction data:', transactionData);

    if (!transactionData?.length) {
      console.log('No transaction data available');
      return;
    }

    // Clear any existing SVG content
    d3.select(svgRef.current).selectAll("*").remove();

    // Process and filter valid transactions with corrected confirmation_duration access
    const validTransactions = transactionData.map(tx => {
      const fullTxid = tx.txid;
      const truncatedTxid = `${fullTxid.substring(0, 8)}...${fullTxid.substring(fullTxid.length - 8)}`;

      return {
        txid: truncatedTxid, // Store truncated version
        fullTxid: fullTxid,  // Keep full version if needed
        size: tx.size || 0,
        duration: tx.confirmation_duration?.seconds ||
                 (tx.confirmation_duration?.minutes * 60) ||
                 (tx.confirmation_duration?.hours * 3600) || 0,
        value: tx.size || 0,
        block_height: tx.block_height,
        total_input_value: tx.total_input_value,
        total_output_value: tx.total_output_value,
        fee: tx.fee,
        confirmation_time: tx.confirmation_duration ?
          `${tx.confirmation_duration.hours || 0}h ${tx.confirmation_duration.minutes || 0}m ${tx.confirmation_duration.seconds || 0}s` :
          'Pending'
      };
    }).filter(tx => tx.size > 0);

    console.log('Processed transactions:', validTransactions);

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
    const width = svgRef.current.parentElement.offsetWidth - margin.left - margin.right;
    const height = Math.min(600, width * 0.75);

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create hierarchical data structure
    const data = {
      name: "Transactions",
      children: validTransactions
    };

    // Create treemap layout
    const treemap = d3.treemap()
      .size([width, height])
      .padding(1)
      .round(true);

    const root = d3.hierarchy(data)
      .sum(d => d.size)
      .sort((a, b) => b.value - a.value);

    treemap(root);

    // Create color scale based on confirmation duration
    const colorScale = d3.scaleSequential(d3.interpolateViridis)
      .domain([0, d3.max(validTransactions, d => d.duration || 0)]);

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

    // Add rectangles for each transaction
    const cell = svg.selectAll("g")
      .data(root.leaves())
      .enter().append("g")
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

  cell.append("rect")
      .attr("width", d => Math.max(0, d.x1 - d.x0))
      .attr("height", d => Math.max(0, d.y1 - d.y0))
      .style("fill", d => colorScale(d.data.duration))
      .style("stroke", "#fff")
      .style("stroke-width", "1px")
      .style("cursor", "pointer") // Add cursor pointer
      .on("click", (event, d) => {
        handleTransactionClick(d.data.fullTxid); // Use the full txid for navigation
      })
      .on("mouseover", (event, d) => {
        tooltip.style("visibility", "visible")
          .html(`
            <div>
              <strong>Transaction:</strong> ${d.data.txid}<br/>
              <strong>Block Height:</strong> ${d.data.block_height}<br/>
              <strong>Size:</strong> ${d.data.size.toLocaleString()} bytes<br/>
              <strong>Fee:</strong> ${d.data.fee.toLocaleString()} sat/vB<br/>
              <strong>Input:</strong> ${Number(d.data.total_input_value).toLocaleString()} BTC<br/>
              <strong>Output:</strong> ${Number(d.data.total_output_value).toLocaleString()} BTC<br/>
              <strong>Confirmation Time:</strong> ${d.data.confirmation_time}
            </div>
          `);
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .style("stroke-width", "2px")
          .style("opacity", 0.8);
      })
      .on("mousemove", (event) => {
        tooltip
          .style("top", `${event.pageY - 10}px`)
          .style("left", `${event.pageX + 10}px`);
      })
      .on("mouseout", (event) => {
        tooltip.style("visibility", "hidden");
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .style("stroke-width", "1px")
          .style("opacity", 1);
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
  }, [transactionData, handleTransactionClick]);

  return (
    <div className="bg-gray-900 p-4 rounded-lg">
      <h3 className="text-xl font-semibold mb-4 text-center text-white">
        Transaction Size Distribution
      </h3>
      <div className="overflow-auto">
        <svg ref={svgRef} className="w-full" style={{ minWidth: '960px' }}></svg>
      </div>
      <div className="mt-4 text-center text-sm text-gray-400">
        Hover over rectangles to see transaction details. Color intensity represents confirmation duration, size represents transaction size in bytes.
      </div>
    </div>
  );
};

export default TransactionsTreeMap;