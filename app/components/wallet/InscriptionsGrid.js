import React from 'react';

const InscriptionsGrid = ({ inscriptions, setActiveInscription }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mt-8">
    {inscriptions.map((inscription) => (
      <div
        key={inscription.inscriptionId}
        className="border border-gray-500 p-2 rounded cursor-pointer"
        onClick={() => setActiveInscription(inscription)}
      >
        <div className="w-full">
          {inscription.contentType.startsWith('image/svg+xml') ? (
            <object
              data={`https://ordinals.com/content/${inscription.inscriptionId}`}
              type="image/svg+xml"
              className="w-full h-auto object-cover pointer-events-none"
            >
              <p>SVG image not supported</p>
            </object>
          ) : inscription.contentType.startsWith('image') ? (
            <img
              src={`https://ordinals.com/content/${inscription.inscriptionId}`}
              alt={`Inscription ${inscription.inscriptionId}`}
              className="w-full h-auto object-cover"
            />
          ) : (
            <p>Unsupported content type</p>
          )}
        </div>
      </div>
    ))}
  </div>
);

export default InscriptionsGrid;
