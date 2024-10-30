import { useEffect, useState } from 'react';

const BlockRewardsCard = ({ timePeriod }) => {
  const [rewardsData, setRewardsData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBlockRewards = async () => {
      try {
        const response = await fetch(`https://mempool.space/api/v1/mining/blocks/rewards/${timePeriod}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch block rewards: ${response.statusText}`);
        }

        const data = await response.json();
        // Sort data by block height in descending order and take the most recent 3 blocks
        const recentRewards = data.sort((a, b) => b.avgHeight - a.avgHeight).slice(0, 3);
        setRewardsData(recentRewards);
      } catch (error) {
        console.error('Error fetching block rewards:', error);
        setError('There was an error loading the block rewards data. Please try again later.');
      }
    };

    fetchBlockRewards();
  }, [timePeriod]);

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  if (!rewardsData.length) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-gray-800 shadow rounded-lg p-6">
      <h2 className="text-2xl font-semibold text-white mb-4">Recent Block Rewards</h2>
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className="border-b-2 border-gray-300 pb-2 text-white">Block Height</th>
            <th className="border-b-2 border-gray-300 pb-2 text-white">Timestamp</th>
            <th className="border-b-2 border-gray-300 pb-2 text-white">Average Rewards (sats)</th>
          </tr>
        </thead>
        <tbody>
          {rewardsData.map((reward, index) => (
            <tr key={index}>
              <td className="border-b border-gray-200 py-2 text-white">{reward.avgHeight}</td>
              <td className="border-b border-gray-200 py-2 text-white">{new Date(reward.timestamp * 1000).toLocaleString()}</td>
              <td className="border-b border-gray-200 py-2 text-white">{reward.avgRewards}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BlockRewardsCard;
