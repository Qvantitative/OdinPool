import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const TransactionsTreeMap = ({ transactionData }) => {
  const svgRef = useRef(null);
  const [combinedData, setCombinedData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimingData = async () => {
      if (!transactionData?.length) return;

      setLoading(true);
      try {
        // Fetch timing data for all transactions
        const timingPromises = transactionData.map(tx =>
          fetch(`/api/transaction-timing/${tx.txid}`)
            .then(res => res.ok ? res.json() : null)
        );

        const timingResults = await Promise.all(timingPromises);

        // Combine transaction data with timing data
        const combined = transactionData.map((tx, index) => ({
          txid: tx.txid,
          size: tx.size,
          fee: tx.fee,
          confirmation_duration: timingResults[index]?.confirmation_duration || undefined
        }));

        setCombinedData(combined);
      } catch (error) {
        console.error('Error fetching timing data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTimingData();
  }, [transactionData]);

  useEffect(() => {
    if (!combinedData?.length || loading) return;

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

    // Prepare the data with a hierarchical structure
    const data = {
      name: "Transactions",
      children: combinedData.map(tx => ({
        name: tx.txid,
        size: tx.size,
        duration: tx.confirmation_duration,
        fee: tx.fee,
        value: tx.size // Keep size as value for rectangle area
      }))
    };

    // Create the treemap layout with custom sorting
    const treemap = d3.treemap()
      .size([width, height])
      .padding(2)
      .round(true);

    // Create the root node and sort by confirmation duration
    const root = d3.hierarchy(data)
      .sum(d => d.value)
      .sort((a, b) => {
        // Handle undefined values - put them at the top
        if (a.data.duration === undefined && b.data.duration === undefined) return 0;
        if (a.data.duration === undefined) return -1;
        if (b.data.duration === undefined) return 1;
        return b.data.duration - a.data.duration;
      });

    // Generate the treemap layout
    treemap(root);

    // Create color scale based on confirmation duration
    const maxDuration = d3.max(combinedData, d => d.confirmation_duration || 0);
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, maxDuration]);

    // Create tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "treemap-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "rgba(0, 0, 0, 0.95)")
      .style("color", "white")
      .style("padding", "12px")
      .style("border-radius", "6px")
      .style("font-size", "12px")
      .style("max-width", "300px")
      .style("pointer-events", "none")
      .style("border", "1px solid rgba(255, 255, 255, 0.1)")
      .style("box-shadow", "0 4px 6px rgba(0, 0, 0, 0.3)");

    // Add rectangles
    const cell = svg.selectAll("g")
      .data(root.leaves())
      .enter().append("g")
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

    cell.append("rect")
      .attr("width", d => Math.max(0, d.x1 - d.x0))
      .attr("height", d => Math.max(0, d.y1 - d.y0))
      .style("fill", d => d.data.duration === undefined ? "#1a1a1a" : colorScale(d.data.duration))
      .style("stroke", "rgba(255, 255, 255, 0.1)")
      .style("stroke-width", "1px")
      .on("mouseover", (event, d) => {
        tooltip
          .style("visibility", "visible")
          .html(`
            <div>
              <strong>Transaction ID:</strong><br/>
              <span style="font-size: 10px; color: #a0aec0;">${d.data.name}</span><br/>
              <strong>Size:</strong> ${d.data.size} bytes<br/>
              <strong>Fee Rate:</strong> ${d.data.fee} sat/vB<br/>
              <strong>Time to Confirm:</strong> ${d.data.duration === undefined ? 'Unconfirmed' : formatDuration(d.data.duration)}
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
      .style("fill", "rgba(255, 255, 255, 0.8)")
      .style("pointer-events", "none")
      .filter(d => (d.x1 - d.x0) > 60 && (d.y1 - d.y0) > 30)
      .text(d => d.data.duration === undefined ? 'Unconfirmed' : formatDuration(d.data.duration));

    // Cleanup function
    return () => {
      tooltip.remove();
    };
  }, [combinedData, loading]);

  // Helper function to format duration
  const formatDuration = (seconds) => {
    if (!seconds) return 'Unconfirmed';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (loading) {
    return (
      <div className="bg-gray-900 p-4 rounded-lg h-[600px] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 p-4 rounded-lg">
      <h3 className="text-xl font-semibold mb-4 text-center text-white">
        Transaction Confirmation Duration Distribution
      </h3>
      <div className="overflow-auto">
        <svg ref={svgRef} className="w-full" style={{ minWidth: '960px', background: '#121212' }}></svg>
      </div>
      <div className="mt-4 text-center text-sm text-gray-400">
        Rectangle size represents transaction size in bytes. Darker colors indicate longer confirmation times. Black rectangles are unconfirmed transactions.
      </div>
    </div>
  );
};

export default TransactionsTreeMap;