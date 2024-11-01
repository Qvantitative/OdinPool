import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

const ParetoChart = () => {
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const chartRef = useRef();

  useEffect(() => {
    const fetchTopAddresses = async () => {
      try {
        const response = await fetch('https://143.198.17.64:3001/api/top-addresses');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const addresses = await response.json();

        // Limit to top 20 addresses for clarity
        const limitedAddresses = addresses.slice(0, 20);

        // Process data for Pareto chart
        let totalBalance = limitedAddresses.reduce(
          (sum, addr) => sum + parseFloat(addr.balance),
          0
        );

        let cumulativeBalance = 0;
        const chartData = limitedAddresses.map((addr) => {
          const balance = parseFloat(addr.balance);
          cumulativeBalance += balance;
          return {
            address: addr.address,
            balance: balance,
            cumulativePercentage: (cumulativeBalance / totalBalance) * 100,
          };
        });

        setData(chartData);
      } catch (error) {
        console.error('Error fetching top addresses:', error);
        setError(`Failed to fetch top addresses: ${error.message}`);
      }
    };

    fetchTopAddresses();
  }, []);

  useEffect(() => {
    if (data.length > 0) {
      drawChart();
    }
  }, [data]);

  const drawChart = () => {
    const margin = { top: 20, right: 30, bottom: 120, left: 50 };
    const chartContainer = chartRef.current;
    const containerWidth = chartContainer.clientWidth;

    // Remove any existing SVG
    d3.select(chartRef.current).select('svg').remove();

    // Create responsive SVG
    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('viewBox', `0 0 ${containerWidth} 500`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const width = containerWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const chart = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Scales
    const xScale = d3
      .scaleBand()
      .domain(data.map((d, i) => i))
      .range([0, width])
      .padding(0.1);

    const yLeftScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.balance)])
      .range([height, 0]);

    const yRightScale = d3.scaleLinear().domain([0, 100]).range([height, 0]);

    // Tooltip
    const tooltip = d3.select(chartRef.current)
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background-color', 'white')
      .style('border', 'solid')
      .style('border-width', '1px')
      .style('border-radius', '5px')
      .style('padding', '10px')
      .style('pointer-events', 'none')
      .style('color', 'black')  // Set text color to black
      .style('font-size', '14px')
      .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.1)');

    // Bars
    chart
      .selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d, i) => xScale(i))
      .attr('y', (d) => yLeftScale(d.balance))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => height - yLeftScale(d.balance))
      .attr('fill', '#8884d8')
      .on('mouseover', function(event, d) {
        tooltip.transition()
          .duration(200)
          .style('opacity', .9);
        tooltip.html(`<strong>Address:</strong> ${d.address}<br/><strong>Balance:</strong> ${d.balance.toFixed(8)} BTC`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function(d) {
        tooltip.transition()
          .duration(500)
          .style('opacity', 0);
      });

    // Line
    const line = d3
      .line()
      .x((d, i) => xScale(i) + xScale.bandwidth() / 2)
      .y((d) => yRightScale(d.cumulativePercentage));

    chart
      .append('path')
      .datum(data)
      .attr('class', 'line')
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', '#82ca9d')
      .attr('stroke-width', 2);

    // Left Y-Axis
    chart.append('g').call(d3.axisLeft(yLeftScale));

    // Right Y-Axis
    chart
      .append('g')
      .attr('transform', `translate(${width}, 0)`)
      .call(d3.axisRight(yRightScale));

    // X-Axis
    chart
      .append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(d3.axisBottom(xScale).tickFormat(() => ''))
      .selectAll('text')
      .remove();

    // X-Axis Labels (Addresses)
    chart
      .selectAll('.x-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'x-label')
      .attr('x', (d, i) => xScale(i) + xScale.bandwidth() / 2)
      .attr('y', height + 10)
      .attr('text-anchor', 'end')
      .attr('transform', (d, i) => `rotate(-65, ${xScale(i) + xScale.bandwidth() / 2}, ${height + 10})`)
      .text(d => d.address.substring(0, 10) + '...')
      .style('font-size', '8px')
      .style('fill', 'white');

    // Responsive behavior
    function resize() {
      const newWidth = chartContainer.clientWidth;
      svg.attr('viewBox', `0 0 ${newWidth} 500`);
    }

    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
    };
  };

  if (error) return <div className="text-red-500">{error}</div>;
  if (data.length === 0) return <div className="text-white">Loading...</div>;

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow text-white w-full">
      <h2 className="text-lg font-bold mb-4 text-center">
        Pareto Chart of Top Addresses by Balance
      </h2>
      <div ref={chartRef} className="w-full"></div>
    </div>
  );
};

export default ParetoChart;