import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

// Function to calculate the transaction rate
const calculateTransactionRate = (blockData) => {
  return blockData.map((block, index) => {
    if (index === 0) return { x: new Date(block.timestamp), y: 0 }; // Skip the first block as there's no previous data to compare

    const previousBlock = blockData[index - 1];
    const timeInterval = (new Date(block.timestamp) - new Date(previousBlock.timestamp)) / 3600000; // Convert time interval to hours

    if (timeInterval === 0) return { x: new Date(block.timestamp), y: 0 }; // Avoid division by zero

    const transactionRate = block.transactions / timeInterval;

    return {
      x: new Date(block.timestamp),
      y: transactionRate,
    };
  });
};

const TransactionRateChart = ({ blockData }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(chartRef.current);
    svg.selectAll("*").remove(); // Clear previous content

    // Get the last 144 blocks and calculate transaction rates
    const last144Blocks = blockData.slice(-144);
    const transactionRateData = calculateTransactionRate(last144Blocks);

    // Set dimensions and margins
    const margin = { top: 50, right: 30, bottom: 50, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Append a group element for margins
    const g = svg
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Define scales
    const x = d3
      .scaleTime()
      .domain(d3.extent(transactionRateData, (d) => d.x))
      .range([0, width]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(transactionRateData, (d) => d.y)])
      .nice()
      .range([height, 0]);

    // Define axes
    const xAxis = d3.axisBottom(x).ticks(10).tickFormat(d3.timeFormat("%b %d, %Y %H:%M"));
    const yAxis = d3.axisLeft(y);

    // Add X axis
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    // Add Y axis
    g.append("g").call(yAxis);

    // Add gridlines
    g.append("g")
      .attr("class", "grid")
      .call(
        d3.axisLeft(y)
          .tickSize(-width)
          .tickFormat("")
      )
      .selectAll("line")
      .attr("stroke", "rgba(200, 200, 200, 0.2)");

    // Add line
    g.append("path")
      .datum(transactionRateData)
      .attr("fill", "none")
      .attr("stroke", "rgba(54, 162, 235, 1)")
      .attr("stroke-width", 2)
      .attr("d", d3
        .line()
        .x((d) => x(d.x))
        .y((d) => y(d.y))
      );

    // Add title
    svg
      .append("text")
      .attr("x", width / 2 + margin.left)
      .attr("y", margin.top / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .text("Transaction Rate (per Hour) - Last 144 Blocks");
  }, [blockData]);

  return <svg ref={chartRef}></svg>;
};

export default TransactionRateChart;
