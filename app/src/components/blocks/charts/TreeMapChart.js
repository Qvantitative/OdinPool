// app/components/wallet/charts/TreeMapChart.js

"use client";

import React, { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist";

const TreeMapChart = ({ data, onCollectionClick }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) {
      //console.error("No data available for the chart");
      return;
    }

    // Ensure the ref is defined before rendering the chart
    if (!chartRef.current) return;

    const plotData = [
      {
        type: "treemap",
        labels: data.map((item) => item.name),
        parents: data.map(() => ""),
        values: data.map((item) => (item.MCAP > 0 ? item.MCAP : 0.1)), // Assign minimum value if MCAP is zero
        text: data.map((item) => `${item.fpPctChg.toFixed(2)}%`),
        hovertext: data.map(
          (item) =>
            `${item.name}<br>Market Cap: $${item.MCAP.toFixed(2)}<br>1D % Change: ${
              item.fpPctChg > 0 ? "+" : ""
            }${item.fpPctChg.toFixed(2)}%`
        ),
        hoverinfo: "text",
        textposition: "middle center",
        marker: {
          colors: data.map((item) => getColor(item.fpPctChg)),
          line: { width: 1 },
        },
      },
    ];

    const layout = {
      autosize: true,
      margin: { l: 0, r: 0, b: 0, t: 0 },
      font: { size: 12, color: "#FFFFFF" },
      paper_bgcolor: "black",
      plot_bgcolor: "black",
      treemapcolorway: ["#FF0000", "#00FF00"],
      uniformtext: {
        minsize: 12,
        mode: "hide",
      },
    };

    const config = {
      responsive: true,
      displayModeBar: false,
    };

    // Create the treemap chart
    Plotly.newPlot(chartRef.current, plotData, layout, config);

    // Click event for collection nodes
    chartRef.current.on("plotly_click", function (eventData) {
      const selectedCollection = eventData.points[0]?.label; // Safely get the label
      if (selectedCollection) {
        onCollectionClick(selectedCollection);
      }
    });

    // Cleanup function to remove the chart
    return () => {
      if (chartRef.current) {
        Plotly.purge(chartRef.current);
      }
    };
  }, [data, onCollectionClick]);

  // Utility function to determine colors based on percentage change
  const getColor = (pctChange) => {
    const absChange = Math.abs(pctChange);
    const intensity = Math.min(absChange / 10, 1); // maxChange set to 10

    const colorPart = Math.round(200 * intensity + 55);
    const alpha = 0.8 + 0.9 * intensity;

    return pctChange > 0
      ? `rgba(0, ${colorPart}, 0, ${alpha})`
      : `rgba(${colorPart}, 0, 0, ${alpha})`;
  };

  return (
    <div style={{ width: "100%", height: "345px", position: "relative" }}>
      {data && data.length > 0 ? (
        <div ref={chartRef} style={{ width: "100%", height: "100%" }}></div>
      ) : (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
          <div className="spinner"></div>
        </div>
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
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default TreeMapChart;
