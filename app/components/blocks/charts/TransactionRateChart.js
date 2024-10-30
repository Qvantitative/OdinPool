import { Line } from 'react-chartjs-2';
import { useMemo } from 'react';

// This is the function to calculate the transaction rate
const calculateTransactionRate = (blockData) => {
  return blockData.map((block, index) => {
    if (index === 0) return { x: new Date(block.timestamp).toLocaleString(), y: 0 }; // Skip the first block as there's no previous data to compare

    const previousBlock = blockData[index - 1];
    const timeInterval = (new Date(block.timestamp) - new Date(previousBlock.timestamp)) / 3600000; // Convert time interval to hours

    if (timeInterval === 0) return { x: new Date(block.timestamp).toLocaleString(), y: 0 }; // Avoid division by zero

    const transactionRate = block.transactions / timeInterval;

    return {
      x: new Date(block.timestamp).toLocaleString(),
      y: transactionRate,
    };
  });
};

const TransactionRateChart = ({ blockData }) => {
  const transactionRateData = useMemo(() => {
    // Get the last 144 blocks
    const last144Blocks = blockData.slice(-144);
    const rates = calculateTransactionRate(last144Blocks);
    console.log('Transaction Rate Data:', rates); // Log the transaction rate data
    return rates;
  }, [blockData]);

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
        // Optional: Use logarithmic scale if there's a wide range of values
        // type: 'logarithmic',
        // min: 1, // Optional: Set minimum value to prevent scaling issues
      },
    },
  };

  return <Line data={data} options={options} />;
};

export default TransactionRateChart;