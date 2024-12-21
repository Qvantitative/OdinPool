import React, { useState, memo } from 'react';
import TrendingCollections from './TrendingCollections';
import TrendingRunes from './charts/TrendingRunes';

const TABS = {
  COLLECTIONS: 'collections',
  RUNES: 'runes',
};

function TrendingWrapper() {
  const [activeView, setActiveView] = useState(TABS.COLLECTIONS);

  const handleViewChange = (view) => {
    console.log(`Switching to ${view} view`);
    setActiveView(view);
  };

  const isCollections = activeView === TABS.COLLECTIONS;
  const isRunes = activeView === TABS.RUNES;

  return (
    <div className="w-full max-w-[1600px] mx-auto">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleViewChange(TABS.COLLECTIONS)}
          className={`px-4 py-2 rounded ${
            isCollections
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Collections
        </button>
        <button
          onClick={() => handleViewChange(TABS.RUNES)}
          className={`px-4 py-2 rounded ${
            isRunes
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Runes
        </button>
      </div>

      {isCollections ? <TrendingCollections /> : <TrendingRunes />}
    </div>
  );
}

export default memo(TrendingWrapper);
