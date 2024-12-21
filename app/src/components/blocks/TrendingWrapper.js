// app/components/blocks/TrendingWrapper.js

import React, { useState, memo } from 'react';
import TrendingCollections from './TrendingCollections';
import TrendingRunes from './TrendingRunes';

const TrendingWrapper = () => {
  const [activeView, setActiveView] = useState('collections');

  return (
    <div className="w-full">
      <h1 className="text-xl font-bold text-white text-center mb-2">Onchain Data Analytics</h1>
      <p className="text-sm text-gray-400 text-center mb-4">Real-time blockchain data and analytics dashboard</p>

      <div className="flex justify-center mb-4">
        <div className="inline-flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveView('collections')}
            className={`px-4 py-1 text-sm rounded ${
              activeView === 'collections'
                ? 'bg-blue-500 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Collections
          </button>
          <button
            onClick={() => setActiveView('runes')}
            className={`px-4 py-1 text-sm rounded ${
              activeView === 'runes'
                ? 'bg-blue-500 text-white'
                : 'text-gray-300 hover:text-white'
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