// app/components/blocks/charts/MiningPoolBarChart.js

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const Plot = dynamic(
  () => import('react-plotly.js').then((mod) => mod.default),
  { ssr: false, loading: () => <div>Loading chart...</div> }
);

const MiningPoolBarChart = ({ blockData }) => {
  const [chartData, setChartData] = useState({ x: [], y: [] });
  const [timePeriod, setTimePeriod] = useState('1d');

  useEffect(() => {
    if (blockData && blockData.length > 0) {
      const now = Date.now();
      let periodMilliseconds;

      switch (timePeriod) {
        case '1d':
          periodMilliseconds = 24 * 60 * 60 * 1000; // 1 day
          break;
        case '1w':
          periodMilliseconds = 7 * 24 * 60 * 60 * 1000; // 1 week
          break;
        case '1m':
          periodMilliseconds = 30 * 24 * 60 * 60 * 1000; // 1 month
          break;
        default:
          periodMilliseconds = 24 * 60 * 60 * 1000; // default to 1 day
      }

      const cutoffTime = now - periodMilliseconds;

      // Filter blocks based on timestamp
      const selectedBlocks = blockData.filter(
        (block) => block.timestamp && block.timestamp >= cutoffTime
      );

      const poolCounts = selectedBlocks.reduce((acc, block) => {
        acc[block.mining_pool] = (acc[block.mining_pool] || 0) + 1;
        return acc;
      }, {});

      const sortedPools = Object.entries(poolCounts)
        .sort((a, b) => b[1] - a[1])
        .reduce(
          (acc, [key, value]) => {
            acc.x.push(key);
            acc.y.push(value);
            return acc;
          },
          { x: [], y: [] }
        );

      setChartData(sortedPools);
    }
  }, [blockData, timePeriod]);

  const handleTimePeriodChange = (period) => {
    setTimePeriod(period);
  };

  const getTimePeriodLabel = () => {
    switch (timePeriod) {
      case '1d':
        return 'Last 24 hours';
      case '1w':
        return 'Last 7 days';
      case '1m':
        return 'Last 30 days';
      default:
        return 'Last 24 hours';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-white">
          Mining Pool Distribution ({getTimePeriodLabel()})
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => handleTimePeriodChange('1d')}
            className={`px-3 py-1 rounded ${
              timePeriod === '1d' ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-200'
            }`}
          >
            1 Day
          </button>
          <button
            onClick={() => handleTimePeriodChange('1w')}
            className={`px-3 py-1 rounded ${
              timePeriod === '1w' ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-200'
            }`}
          >
            1 Week
          </button>
          <button
            onClick={() => handleTimePeriodChange('1m')}
            className={`px-3 py-1 rounded ${
              timePeriod === '1m' ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-200'
            }`}
          >
            1 Month
          </button>
        </div>
      </div>
      {chartData.x.length > 0 ? (
        <div style={{ width: '100%', height: '400px' }}>
          <Plot
            data={[
              {
                x: chartData.x,
                y: chartData.y,
                type: 'bar',
                marker: {
                  color: 'rgb(0, 123, 255)',
                },
              },
            ]}
            layout={{
              autosize: true,
              title: '',
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              font: {
                family: 'Arial, sans-serif',
                size: 12,
                color: '#ffffff',
              },
              xaxis: {
                title: 'Pool',
                titlefont: {
                  size: 14,
                  color: '#ffffff',
                },
                tickfont: {
                  size: 12,
                  color: '#ffffff',
                },
                automargin: true,
                tickangle: -45, // Rotate labels for better fit
              },
              yaxis: {
                title: 'Blocks Mined',
                titlefont: {
                  size: 14,
                  color: '#ffffff',
                },
                tickfont: {
                  size: 12,
                  color: '#ffffff',
                },
                automargin: true,
              },
              margin: { t: 10, l: 50, r: 20, b: 100 }, // Adjust margins
            }}
            config={{ responsive: true }}
            useResizeHandler={true}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      ) : (
        <div className="text-white">No data available</div>
      )}
    </div>
  );
};

export default MiningPoolBarChart;
