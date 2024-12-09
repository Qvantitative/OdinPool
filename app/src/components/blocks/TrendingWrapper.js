// app/components/blocks/TrendingWrapper.js

import React, { useState, memo } from 'react';
import TrendingCollections from './TrendingCollections';
import TrendingRunes from './TrendingRunes';

const TrendingWrapper = () => {  // Remove the props
  const [activeView, setActiveView] = useState('collections');

  return (
    <div className="w-full max-w-[1600px] mx-auto mt-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveView('collections')}
            className={`px-4 py-2 rounded-md transition-colors duration-200 ${
              activeView === 'collections'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Collections
          </button>
          <button
            onClick={() => setActiveView('runes')}
            className={`px-4 py-2 rounded-md transition-colors duration-200 ${
              activeView === 'runes'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Runes
          </button>
        </div>
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