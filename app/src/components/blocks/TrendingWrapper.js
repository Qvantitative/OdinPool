import React, { useState, memo } from 'react';
import TrendingCollections from './TrendingCollections';
import TrendingRunes from './charts/TrendingRunes';
import RunesDetails from './RunesDetails';

const TABS = {
  COLLECTIONS: 'collections',
  RUNES: 'runes',
};

function TrendingWrapper() {
  const [activeView, setActiveView] = useState(TABS.COLLECTIONS);
  const [selectedRuneTicker, setSelectedRuneTicker] = useState(null); // Track the selected rune ticker

  const handleViewChange = (view) => {
    setActiveView(view);
    setSelectedRuneTicker(null); // Reset rune selection when switching tabs
  };

  const handleRuneClick = (runeTicker) => {
    setSelectedRuneTicker(runeTicker); // Set the selected rune ticker
  };

  const handleBackToRunes = () => {
    setSelectedRuneTicker(null); // Clear selected rune to return to TrendingRunes
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto">
      {/* Tab Selection */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleViewChange(TABS.COLLECTIONS)}
          className={`px-4 py-2 rounded ${
            activeView === TABS.COLLECTIONS
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Collections
        </button>
        <button
          onClick={() => handleViewChange(TABS.RUNES)}
          className={`px-4 py-2 rounded ${
            activeView === TABS.RUNES
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Runes
        </button>
      </div>

      {/* Conditional Rendering */}
      {activeView === TABS.COLLECTIONS && <TrendingCollections />}
      {activeView === TABS.RUNES && (
        <>
          {!selectedRuneTicker ? (
            // Show TrendingRunes if no rune is selected
            <TrendingRunes onRuneClick={handleRuneClick} />
          ) : (
            // Show RunesDetails if a rune is selected
            <RunesDetails runeTicker={selectedRuneTicker} onBack={handleBackToRunes} />
          )}
        </>
      )}
    </div>
  );
}

export default memo(TrendingWrapper);
