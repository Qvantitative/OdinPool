import React, { useState } from 'react';

const Runes = ({ runes }) => {
  const [expandedRune, setExpandedRune] = useState(null);

  const handleRuneClick = (index) => {
    if (expandedRune === index) {
      setExpandedRune(null);
    } else {
      setExpandedRune(index);
    }
  };

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