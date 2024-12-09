import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const TimeBasedChart = ({ blockData }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(chartRef.current);
    svg.selectAll("*").remove(); // Clear previous content

    // Select the last 144 blocks and sort by timestamp
    const last144Blocks = blockData.slice(0, 144).sort((a, b) => a.timestamp - b.timestamp);

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
      .domain(d3.extent(last144Blocks, (d) => new Date(d.timestamp)))
      .range([0, width]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(last144Blocks, (d) => d.transactions)])
      .nice()
      .range([height, 0]);

    // Define axes
    const xAxis = d3.axisBottom(x).ticks(10).tickFormat(d3.timeFormat("%b %d, %Y"));
    const yAxis = d3.axisLeft(y);

    // Add X axis
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .style("fill", "#ffffff");

    // Add Y axis
    g.append("g").call(yAxis).selectAll("text").style("fill", "#ffffff");

    // Add gridlines
    g.append("g")
      .attr("class", "grid")
      .call(
        d3.axisLeft(y)
          .tickSize(-width)
          .tickFormat("")
      )
      .selectAll("line")
      .attr("stroke", "rgba(255, 255, 255, 0.1)");

    // Add line
    g.append("path")
      .datum(last144Blocks)
      .attr("fill", "none")
      .attr("stroke", "rgba(75, 192, 192, 1)")
      .attr("stroke-width", 2)
      .attr("d", d3
        .line()
        .x((d) => x(new Date(d.timestamp)))
        .y((d) => y(d.transactions))
      );

    // Add title
    svg
      .append("text")
      .attr("x", width / 2 + margin.left)
      .attr("y", margin.top / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#ffffff")
      .style("font-size", "16px")
      .text("Bitcoin Transactions Over Time (Last 144 Blocks)");
  }, [blockData]);

  return <svg ref={chartRef}></svg>;
};

export default TimeBasedChart;
