import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const RunesDetails = () => {
  const { runeTicker } = useParams();
  const [tradeData, setTradeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTradeData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/trades/${runeTicker}`);
        if (!response.ok) {
          throw new Error('Failed to fetch trade data');
        }
        const data = await response.json();
        setTradeData(data);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch trade data');
      } finally {
        setLoading(false);
      }
    };

    if (runeTicker) {
      fetchTradeData();
    }
  }, [runeTicker]);

  if (loading) {
    return <div className="p-4 text-gray-400">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="p-4 text-gray-200">
      <h1 className="text-2xl font-bold mb-4">
        Rune Trade Details for {runeTicker.toUpperCase()}
      </h1>
      {tradeData.length === 0 ? (
        <div>No trade data found.</div>
      ) : (
        <table className="min-w-full bg-gray-800 rounded overflow-hidden">
          <thead>
            <tr className="bg-gray-700">
              <th className="p-2 text-left">Old Owner</th>
              <th className="p-2 text-left">New Owner</th>
              <th className="p-2 text-left">Trade Count</th>
              <th className="p-2 text-left">First Trade</th>
              <th className="p-2 text-left">Last Trade</th>
            </tr>
          </thead>
          <tbody>
            {tradeData.map((trade, i) => (
              <tr
                key={i}
                className="border-b border-gray-700 hover:bg-gray-900"
              >
                <td className="p-2">{trade.old_owner}</td>
                <td className="p-2">{trade.new_owner}</td>
                <td className="p-2">{trade.trade_count}</td>
                <td className="p-2">{trade.first_trade}</td>
                <td className="p-2">{trade.last_trade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default RunesDetails;
