// app/components/blocks/charts/ProjectActivities.js

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const ProjectActivities = ({ transferIntervals }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    // Clear any previous chart
    d3.select(chartRef.current).selectAll('*').remove();

    // Set up dimensions
    const margin = { top: 50, right: 30, bottom: 70, left: 60 };
    const width = chartRef.current.clientWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Append SVG
    const svg = d3
      .select(chartRef.current)
      .append('svg')
      .attr('width', chartRef.current.clientWidth)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Prepare data
    const data = transferIntervals.map((item) => ({
      time_interval: item.time_interval,
      project_slug: item.project_slug,
      transfer_count: parseInt(item.transfer_count, 10),
    }));

    // Get unique time intervals and projects
    const timeIntervals = [...new Set(data.map((d) => d.time_interval))];
    const projects = [...new Set(data.map((d) => d.project_slug))];

    // Sort time intervals
    const intervalOrder = { '10m': 1, '30m': 2, '1hr': 3, '4hr': 4 };
    timeIntervals.sort((a, b) => intervalOrder[a] - intervalOrder[b]);

    // X scale for time intervals
    const x0 = d3.scaleBand()
      .domain(timeIntervals)
      .range([0, width])
      .paddingInner(0.1);

    // X1 scale for projects within time intervals
    const x1 = d3.scaleBand()
      .domain(projects)
      .range([0, x0.bandwidth()])
      .padding(0.05);

    // Y scale
    const y = d3.scaleLinear()
      .domain([0, d3.max(data, (d) => d.transfer_count)])
      .nice()
      .range([height, 0]);

    // Color scale
    const color = d3.scaleOrdinal()
      .domain(projects)
      .range(d3.schemeCategory10);

    // X axis
    svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x0))
      .selectAll('text')
      .style('fill', '#ccc');

    // Y axis
    svg.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('fill', '#ccc');

    // Bars
    svg.append('g')
      .selectAll('g')
      .data(data)
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${x0(d.time_interval)},0)`)
      .selectAll('rect')
      .data((d) => projects.map((key) => ({ key, value: d })))
      .enter()
      .append('rect')
      .attr('x', (d) => x1(d.key))
      .attr('y', (d) => y(d.value.transfer_count))
      .attr('width', x1.bandwidth())
      .attr('height', (d) => height - y(d.value.transfer_count))
      .attr('fill', (d) => color(d.key));

    // Add legend
    const legend = svg.append('g')
      .attr('transform', `translate(0, -30)`);

    legend.selectAll('rect')
      .data(projects)
      .enter()
      .append('rect')
      .attr('x', (_, i) => i * 100)
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', (d) => color(d));

    legend.selectAll('text')
      .data(projects)
      .enter()
      .append('text')
      .attr('x', (_, i) => i * 100 + 20)
      .attr('y', 12)
      .style('fill', '#fff')
      .text((d) => d);

    // Chart title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('fill', '#fff')
      .text('Project Activities Over Intervals');

    // X-axis label
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 20)
      .attr('text-anchor', 'middle')
      .style('fill', '#fff')
      .text('Time Intervals');

    // Y-axis label
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 15)
      .attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .style('fill', '#fff')
      .text('Transfer Count');

  }, [transferIntervals]);

  return (
    <div className="p-4 bg-gray-700 rounded-lg">
      <div ref={chartRef}></div>
    </div>
  );
};

export default ProjectActivities;
