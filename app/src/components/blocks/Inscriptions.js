// app/components/blocks/Inscriptions

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import https from 'https';

// Create axios instances with base URLs
const axiosInstanceWithSSL = axios.create({
  baseURL: 'http://68.9.235.71:3000', // Switched to HTTP
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

const axiosInstanceWithoutSSL = axios.create({
  baseURL: 'http://143.198.17.64:3001/api/ord', // Switched to HTTP
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

// Function to fetch inscription images with retry mechanism
const fetchInscriptionImages = async (inscriptionsList, setInscriptionImages) => {
  if (!inscriptionsList || inscriptionsList.length === 0) return;

  const images = {};

  await Promise.all(
    inscriptionsList.map(async (inscriptionId) => {
      try {
        const detailsResponse = await axiosInstanceWithoutSSL.get(`/inscription/${inscriptionId}`);
        const details = detailsResponse.data;

        const contentResponse = await axiosInstanceWithSSL.get(`/content/${inscriptionId}`, {
          responseType: 'blob',
        });
        const contentType = contentResponse.headers['content-type'];

        if (contentType.startsWith('image/')) {
          const blob = new Blob([contentResponse.data]);
          const imageUrl = URL.createObjectURL(blob);
          images[inscriptionId] = {
            url: imageUrl,
            type: 'image',
            rune: details.rune,
          };
        } else if (contentType.startsWith('text/')) {
          const textContent = await contentResponse.data.text();
          images[inscriptionId] = {
            content: textContent,
            type: 'text',
            rune: details.rune,
          };
        } else {
          images[inscriptionId] = { type: 'unsupported', rune: details.rune };
        }
      } catch (err) {
        console.error(`Error fetching data for inscription ${inscriptionId}:`, err);
        images[inscriptionId] = null;
      }
    })
  );

  setInscriptionImages((prevImages) => ({ ...prevImages, ...images }));
};

// Function to handle click events on inscriptions
const handleInscriptionClick = async (inscriptionId, setInscriptionData) => {
  try {
    const response = await axiosInstanceWithoutSSL.get(`/inscription/${inscriptionId}`);
    setInscriptionData(response.data);
  } catch (error) {
    console.error('Error fetching inscription data:', error);
  }
};

// Component definition
const Inscriptions = ({ blockDetails }) => {
  const [inscriptionImages, setInscriptionImages] = useState({});
  const [hideTextInscriptions, setHideTextInscriptions] = useState(true);
  const [inscriptionData, setInscriptionData] = useState(null);

  // Fetch inscriptions when blockDetails change
  useEffect(() => {
    if (blockDetails && blockDetails.inscriptions) {
      fetchInscriptionImages(blockDetails.inscriptions, setInscriptionImages);
    }
  }, [blockDetails]);

  const toggleTextInscriptions = () => {
    setHideTextInscriptions(!hideTextInscriptions);
  };

  const renderInscriptionItem = (inscriptionId, inscriptionData, index) => {
    return (
      <div
        key={index}
        className="flex flex-col items-center"
        onClick={() => handleInscriptionClick(inscriptionId, setInscriptionData)}
      >
        <div className="w-full aspect-square rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer">
          {inscriptionData ? (
            inscriptionData.type === 'image' ? (
              <img
                src={inscriptionData.url}
                alt={`Inscription ${inscriptionId}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : inscriptionData.type === 'text' ? (
              <div className="flex items-center justify-center h-full p-4 bg-gray-100">
                <pre className="text-xs overflow-auto max-h-full max-w-full text-center">
                  {inscriptionData.content}
                </pre>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm bg-gray-200">
                Unsupported content type
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full text-sm bg-gray-100">
              Loading content...
            </div>
          )}
        </div>
        {inscriptionData && inscriptionData.rune ? (
          <p className="mt-3 text-xs text-center truncate max-w-full">
            {inscriptionData.rune}
          </p>
        ) : (
          <p className="mt-3 text-xs text-center truncate max-w-full text-gray-500">
            {inscriptionId.slice(0, 8)}...
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Inscriptions in Block</h3>
        <button
          onClick={toggleTextInscriptions}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          {hideTextInscriptions ? 'Show Text' : 'Hide Text'}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {blockDetails?.inscriptions?.map((inscriptionId, index) => {
          const inscriptionData = inscriptionImages[inscriptionId];
          if (
            hideTextInscriptions &&
            inscriptionData &&
            (inscriptionData.type === 'text' || inscriptionData.type === 'unsupported')
          ) {
            return null;
          }
          return renderInscriptionItem(inscriptionId, inscriptionData, index);
        })}
      </div>
    </div>
  );
};

export default Inscriptions;
