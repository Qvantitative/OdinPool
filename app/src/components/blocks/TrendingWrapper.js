// app/components/blocks/TrendingWrapper.js

import React, { useState, memo } from 'react';
import TrendingCollections from './TrendingCollections';
import TrendingRunes from './TrendingRunes';

const TrendingWrapper = () => {
  const [activeView, setActiveView] = useState('collections');

  return (
    <div className="w-full max-w-[1600px] mx-auto">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveView('collections')}
          className={`px-4 py-2 rounded ${
            activeView === 'collections'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Collections
        </button>
        <button
          onClick={() => setActiveView('runes')}
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