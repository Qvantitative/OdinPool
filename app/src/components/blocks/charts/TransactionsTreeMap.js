// app/components/blocks/charts/TransactionTreeMap.js

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const TransactionsTreeMap = ({ transactionData }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    // Debug logging
    console.log('Raw transaction data:', transactionData);

    if (!transactionData?.length) {
      console.log('No transaction data available');
      return;
    }

    // Clear any existing SVG content
    d3.select(svgRef.current).selectAll("*").remove();

    // Filter valid transactions and log results
    const validTransactions = transactionData.filter(tx => {
      const isValid = tx && tx.confirmation_duration !== undefined && tx.size;
      if (!isValid) {
        console.log('Invalid transaction:', tx);
      }
      return isValid;
    });

    console.log('Valid transactions:', validTransactions);

    if (validTransactions.length === 0) {
      console.log('No valid transactions with confirmation duration');
      // Display a message in the SVG when no data is available
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
        .text("No confirmation duration data available");

      return;
    }

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

    // Prepare the data with a hierarchical structure
    const data = {
      name: "Transactions",
      children: validTransactions.map(tx => ({
        name: tx.txid,
        size: tx.size || 0,
        duration: tx.confirmation_duration,
        value: tx.size || 0,
        raw: tx // Keep raw data for debugging
      }))
    };

    console.log('Processed hierarchy data:', data);

    // Create the treemap layout
    const treemap = d3.treemap()
      .size([width, height])
      .padding(1)
      .round(true);

    // Create the root node
    const root = d3.hierarchy(data)
      .sum(d => d.value)
      .sort((a, b) => (b.data.duration || 0) - (a.data.duration || 0));

    // Generate the treemap layout
    treemap(root);

    console.log('Treemap layout data:', root);

    // Create color scale
    const maxDuration = d3.max(validTransactions, d => d.confirmation_duration) || 1;
    console.log('Max duration:', maxDuration);

    const colorScale = d3.scaleSequential(d3.interpolateReds)
      .domain([0, maxDuration]);

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
      .attr("width", d => Math.max(0, d.x1 - d.x0))
      .attr("height", d => Math.max(0, d.y1 - d.y0))
      .style("fill", d => colorScale(d.data.duration))
      .style("stroke", "#fff")
      .style("stroke-width", "1px")
      .on("mouseover", (event, d) => {
        console.log('Mouseover data:', d);
        tooltip
          .style("visibility", "visible")
          .html(`
            <div>
              <strong>Transaction ID:</strong><br/>
              <span style="font-size: 10px;">${d.data.name}</span><br/>
              <strong>Size:</strong> ${d.data.size} bytes<br/>
              <strong>Confirmation Duration:</strong> ${d.data.duration}s<br/>
              <strong>Time to Confirm:</strong> ${formatDuration(d.data.duration)}
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
      .text(d => formatDuration(d.data.duration));

    // Add legend
    addLegend(svg, width, height, colorScale, maxDuration);

    // Cleanup function
    return () => {
      tooltip.remove();
    };
  }, [transactionData]);

  // Helper function to format duration
  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Helper function to add legend
  const addLegend = (svg, width, height, colorScale, maxDuration) => {
    const legendHeight = 10;
    const legendWidth = 200;
    const legendX = width - legendWidth - 20;
    const legendY = height - 40;

    const legendScale = d3.scaleLinear()
      .domain([0, maxDuration])
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(formatDuration);

    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
      .attr("id", "duration-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    linearGradient.selectAll("stop")
      .data(colorScale.ticks().map((t, i, n) => ({
        offset: `${100 * i / n.length}%`,
        color: colorScale(t)
      })))
      .enter().append("stop")
      .attr("offset", d => d.offset)
      .attr("stop-color", d => d.color);

    svg.append("g")
      .attr("transform", `translate(${legendX}, ${legendY})`)
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#duration-gradient)");

    svg.append("g")
      .attr("transform", `translate(${legendX}, ${legendY + legendHeight})`)
      .call(legendAxis)
      .append("text")
      .attr("x", legendWidth / 2)
      .attr("y", 35)
      .attr("text-anchor", "middle")
      .style("fill", "white")
      .text("Confirmation Duration");
  };

  return (
    <div className="bg-gray-900 p-4 rounded-lg">
      <h3 className="text-xl font-semibold mb-4 text-center text-white">
        Transaction Confirmation Duration Distribution
      </h3>
      <div className="overflow-auto">
        <svg ref={svgRef} className="w-full" style={{ minWidth: '960px' }}></svg>
      </div>
      <div className="mt-4 text-center text-sm text-gray-400">
        Hover over rectangles to see transaction details. Color indicates confirmation duration, size represents transaction size in bytes.
      </div>
    </div>
  );
};

export default TransactionsTreeMap;