import React, { useState, memo } from 'react';
import TrendingCollections from './TrendingCollections';
import TrendingRunes from './TrendingRunes';

const TrendingWrapper = () => {
  const [activeView, setActiveView] = useState('collections');

  const handleViewChange = (view) => {
    console.log(`Switching to ${view} view`);
    setActiveView(view);
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleViewChange('collections')}
          className={`px-4 py-2 rounded ${
            activeView === 'collections'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Collections
        </button>
        <button
          onClick={() => handleViewChange('runes')}
          className={`px-4 py-2 rounded ${
            activeView === 'runes'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Runes
        </button>
      </div>

      {activeView === 'collections' ? (
        <TrendingCollections />
      ) : (
        <TrendingRunes />
      )}
    </div>
  );
};

export default memo(TrendingWrapper);
