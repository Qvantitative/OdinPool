// app/components/blocks/charts/ProjectActivities.js

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const ProjectActivities = ({ transferIntervals }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    // Clear any previous chart
    d3.select(chartRef.current).selectAll('*').remove();

    // Set up dimensions
    const margin = { top: 20, right: 30, bottom: 50, left: 50 };
    const width = chartRef.current.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Append SVG
    const svg = d3
      .select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .style('overflow', 'visible')
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Prepare data
    const data = transferIntervals.map((item) => ({
      time_interval: item.time_interval,
      transfer_count: parseInt(item.transfer_count, 10),
    }));

    // Sort data to ensure consistent order
    const intervalOrder = { '10m': 1, '30m': 2, '1hr': 3, '4hr': 4 };
    data.sort(
      (a, b) => intervalOrder[a.time_interval] - intervalOrder[b.time_interval]
    );

    // Set up scales
    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.time_interval))
      .range([0, width])
      .padding(0.2);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.transfer_count)])
      .nice()
      .range([height, 0]);

    // Add X axis
    svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('dy', '1em')
      .attr('dx', '-0.5em')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .style('fill', '#ccc');

    // Add Y axis
    svg
      .append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('fill', '#ccc');

    // Add bars
    svg
      .selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', (d) => x(d.time_interval))
      .attr('y', (d) => y(d.transfer_count))
      .attr('width', x.bandwidth())
      .attr('height', (d) => height - y(d.transfer_count))
      .attr('fill', '#8884d8');

    // Add labels above bars
    svg
      .selectAll('.label')
      .data(data)
      .enter()
      .append('text')
      .text((d) => d.transfer_count)
      .attr('x', (d) => x(d.time_interval) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.transfer_count) - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff');

    // Add chart title
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('fill', '#fff')
      .text('Project Activities Over Intervals');
  }, [transferIntervals]);

  return (
    <div className="p-4 bg-gray-700 rounded-lg">
      <div ref={chartRef}></div>
    </div>
  );
};

export default ProjectActivities;
