// app/components/blocks/charts/TransactionTreeMap.js

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

const TransactionsTreeMap = ({ transactionData }) => {
  const svgRef = useRef(null);
  const [detailedData, setDetailedData] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Fetch detailed data for each transaction
  useEffect(() => {
    const fetchTransactionDetails = async (transaction) => {
      try {
        const response = await fetch(`/api/transactions/${transaction.txid}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setDetailedData(prev => ({
          ...prev,
          [transaction.txid]: data
        }));
      } catch (error) {
        console.error(`Error fetching details for ${transaction.txid}:`, error);
      }
    };

    const fetchAllTransactions = async () => {
      setIsLoading(true);
      await Promise.all(transactionData.map(fetchTransactionDetails));
      setIsLoading(false);
    };

    if (transactionData?.length) {
      fetchAllTransactions();
    }
  }, [transactionData]);

  // Main visualization effect
  useEffect(() => {
    if (isLoading || !transactionData?.length) return;

    // Clear any existing SVG content
    d3.select(svgRef.current).selectAll("*").remove();

    // Process and filter valid transactions
    const validTransactions = transactionData
      .map(tx => {
        const txDetails = detailedData[tx.txid];
        const duration = txDetails?.transaction?.confirmation_duration;
        const durationInSeconds = duration ?
          (duration.hours * 3600) + (duration.minutes * 60) + duration.seconds + (duration.milliseconds / 1000) :
          0;

        return {
          txid: tx.txid,
          size: tx.size || 0,
          durationInSeconds,
          confirmationDuration: duration,
          value: tx.size || 0,
          block_height: tx.block_height,
          total_input_value: tx.total_input_value,
          total_output_value: tx.total_output_value,
          fee: tx.fee
        };
      })
      .filter(tx => tx.size > 0 && tx.durationInSeconds > 0)
      .sort((a, b) => b.durationInSeconds - a.durationInSeconds);

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
        .text("No transaction data available");

      return;
    }

    // Set up dimensions
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const width = 960 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Group transactions by duration ranges
    const durationRanges = [0, 60, 300, 600, 1800, 3600, Infinity]; // ranges in seconds
    const durationLabels = ["<1m", "1-5m", "5-10m", "10-30m", "30-60m", ">60m"];

    // Create hierarchical data structure with duration groups
    const groupedData = {
      name: "Transactions",
      children: durationRanges.slice(0, -1).map((min, i) => {
        const max = durationRanges[i + 1];
        const groupTransactions = validTransactions.filter(tx =>
          tx.durationInSeconds >= min && tx.durationInSeconds < max
        );

        return {
          name: durationLabels[i],
          children: groupTransactions,
          durationMin: min
        };
      }).filter(group => group.children.length > 0) // Remove empty groups
    };

    // Create treemap layout
    const treemap = d3.treemap()
      .size([width, height])
      .padding(1)
      .round(true);

    const root = d3.hierarchy(groupedData)
      .sum(d => d.size) // Use transaction size for rectangle area
      .sort((a, b) => {
        if (!a.data.durationMin || !b.data.durationMin) return 0;
        return a.data.durationMin - b.data.durationMin; // Sort groups by duration
      });

    treemap(root);

    // Color scale based on confirmation duration
    const colorScale = d3.scaleSequential(d3.interpolateReds)
      .domain([0, d3.max(validTransactions, d => d.durationInSeconds)]);

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
      .style("pointer-events", "none")
      .style("z-index", "1000");

    // Add group labels
    svg.selectAll("text.group")
      .data(root.children)
      .enter()
      .append("text")
      .attr("class", "group")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0 + 20)
      .attr("fill", "white")
      .attr("font-size", "14px")
      .text(d => `${d.data.name} (${d.children.length})`);

    // Add rectangles for each transaction
    const cell = svg.selectAll("g.cell")
      .data(root.leaves())
      .enter()
      .append("g")
      .attr("class", "cell")
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

    cell.append("rect")
      .attr("width", d => Math.max(0, d.x1 - d.x0))
      .attr("height", d => Math.max(0, d.y1 - d.y0))
      .style("fill", d => colorScale(d.data.durationInSeconds))
      .style("stroke", "#fff")
      .style("stroke-width", "1px")
      .on("mouseover", (event, d) => {
        const duration = d.data.confirmationDuration;
        const durationText = duration ?
          `${duration.hours}h ${duration.minutes}m ${duration.seconds}s` :
          'Unknown';

        tooltip.style("visibility", "visible")
          .html(`
            <div>
              <strong>Transaction ID:</strong><br/>
              <span style="font-size: 10px;">${d.data.txid}</span><br/>
              <strong>Block Height:</strong> ${d.data.block_height}<br/>
              <strong>Size:</strong> ${d.data.size} bytes<br/>
              <strong>Duration:</strong> ${durationText}<br/>
              <strong>Fee:</strong> ${d.data.fee} sat/vB<br/>
              <strong>Input:</strong> ${d.data.total_input_value} BTC<br/>
              <strong>Output:</strong> ${d.data.total_output_value} BTC
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

    // Add size labels to larger rectangles
    cell.append("text")
      .filter(d => (d.x1 - d.x0) > 60 && (d.y1 - d.y0) > 30)
      .attr("x", d => (d.x1 - d.x0) / 2)
      .attr("y", d => (d.y1 - d.y0) / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", "10px")
      .style("fill", "white")
      .style("pointer-events", "none")
      .text(d => `${d.data.size}b`);

    // Cleanup
    return () => {
      tooltip.remove();
    };
  }, [transactionData, detailedData, isLoading]);

  if (isLoading) {
    return (
      <div className="bg-gray-900 p-4 rounded-lg">
        <h3 className="text-xl font-semibold mb-4 text-center text-white">
          Loading Transaction Data...
        </h3>
        <div className="flex justify-center items-center h-[600px]">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 p-4 rounded-lg">
      <h3 className="text-xl font-semibold mb-4 text-center text-white">
        Transaction Size & Confirmation Duration Distribution
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