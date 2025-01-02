import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

const RunesDetails = ({ runeTicker, onBack }) => {
  const [tradeData, setTradeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTradeData = async () => {
      if (!runeTicker) return;

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

    fetchTradeData();
  }, [runeTicker]);

  if (!runeTicker) {
    return <div className="p-4 text-gray-400">No rune selected</div>;
  }

  return (
    <div className="bg-gray-900 text-gray-200 rounded-lg shadow-lg">
      <div className="p-6 border-b border-gray-800">
        <div className="flex flex-row items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h2 className="text-2xl font-bold">
            Trade Details for {runeTicker.toUpperCase()}
          </h2>
        </div>
      </div>

      <div className="p-6">
        {loading && (
          <div className="p-4 text-center text-gray-400">Loading...</div>
        )}

        {error && (
          <div className="p-4 text-center text-red-500">{error}</div>
        )}

        {!loading && !error && tradeData.length === 0 && (
          <div className="p-4 text-center text-gray-400">No trade data found.</div>
        )}

        {!loading && !error && tradeData.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="p-3 text-left font-medium text-gray-400">Old Owner</th>
                  <th className="p-3 text-left font-medium text-gray-400">New Owner</th>
                  <th className="p-3 text-left font-medium text-gray-400">Trade Count</th>
                  <th className="p-3 text-left font-medium text-gray-400">First Trade</th>
                  <th className="p-3 text-left font-medium text-gray-400">Last Trade</th>
                </tr>
              </thead>
              <tbody>
                {tradeData.map((trade, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="p-3 font-mono text-sm">{trade.old_owner}</td>
                    <td className="p-3 font-mono text-sm">{trade.new_owner}</td>
                    <td className="p-3">{trade.trade_count?.toLocaleString()}</td>
                    <td className="p-3">{new Date(trade.first_trade).toLocaleDateString()}</td>
                    <td className="p-3">{new Date(trade.last_trade).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RunesDetails;