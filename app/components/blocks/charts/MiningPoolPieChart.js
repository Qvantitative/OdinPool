import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const Plot = dynamic(
  () => import('react-plotly.js').then((mod) => mod.default),
  { ssr: false, loading: () => <div>Loading chart...</div> }
);

const MiningPoolPieChart = ({ blockData }) => {
  const [chartData, setChartData] = useState({ labels: [], values: [] });
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

      const totalBlocks = Object.values(poolCounts).reduce((sum, count) => sum + count, 0);

      const sortedPools = Object.entries(poolCounts)
        .sort((a, b) => b[1] - a[1])
        .reduce(
          (acc, [key, value]) => {
            const percentage = (value / totalBlocks) * 100;
            if (percentage >= 1) {  // Only include pools with at least 1% share
              acc.labels.push(key);
              acc.values.push(percentage);
            } else {
              acc.labels[acc.labels.length - 1] = 'Other';
              acc.values[acc.values.length - 1] += percentage;
            }
            return acc;
          },
          { labels: [], values: [] }
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
      {chartData.labels.length > 0 ? (
        <div style={{ width: '100%', height: '400px' }}>
          <Plot
            data={[
              {
                labels: chartData.labels,
                values: chartData.values,
                type: 'pie',
                textinfo: 'label+percent',
                hoverinfo: 'label+percent',
                textposition: 'inside',
                insidetextorientation: 'radial',
                marker: {
                  colors: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                    '#FF9F40', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'
                  ],
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
              legend: {
                font: {
                  color: '#ffffff',
                },
              },
              margin: { t: 10, l: 10, r: 10, b: 10 },
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

export default MiningPoolPieChart;