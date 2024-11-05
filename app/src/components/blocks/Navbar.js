// app/src/components/blocks/Navbar.js

import React, { useState, useRef } from 'react';
import { LineChart, Activity, Database, Search, BarChart2 } from 'lucide-react';

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
  onShowBlocks,
  onShowTransactions,
  onShowAnalytics,
  onShowSearch,
  onShowCharts,
  selectedView
}) => {
  const [showSidebar, setShowSidebar] = useState(false);
  const hoverTimeout = useRef(null);

  const handleMouseEnter = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
    }
    setShowSidebar(true);
  };

  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => {
      setShowSidebar(false);
    }, 200);
  };

  const navItems = [
    {
      label: 'Blocks',
      icon: <Database className="w-5 h-5" />,
      onClick: onShowBlocks,
      active: selectedView === 'blocks'
    },
    {
      label: 'Transactions',
      icon: <Activity className="w-5 h-5" />,
      onClick: onShowTransactions,
      active: selectedView === 'transactions'
    },
    {
      label: 'Analytics',
      icon: <LineChart className="w-5 h-5" />,
      onClick: onShowAnalytics,
      active: selectedView === 'analytics'
    },
    {
      label: 'Charts',
      icon: <BarChart2 className="w-5 h-5" />,
      onClick: onShowCharts,
      active: selectedView === 'charts'
    }
  ];

  return (
    <nav className="bg-gray-900 text-white px-4 py-3 shadow-md flex justify-between items-center sticky top-0 z-50">
      {/* Left Side - Navigation Items */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <AnalyticsLogo width={28} height={28} className="text-blue-500" />
          <span className="text-lg font-bold">Bitcoin Analytics</span>
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
        <button
          onClick={onShowSearch}
          className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-gray-800 transition-colors duration-200"
        >
          <Search className="w-5 h-5" />
          <span className="font-medium">Search</span>
        </button>
      </div>
    </nav>
  );
};

export default React.memo(Navbar);