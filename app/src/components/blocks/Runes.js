// app/components/blocks/Runes

import React, { useState } from 'react';
import { Coins } from 'lucide-react';

const Runes = ({ runes, loading = false }) => {
  const [expandedRune, setExpandedRune] = useState(null);

  const handleRuneClick = (index) => {
    if (expandedRune === index) {
      setExpandedRune(null);
    } else {
      setExpandedRune(index);
    }
  };

  if (loading) {
    return (
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Runes in Block</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!runes || runes.length === 0) {
    return (
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Runes in Block</h3>
        <div className="flex flex-col items-center justify-center text-center text-gray-500 mt-4">
          <Coins className="w-12 h-12 text-gray-400" />
          <p className="mt-2">No runes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="text-xl font-semibold mb-4">Runes in Block</h3>
      <div className="bg-gray-800 rounded-lg p-4 text-white font-mono">
        <p>runes: Array({runes.length}) {'{'}</p>
        {runes.map((rune, index) => (
          <div key={index} className="ml-4">
            <span 
              className="cursor-pointer text-blue-400 hover:underline"
              onClick={() => handleRuneClick(index)}
            >
              {index}: "{rune}"
            </span>
            {expandedRune === index && (
              <div className="ml-4 mt-2 text-gray-400">
                {/* Add more details here if available */}
                <p>Additional rune details would go here</p>
              </div>
            )}
          </div>
        ))}
        <p>{'}'}</p>
        <p className="mt-2">length: {runes.length}</p>
      </div>
    </div>
  );
};

export default Runes;