// app/components/wallet/charts/BubbleChart.js

"use client";

import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

const BubbleChart = ({ inscriptionStats, statsLoading, statsError }) => {
  const svgRef = useRef();

  useEffect(() => {
    if (statsLoading || statsError) return;
    const svg = d3.select(svgRef.current);

    // Clear any existing SVG content
    svg.selectAll('*').remove();

    const width = 800;
    const height = 600;

    // Define scales
    const xScale = d3.scaleLinear()
      .domain([0, d3.max(inscriptionStats, d => d.holders) + 1000])
      .range([50, width - 50]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(inscriptionStats, d => d.inscriptions) + 1000])
      .range([height - 50, 50]);

    const zScale = d3.scaleLinear()
      .domain([d3.min(inscriptionStats, d => d.z), d3.max(inscriptionStats, d => d.z)])
      .range([5, 50]);

    // Create axes
    const xAxis = d3.axisBottom(xScale).ticks(5);
    const yAxis = d3.axisLeft(yScale).ticks(5);

    // Add axes to the SVG
    svg.append('g')
      .attr('transform', `translate(0,${height - 50})`)
      .call(xAxis);

    svg.append('g')
      .attr('transform', `translate(50,0)`)
      .call(yAxis);

    // Add bubbles
    svg.selectAll("circle")
      .data(inscriptionStats)
      .enter()
      .append("circle")
      .attr("cx", d => xScale(d.holders))
      .attr("cy", d => yScale(d.inscriptions))
      .attr("r", d => zScale(d.z))
      .attr("fill", "#8884d8")
      .attr("opacity", 0.6)
      .on("mouseover", function(event, d) {
        // Show tooltip on hover with black text
        const tooltip = d3.select("#tooltip");
        tooltip
          .style("left", `${event.pageX + 5}px`)
          .style("top", `${event.pageY - 28}px`)
          .style("display", "inline-block")
          .style("color", "black") // Set text color to black
          .html(`
            <strong>${d.name}</strong><br/>
            Holders: ${d.holders.toLocaleString()}<br/>
            Inscriptions: ${d.inscriptions.toLocaleString()}<br/>
            Avg per holder: ${d.avgPerHolder.toFixed(2)}
          `);
      })
      .on("mouseout", function() {
        // Hide tooltip
        d3.select("#tooltip").style("display", "none");
      });

  }, [inscriptionStats, statsLoading, statsError]);

  if (statsLoading) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-white rounded-lg shadow-lg">
        <div className="text-xl text-gray-600">Loading chart data...</div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-white rounded-lg shadow-lg">
        <div className="text-xl text-red-600">Error loading data: {statsError}</div>
      </div>
    );
  }

  return (
    <div className="relative">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Project Distribution</h2>
      <svg ref={svgRef} width="800" height="600" />
      {/* Tooltip div */}
      <div id="tooltip" className="absolute bg-white p-2 rounded shadow-lg border" style={{ display: "none", color: "black" }} />
    </div>
  );
};

export default BubbleChart;
