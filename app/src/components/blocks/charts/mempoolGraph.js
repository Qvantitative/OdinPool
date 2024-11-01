import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import ReactECharts from 'echarts-for-react';
import moment from 'moment';

// Import any necessary utilities or constants
// For example, feeLevels, chartColors, etc.

// Your component
const MempoolGraph = ({
  data,
  filterSize = 100000,
  limitFilterFee = 1,
  hideCount = true,
  height = 200,
  top = 20,
  right = 10,
  left = 75,
  template = 'widget',
  showZoom = true,
  windowPreferenceOverride,
}) => {
  // Component state
  const [isLoading, setIsLoading] = useState(true);
  const [mempoolVsizeFeesData, setMempoolVsizeFeesData] = useState(null);
  const [mempoolVsizeFeesOptions, setMempoolVsizeFeesOptions] = useState({});
  const [windowPreference, setWindowPreference] = useState(windowPreferenceOverride || '2h');
  const [hoverIndexSerie, setHoverIndexSerie] = useState(0);
  const [maxFeeIndex, setMaxFeeIndex] = useState(0);
  const [feeLevelsOrdered, setFeeLevelsOrdered] = useState([]);
  const [chartColorsOrdered, setChartColorsOrdered] = useState([]);
  const [inverted, setInverted] = useState(false);
  const [chartInstance, setChartInstance] = useState(null);
  const [isWidget, setIsWidget] = useState(template === 'widget');
  const [showCount, setShowCount] = useState(!isWidget && !hideCount);

  // Refs for the chart
  const chartRef = useRef(null);

  // Effect to process data when it changes
  useEffect(() => {
    if (!data) {
      return;
    }
    setIsWidget(template === 'widget');
    setShowCount(!isWidget && !hideCount);
    // Handle new mempool data
    const processedData = handleNewMempoolData([...data]);
    setMempoolVsizeFeesData(processedData);
    mountFeeChart(processedData);
    setIsLoading(false);
  }, [data, filterSize, limitFilterFee, hideCount, height, top, right, left, template, showZoom, windowPreferenceOverride]);

  // Helper functions
  const handleNewMempoolData = (mempoolStats) => {
    // Reverse data to ensure chronological order
    mempoolStats.reverse();
    const labels = mempoolStats.map(stats => stats.added);
    const finalArrayVByte = generateArray(mempoolStats);
    const finalArrayCount = generateCountArray(mempoolStats);

    return {
      labels: labels,
      series: finalArrayVByte,
      countSeries: finalArrayCount,
    };
  };

  const generateArray = (mempoolStats) => {
    const finalArray = [];
    let maxTier = 0;
    for (let index = 37; index > -1; index--) {
      const feesArray = mempoolStats.map(stats => {
        const size = stats.vsizes[index] || 0;
        if (size >= filterSize) {
          maxTier = Math.max(maxTier, index);
        }
        return [stats.added * 1000, size];
      });
      finalArray.push(feesArray);
    }
    setMaxFeeIndex(maxTier);
    finalArray.reverse();
    return finalArray;
  };

  const generateCountArray = (mempoolStats) => {
    return mempoolStats
      .filter(stats => stats.count > 0)
      .map(stats => [stats.added * 1000, stats.count]);
  };

  const mountFeeChart = (processedData) => {
    orderLevels();
    const { series, countSeries } = processedData;

    const seriesGraph = [];
    const newColors = [];

    for (let index = 0; index < series.length; index++) {
      const value = series[index];
      if (index >= feeLimitIndex && index <= maxFeeIndex) {
        newColors.push(chartColorsOrdered[index]);
        seriesGraph.push({
          name: feeLevelsOrdered[index],
          type: 'line',
          stack: 'fees',
          smooth: false,
          lineStyle: {
            width: 0,
            opacity: 0,
          },
          symbol: 'none',
          emphasis: {
            focus: 'none',
            areaStyle: {
              opacity: 0.85,
            },
          },
          areaStyle: {
            color: chartColorsOrdered[index],
            opacity: 1,
          },
          data: value,
        });
      }
    }

    if (showCount) {
      newColors.push('white');
      seriesGraph.push({
        yAxisIndex: 1,
        name: 'count',
        type: 'line',
        stack: 'count',
        smooth: false,
        lineStyle: {
          width: 2,
          opacity: 1,
        },
        symbol: 'none',
        silent: true,
        areaStyle: {
          color: null,
          opacity: 0,
        },
        data: countSeries,
      });
    }

    const options = {
      series: inverted ? [...seriesGraph].reverse() : seriesGraph,
      color: inverted ? [...newColors].reverse() : newColors,
      tooltip: {
        // Tooltip configuration
        trigger: 'axis',
        formatter: (params) => {
          // Custom formatter
          return generateTooltipContent(params);
        },
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          formatter: (value) => moment(value).format('HH:mm'),
        },
      },
      yAxis: [
        {
          type: 'value',
          axisLabel: {
            formatter: (value) => `${(value / 1e6).toFixed(2)} MvB`,
          },
        },
        showCount ? {
          type: 'value',
          position: 'right',
          axisLabel: {
            formatter: (value) => `${value}`,
          },
        } : null,
      ],
      dataZoom: showZoom ? [
        {
          type: 'inside',
          realtime: true,
        },
        {
          type: 'slider',
          realtime: true,
        },
      ] : [],
    };

    setMempoolVsizeFeesOptions(options);
  };

  const orderLevels = () => {
    const feeLevelsOrderedTemp = [];
    const chartColorsOrderedTemp = [];

    // Logic to order fee levels and assign colors
    // Assuming you have feeLevels and chartColors constants

    setFeeLevelsOrdered(feeLevelsOrderedTemp);
    setChartColorsOrdered(chartColorsOrderedTemp);
  };

  const generateTooltipContent = (params) => {
    // Custom logic to generate tooltip content
    return 'Tooltip content';
  };

  // Render method
  return (
    <div style={{ position: 'relative' }}>
      {isLoading && (
        <div className="loadingGraphs">
          {/* Loading spinner or placeholder */}
          Loading...
        </div>
      )}
      <ReactECharts
        ref={chartRef}
        option={mempoolVsizeFeesOptions}
        style={{ height: `${height}px` }}
        notMerge={true}
        lazyUpdate={true}
        onChartReady={(chart) => {
          setChartInstance(chart);
          // Additional setup if needed
        }}
      />
    </div>
  );
};

// Define PropTypes
MempoolGraph.propTypes = {
  data: PropTypes.array.isRequired,
  filterSize: PropTypes.number,
  limitFilterFee: PropTypes.number,
  hideCount: PropTypes.bool,
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  top: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  right: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  left: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  template: PropTypes.oneOf(['widget', 'advanced']),
  showZoom: PropTypes.bool,
  windowPreferenceOverride: PropTypes.string,
};

export default MempoolGraph;
