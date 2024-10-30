import 'chartjs-adapter-date-fns';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale
);

const TimeBasedChart = ({ blockData }) => {
  // Select the last 100 blocks
  const last100Blocks = blockData.slice(0, 144).sort((a, b) => a.timestamp - b.timestamp);

  const data = {
    labels: last100Blocks.map(block => block.timestamp),
    datasets: [
      {
        label: 'Transactions per Block Over Time',
        data: last100Blocks.map(block => block.transactions),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#ffffff', // Label color
        },
      },
      title: {
        display: true,
        text: 'Bitcoin Transactions Over Time (Last 144 Blocks)',
        color: '#ffffff', // Title color
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'day', // Changed from 'minute' to 'day'
          tooltipFormat: 'PPP', // Changed to show date only
          displayFormats: {
            day: 'MMM d, yyyy'
          }
        },
        title: {
          display: true,
          text: 'Time',
          color: '#ffffff',
        },
        ticks: {
          maxTicksLimit: 10, // Limit the number of ticks to prevent overcrowding
          color: '#ffffff',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Transactions',
          color: '#ffffff',
        },
        ticks: {
          color: '#ffffff',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
  };

  return <Line data={data} options={options} />;
};

export default TimeBasedChart;
