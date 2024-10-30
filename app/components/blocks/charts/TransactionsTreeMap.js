import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, TreemapController, Tooltip, Legend } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chartjs-chart-treemap';

ChartJS.register(TreemapController, Tooltip, Legend);

const TransactionTreemap = () => {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch the latest transactions
        const response = await fetch('/api/transactions');
        const transactions = await response.json();

        // Process the data for the treemap
        const processedData = transactions.map(tx => ({
          block: tx.block_height,
          txid: tx.txid,
          value: parseFloat(tx.total_output_value)
        }));

        // Get unique block heights
        const blockHeights = [...new Set(processedData.map(tx => tx.block))].sort((a, b) => b - a);

        setChartData({
          datasets: [{
            tree: processedData,
            key: 'value',
            groups: ['block'],
            spacing: 0.1,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.5)',
            backgroundColor: (ctx) => {
              const colors = [
                'rgba(255, 99, 132, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(153, 102, 255, 0.8)',
                'rgba(255, 159, 64, 0.8)',
                'rgba(199, 199, 199, 0.8)',
                'rgba(83, 102, 255, 0.8)',
                'rgba(40, 159, 64, 0.8)',
                'rgba(210, 199, 199, 0.8)'
              ];
              if (ctx.type !== 'data') return 'transparent';
              const blockIndex = blockHeights.indexOf(ctx.raw._data.block);
              return colors[blockIndex % colors.length];
            },
            labels: {
              display: true,
              color: 'white',
              formatter: (ctx) => ctx.raw._data.txid.substring(0, 8)
            }
          }]
        });
      } catch (error) {
        console.error('Error fetching transaction data:', error);
      }
    };

    fetchData();
  }, []);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Transaction Treemap (Recent Transactions)',
        color: '#ffffff',
        font: {
          size: 18
        }
      },
      tooltip: {
        callbacks: {
          title: (items) => `Block: ${items[0].raw._data.block}`,
          label: (item) => [
            `Transaction: ${item.raw._data.txid}`,
            `Value: ${item.raw._data.value.toFixed(8)} BTC`
          ]
        }
      }
    }
  };

  return (
    <div className="w-full h-[600px]">
      {chartData ? (
        <Chart type='treemap' data={chartData} options={options} />
      ) : (
        <div className="text-white">Loading transaction data...</div>
      )}
    </div>
  );
};

export default TransactionTreemap;