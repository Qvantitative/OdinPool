import React from 'react';
import { ArrowUpRight, ArrowDownRight, Activity, ArrowLeft } from 'lucide-react';

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

  const shortenAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (!runeTicker) {
    return <div className="p-4 text-gray-400">No rune selected</div>;
  }

  if (loading) {
    return (
      <div className="bg-gray-900 p-6 rounded-xl w-full">
        <div className="text-center text-gray-400 py-12">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 p-6 rounded-xl w-full">
        <div className="text-center text-red-500 py-12">{error}</div>
      </div>
    );
  }

  const totalTrades = tradeData.reduce((sum, trade) => sum + trade.trade_count, 0);
  const maxTrades = Math.max(...tradeData.map(trade => trade.trade_count));

  return (
    <div className="bg-gray-900 p-6 rounded-xl w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-400" />
          </button>
          <div className="flex items-center gap-2">
            <Activity className="text-blue-400" size={24} />
            <h2 className="text-xl font-bold text-white">
              {runeTicker.toUpperCase()} Trading Activity
            </h2>
          </div>
        </div>
        <div className="bg-gray-800 px-4 py-2 rounded-lg">
          <span className="text-gray-400">Total Trades Analyzed: </span>
          <span className="text-blue-400 font-mono font-bold">
            {totalTrades}
          </span>
        </div>
      </div>

      {/* Trading Cards */}
      {tradeData.length === 0 ? (
        <div className="text-center text-gray-400 py-12">No trade data found.</div>
      ) : (
        <div className="space-y-4">
          {tradeData.map((trade, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {trade.trade_count > maxTrades/2 ? (
                    <ArrowUpRight className="text-green-400" size={20} />
                  ) : (
                    <ArrowDownRight className="text-red-400" size={20} />
                  )}
                  <span className="text-white font-mono font-bold">
                    {trade.trade_count?.toLocaleString()} trades
                  </span>
                </div>
                <div className="bg-gray-700 px-3 py-1 rounded-full">
                  <span className="text-sm text-gray-400">Activity Score: </span>
                  <span className="text-sm font-bold text-white">
                    {Math.floor((trade.trade_count / maxTrades) * 100)}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-700 p-3 rounded-lg">
                  <div className="text-gray-400 text-sm mb-1">From</div>
                  <div className="font-mono text-white">{shortenAddress(trade.old_owner)}</div>
                </div>
                <div className="bg-gray-700 p-3 rounded-lg">
                  <div className="text-gray-400 text-sm mb-1">To</div>
                  <div className="font-mono text-white">{shortenAddress(trade.new_owner)}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-400 text-xs">First Trade</div>
                  <div className="text-gray-300 text-sm">{formatDate(trade.first_trade)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Last Trade</div>
                  <div className="text-gray-300 text-sm">{formatDate(trade.last_trade)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RunesDetails;