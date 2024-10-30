import { Line } from 'react-chartjs-2';
import { useMemo } from 'react';

const calculateTransactionRate = (blockData) => {
  return blockData.map((block, index) => {
    if (index === 0) return { x: new Date(block.timestamp).toLocaleString(), y: 0 }; // Skip the first block as there's no previous data to compare

    const timeInterval = (new Date(block.timestamp) - new Date(blockData[index - 1].timestamp)) / 3600000; // Time interval in hours
    const transactionRate = block.transactions / timeInterval;

    return {
      x: new Date(block.timestamp).toLocaleString(),
      y: transactionRate,
    };
  });
};

const TransactionRateChart = ({ blockData }) => {
  const transactionRateData = useMemo(() => calculateTransactionRate(blockData), [blockData]);

  const data = {
    labels: transactionRateData.map((dataPoint) => dataPoint.x),
    datasets: [
      {
        label: 'Transaction Rate (per Hour)',
        data: transactionRateData.map((dataPoint) => dataPoint.y),
        fill: true,
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
        pointBorderColor: '#fff',
      },
    ],
  };

  const options = {
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'hour',
        },
        title: {
          display: true,
          text: 'Time',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Transaction Rate (per Hour)',
        },
      },
    },
  };

  return <Line data={data} options={options} />;
};

export default TransactionRateChart;
