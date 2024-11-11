// app/components/blocks/Inscriptions

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import https from 'https';
import { ImageOff } from 'lucide-react';

const axiosInstanceWithSSL = axios.create({
  baseURL: process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : '/ord',
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

const axiosInstanceWithoutSSL = axios.create({
  baseURL: process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : '/ord',
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

const fetchInscriptionImages = async (inscriptionsList, setInscriptionImages, setLoading) => {
  if (!inscriptionsList || inscriptionsList.length === 0) {
    setLoading(false);
    return;
  }

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
          let imageUrl;
          if (contentType === 'image/svg+xml') {
            const svgText = await contentResponse.data.text();
            const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
            imageUrl = URL.createObjectURL(svgBlob);
          } else {
            const blob = new Blob([contentResponse.data]);
            imageUrl = URL.createObjectURL(blob);
          }

          images[inscriptionId] = {
            url: imageUrl,
            type: 'image',
            rune: details.rune,
            details: details,
          };
        } else if (contentType.startsWith('text/')) {
          const textContent = await contentResponse.data.text();
          images[inscriptionId] = {
            content: textContent,
            type: 'text',
            rune: details.rune,
            details: details,
          };
        } else {
          images[inscriptionId] = {
            type: 'unsupported',
            rune: details.rune,
            details: details,
          };
        }
      } catch (err) {
        console.error(`Error fetching data for inscription ${inscriptionId}:`, err);
        images[inscriptionId] = null;
      }
    })
  );

  setInscriptionImages((prevImages) => ({ ...prevImages, ...images }));
  setLoading(false);
};

const handleInscriptionClick = async (inscriptionId, inscriptionData, setSelectedInscription) => {
  try {
    const response = await axiosInstanceWithoutSSL.get(`/inscription/${inscriptionId}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    setSelectedInscription(response.data);
  } catch (error) {
    console.error('Error fetching inscription data:', error);
  }
};

const Inscriptions = ({ blockDetails }) => {
  const [inscriptionImages, setInscriptionImages] = useState({});
  const [hideTextInscriptions, setHideTextInscriptions] = useState(true);
  const [selectedInscription, setSelectedInscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (blockDetails && blockDetails.inscriptions) {
      setLoading(true);
      fetchInscriptionImages(blockDetails.inscriptions, setInscriptionImages, setLoading);
    } else {
      setLoading(false);
    }
  }, [blockDetails]);

  const toggleTextInscriptions = () => {
    setHideTextInscriptions(!hideTextInscriptions);
  };

  const renderInscriptionItem = (inscriptionId, inscriptionData, index) => (
    <div
      key={index}
      className="flex flex-col items-center"
      onClick={() => handleInscriptionClick(inscriptionId, inscriptionData, setSelectedInscription)}
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
            <div className="flex items-center justify-center h-full p-4 bg-gray-800 text-gray-200 rounded-lg">
              <pre className="text-xs overflow-auto max-h-full max-w-full text-center">
                {inscriptionData.content}
              </pre>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm bg-gray-700 text-gray-300 rounded-lg">
              Unsupported content type
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-sm bg-gray-700 text-gray-300 rounded-lg">
            Loading content...
          </div>
        )}
      </div>
    </div>
  );

  const renderSelectedInscriptionDetails = () => {
    if (!selectedInscription) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto flex space-x-6">
          <div className="flex-shrink-0 w-1/2">
            {selectedInscription.url ? (
              <img
                src={selectedInscription.url}
                alt="Selected Inscription"
                className="w-full h-auto rounded-lg shadow-md"
              />
            ) : (
              <div className="text-gray-500 text-center">No Image Available</div>
            )}
          </div>
          <div className="flex-grow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">Inscription Details</h3>
              <button
                onClick={() => setSelectedInscription(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              {Object.entries(selectedInscription).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-gray-400 text-sm">{key}</span>
                  <span className="text-white break-all">{JSON.stringify(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const filteredInscriptions = blockDetails?.inscriptions?.filter((inscriptionId) => {
    const inscriptionData = inscriptionImages[inscriptionId];
    return !hideTextInscriptions || (inscriptionData && inscriptionData.type !== 'text');
  });

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
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {filteredInscriptions.map((inscriptionId, index) => {
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
      )}
      {renderSelectedInscriptionDetails()}
    </div>
  );
};

export default Inscriptions;
