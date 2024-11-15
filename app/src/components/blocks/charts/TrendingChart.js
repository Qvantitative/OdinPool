// app/components/wallet/charts/TrendingChart.js

"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as d3 from 'd3';

const TrendingChart = React.memo(({ collectionName }) => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeFilter, setTimeFilter] = useState("all");
  const chartRef = useRef(null);

  const fetchStoredTrendingData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/trending/${collectionName}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch data for ${collectionName}, status: ${response.status}`);
      }

      const storedData = await response.json();
      const processedData = processData(storedData);
      setData(processedData);
    } catch (error) {
      console.error('Error fetching trending data:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [collectionName]);

  useEffect(() => {
    if (collectionName) {
      fetchStoredTrendingData();
    } else {
      setError('No collection name provided');
      setIsLoading(false);
    }
  }, [fetchStoredTrendingData, collectionName]);

  const processData = (rawData) => {
    return rawData
      .filter((item, index, arr) => index === 0 || item.timestamp !== arr[index - 1].timestamp)
      .filter(item => !isNaN(item.floor_price))
      .map(item => ({
        timestamp: new Date(item.timestamp),
        floor_price: parseFloat(item.floor_price),
        volume: parseFloat(item.volume),
        market_cap: parseFloat(item.market_cap),
      }));
  };

  const filterDataByTime = useCallback((filter) => {
    const now = new Date();
    const filterTime = {
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "12h": 12 * 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
      "1w": 7 * 24 * 60 * 60 * 1000,
      "all": Infinity
    };

    return data.filter(item => now - item.timestamp <= filterTime[filter]);
  }, [data]);

  const drawChart = useCallback(() => {
    if (!chartRef.current || data.length === 0) return;

    const filteredData = filterDataByTime(timeFilter);
    if (filteredData.length === 0) {
      displayNoDataMessage();
      return;
    }

    const containerWidth = chartRef.current.clientWidth;
    const containerHeight = chartRef.current.clientHeight;
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartWidth = containerWidth - margin.left - margin.right;
    const chartHeight = containerHeight - margin.top - margin.bottom;

    d3.select(chartRef.current).selectAll("*").remove();

    const svg = d3.select(chartRef.current)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", containerHeight)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleTime()
      .domain(d3.extent(filteredData, d => d.timestamp))
      .range([0, chartWidth]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(filteredData, d => d.floor_price)])
      .range([chartHeight, 0]);

    const trendColor = filteredData[filteredData.length - 1].floor_price >= filteredData[0].floor_price ? "#00ff00" : "#ff0000";

    // Define the gradient
    const drawGradient = () => {
      const gradient = svg.append("defs")
        .append("linearGradient")
        .attr("id", "areaGradient")
        .attr("x1", "0%")
        .attr("x2", "0%")
        .attr("y1", "0%")
        .attr("y2", "100%");

      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", trendColor)
        .attr("stop-opacity", 0.4);

      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", trendColor)
        .attr("stop-opacity", 0);
    };

    const drawArea = () => {
      const area = d3.area()
        .x(d => x(d.timestamp))
        .y0(chartHeight)
        .y1(d => y(d.floor_price));

      svg.append("path")
        .datum(filteredData)
        .attr("fill", "url(#areaGradient)")
        .attr("d", area);
    };

    const drawLine = () => {
      const line = d3.line()
        .x(d => x(d.timestamp))
        .y(d => y(d.floor_price));

      svg.append("path")
        .datum(filteredData)
        .attr("fill", "none")
        .attr("stroke", trendColor)
        .attr("stroke-width", 2)
        .attr("d", line);
    };

    const drawAxes = () => {
      const xAxis = d3.axisBottom(x).ticks(5);
      const yAxis = d3.axisLeft(y).ticks(5);

      svg.append("g")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis)
        .selectAll("text")
        .style("fill", "white");

      svg.append("g")
        .call(yAxis)
        .selectAll("text")
        .style("fill", "white");
    };

    const addHoverEffects = () => {
      const focus = svg.append("g")
        .style("display", "none");

      focus.append("circle")
        .attr("r", 4.5)
        .style("fill", "white");

      focus.append("text")
        .attr("x", 9)
        .attr("dy", ".35em")
        .style("fill", "white");

      svg.append("rect")
        .attr("class", "overlay")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("mouseover", () => focus.style("display", null))
        .on("mouseout", () => focus.style("display", "none"))
        .on("mousemove", mousemove);

      function mousemove(event) {
        const bisect = d3.bisector(d => d.timestamp).left;
        const x0 = x.invert(d3.pointer(event)[0]);
        const i = bisect(filteredData, x0, 1);
        const d0 = filteredData[i - 1];
        const d1 = filteredData[i] || d0;
        const d = x0 - d0.timestamp > d1.timestamp - x0 ? d1 : d0;
        focus.attr("transform", `translate(${x(d.timestamp)},${y(d.floor_price)})`);
        focus.select("text").text(`${d.floor_price.toFixed(6)} BTC`);
      }
    };

    drawGradient();
    drawArea();
    drawLine();
    drawAxes();
    addHoverEffects();

  }, [data, timeFilter, filterDataByTime]);

  const displayNoDataMessage = () => {
    const containerWidth = chartRef.current.clientWidth;
    const containerHeight = chartRef.current.clientHeight;
    d3.select(chartRef.current).selectAll("*").remove();
    const svg = d3.select(chartRef.current)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", containerHeight);

    svg.append("text")
      .attr("x", containerWidth / 2)
      .attr("y", containerHeight / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#cccccc")
      .text("No data available for the selected time range");
  };

  useEffect(() => {
    if (!isLoading && !error) {
      drawChart();
      window.addEventListener('resize', drawChart);
      return () => window.removeEventListener('resize', drawChart);
    }
  }, [drawChart, isLoading, error]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
          <div className="spinner"></div>
        </div>
      ) : error ? (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%" }}>
          <div>Error: {error}</div>
          <button onClick={fetchStoredTrendingData} style={{ marginTop: "10px" }}>Retry</button>
        </div>
      ) : (
        <>
          <div ref={chartRef} style={{ width: "100%", height: "100%" }}></div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
            <select
              onChange={(e) => setTimeFilter(e.target.value)}
              value={timeFilter}
              style={{
                backgroundColor: '#2a2a2a',
                color: 'white',
                padding: '5px',
                borderRadius: '5px'
              }}
            >
              <option value="1h">1 Hour</option>
              <option value="6h">6 Hours</option>
              <option value="12h">12 Hours</option>
              <option value="1d">1 Day</option>
              <option value="1w">1 Week</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </>
      )}
      <style jsx>{`
        .spinner {
          width: 50px;
          height: 50px;
          border: 5px solid rgba(255, 255, 255, 0.3);
          border-top: 5px solid #ffffff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

export default TrendingChart;
