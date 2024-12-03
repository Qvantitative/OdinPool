import React, { useState, useRef } from 'react';
import { LineChart, Activity, Database, Search, BarChart2, X, CircleDot } from 'lucide-react';

// Analytics Logo Component
const AnalyticsLogo = ({ width = 24, height = 24, className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={width}
    height={height}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 3v18h18" />
    <path d="M7 12l4-4 4 4 4-4" />
  </svg>
);

const Navbar = ({
  onShowMempool,
  onShowTransactions,
  onShowAnalytics,
  onShowBubbleMap,
  onShowTrendingCollections,
  selectedView,
  onSearch,
}) => {
  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchType, setSearchType] = useState('Transaction ID');
  const hoverTimeout = useRef(null);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({
        type: searchType,
        value: searchInput.trim(),
      });
    }
    setSearchInput('');
    setShowSearch(false);
  };

  const navItems = [
    {
      label: 'Mempool',
      icon: <Database className="w-5 h-5" />,
      onClick: onShowMempool,
      active: selectedView === 'mempool',
    },
    {
      label: 'Trending Collections',
      icon: <BarChart2 className="w-5 h-5" />,
      onClick: onShowTrendingCollections,
      active: selectedView === 'trendingCollections',
    },
    {
      label: 'Analytics',
      icon: <LineChart className="w-5 h-5" />,
      onClick: onShowAnalytics,
      active: selectedView === 'analytics',
    },
    {
      label: 'Bubble Map',
      icon: <CircleDot className="w-5 h-5" />,
      onClick: onShowBubbleMap,
      active: selectedView === 'bubbleMap',
    },
  ];

  return (
    <nav className="bg-gray-900 text-white px-4 py-3 shadow-md flex justify-between items-center fixed top-0 left-0 w-full z-50">
      {/* Left Side - Navigation Items */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <AnalyticsLogo width={28} height={28} className="text-blue-500" />
          <span className="text-lg font-bold">ODIN</span>
        </div>

        <div className="flex items-center space-x-4">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors duration-200 ${
                item.active
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-800 text-gray-300 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right Side - Search */}
      <div className="flex items-center space-x-4">
        {showSearch ? (
          <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
            <select
              className="bg-gray-800 text-white px-2 py-1 rounded-l outline-none"
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
            >
              <option value="Transaction ID">Transaction ID</option>
              {/* <option value="Block Height">Block Height</option> */}
              <option value="Wallet Address">Wallet Address</option>
            </select>
            <input
              type="text"
              className="bg-gray-800 text-white px-3 py-1 outline-none min-w-[200px]"
              placeholder={`Enter ${searchType}`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-3 py-1 rounded-r hover:bg-blue-700"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setShowSearch(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-gray-800 transition-colors duration-200"
          >
            <Search className="w-5 h-5" />
            <span className="font-medium">Search</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default React.memo(Navbar);
