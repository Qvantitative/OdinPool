import { useEffect, useState } from 'react';

const BlockActivitiesCard = ({ blockHeight }) => {
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState(null);

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  let lastRequestTime = 0;
  const THROTTLE_DELAY = 5000; // 5 seconds

  useEffect(() => {
    const fetchBlockActivities = async (retryCount = 0) => {
      const now = Date.now();
      if (now - lastRequestTime < THROTTLE_DELAY) {
        console.log(`Throttling requests. Waiting ${THROTTLE_DELAY - (now - lastRequestTime)} ms`);
        await delay(THROTTLE_DELAY - (now - lastRequestTime));
      }

      lastRequestTime = Date.now();

      try {
        const response = await fetch(`https://api-mainnet.magiceden.dev/v2/ord/btc/block/activities?blockHeight=${blockHeight}&limit=5`, {
          headers: {
            'accept': 'application/json',
          },
        });

        if (response.status === 429) {
          const delayTime = Math.pow(2, retryCount) * 1000;
          console.error(`Rate limit exceeded, retrying in ${delayTime / 1000} seconds`);
          await delay(delayTime);
          return fetchBlockActivities(retryCount + 1);
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch block activities: ${response.statusText}`);
        }

        const data = await response.json();
        setActivities(data.activities);
      } catch (error) {
        console.error('Error fetching block activities:', error);
        setError('There was an error loading the block activities data. Please try again later.');
      }
    };

    fetchBlockActivities();
  }, [blockHeight]);

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  if (!activities.length) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-white shadow rounded-lg p-6 mt-4">
      <h2 className="text-2xl font-semibold text-black mb-4">Recent Block Activities</h2>
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className="border-b-2 border-gray-300 pb-2 text-black">Activity Kind</th>
            <th className="border-b-2 border-gray-300 pb-2 text-black">Transaction ID</th>
            <th className="border-b-2 border-gray-300 pb-2 text-black">Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {activities.slice(0, 5).map((activity, index) => (
            <tr key={index}>
              <td className="border-b border-gray-200 py-2 text-black">{activity.kind}</td>
              <td className="border-b border-gray-200 py-2 text-black">{activity.txid}</td>
              <td className="border-b border-gray-200 py-2 text-black">{new Date(activity.timestamp * 1000).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BlockActivitiesCard;
