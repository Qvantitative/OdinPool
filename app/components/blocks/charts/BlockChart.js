// app/components/blocks/charts/BlockChart.js

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
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const BlockChart = ({ blockData }) => {
  // Sort blockData by block_height in ascending order
  const sortedBlockData = blockData.sort((a, b) => a.block_height - b.block_height);

  // Get the last 144 blocks
  const last144Blocks = sortedBlockData.slice(-144);

  const data = {
    labels: last144Blocks.map(block => block.block_height),
    datasets: [
      {
        label: 'Transactions per Block',
        data: last144Blocks.map(block => block.transactions),
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
        text: 'Bitcoin Transactions by Block Height (Last 144 Blocks)',
        color: '#ffffff',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Block Height',
          color: '#ffffff',
        },
        ticks: {
          color: '#ffffff',
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
      },
    },
  };

  return <Line data={data} options={options} />;
};

export default BlockChart;