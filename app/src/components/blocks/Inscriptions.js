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
        // Add retry logic for network errors
        const fetchWithRetry = async (url, options, retries = 3) => {
          for (let i = 0; i < retries; i++) {
            try {
              const response = await axiosInstanceWithoutSSL.get(url, options);
              return response;
            } catch (err) {
              if (i === retries - 1) throw err;
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
          }
        };

        // Fetch details with retry
        const detailsResponse = await fetchWithRetry(`/inscription/${inscriptionId}`);
        const details = detailsResponse.data;

        // Only try to fetch content if we successfully got the details
        if (details) {
          try {
            // Fetch the content and determine content type
            const contentResponse = await fetchWithRetry(`/content/${inscriptionId}`, {
              responseType: 'blob',
            });

            const contentType = contentResponse.headers['content-type'];

            // Handle image or SVG
            if (contentType.startsWith('image/')) {
              let imageUrl;
              if (contentType === 'image/svg+xml') {
                // If SVG, handle as text and create a Blob for the SVG content
                const svgText = await contentResponse.data.text();
                const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
                imageUrl = URL.createObjectURL(svgBlob);
              } else {
                // For other images, handle as blob directly
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
              // Handle text content
              const textContent = await contentResponse.data.text();
              images[inscriptionId] = {
                content: textContent,
                type: 'text',
                rune: details.rune,
                details: details,
              };
            } else {
              // Handle unsupported content
              images[inscriptionId] = {
                type: 'unsupported',
                rune: details.rune,
                details: details,
              };
            }
          } catch (contentErr) {
            console.error(`Error fetching content for inscription ${inscriptionId}:`, contentErr);
            // Still store the details even if content fetch failed
            images[inscriptionId] = {
              type: 'error',
              error: 'Content unavailable',
              rune: details.rune,
              details: details,
            };
          }
        }
      } catch (err) {
        console.error(`Error fetching data for inscription ${inscriptionId}:`, err);
        images[inscriptionId] = {
          type: 'error',
          error: err.message || 'Network Error',
        };
      }
    })
  );

  setInscriptionImages((prevImages) => ({ ...prevImages, ...images }));
  setLoading(false);
};

const handleInscriptionClick = async (inscriptionId, inscriptionData, setSelectedInscription) => {
  // Log all available data
  console.log('Inscription ID:', inscriptionId);
  console.log('Inscription Data:', inscriptionData);

  // Make the API call and log the response
  try {
    const response = await axiosInstanceWithoutSSL.get(`/inscription/${inscriptionId}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    console.log('API Response:', response.data);
    // Include the image data in the selectedInscription state
    setSelectedInscription({
      ...response.data,
      inscriptionData, // This contains the image or content data
    });
  } catch (error) {
    console.error('Error fetching inscription data:', error);
  }
};

const Inscriptions = ({ blockDetails, onAddressClick }) => {
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

  const navItems = [
    {
      label: 'ImageOff',
      icon: <ImageOff className="w-12 h-12 text-gray-400" />,
      onClick: () => {},
      active: false,
    },
  ];

  const renderInscriptionItem = (inscriptionId, inscriptionData, index) => {
    return (
      <div
        key={index}
        className="flex flex-col items-center"
        onClick={() =>
          handleInscriptionClick(inscriptionId, inscriptionData, setSelectedInscription)
        }
      >
        <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer bg-gray-800">
          {inscriptionData ? (
            inscriptionData.type === 'error' ? (
              <div className="flex items-center justify-center h-full p-4 bg-gray-700 text-red-400 rounded-2xl">
                <div className="text-center">
                  <p className="font-medium mb-2">Error Loading Inscription</p>
                  <p className="text-sm opacity-75">{inscriptionData.error}</p>
                </div>
              </div>
            ) : inscriptionData.type === 'image' ? (
              <img
                src={inscriptionData.url}
                alt={`Inscription ${inscriptionId}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : inscriptionData.type === 'text' ? (
              <div className="flex items-center justify-center h-full p-4 bg-gray-700 text-gray-200 rounded-2xl">
                <pre className="text-sm overflow-auto max-h-full max-w-full text-center">
                  {inscriptionData.content}
                </pre>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm bg-gray-700 text-gray-300 rounded-2xl">
                Unsupported content type
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full text-sm bg-gray-700 text-gray-300 rounded-2xl">
              Loading content...
            </div>
          )}
        </div>
        {inscriptionData && inscriptionData.rune ? (
          <p className="mt-3 text-sm text-center truncate max-w-full text-gray-200">
            {inscriptionData.rune}
          </p>
        ) : (
          <p className="mt-3 text-sm text-center truncate max-w-full text-gray-500">
            {inscriptionId.slice(0, 8)}...
          </p>
        )}
      </div>
    );
  };

  const renderSelectedInscriptionDetails = () => {
    if (!selectedInscription) return null;

    const { inscriptionData, ...details } = selectedInscription;

    // Format the details to ensure consistent key names
    const formattedDetails = {
      ...details,
      // If address comes in a different format, ensure it's standardized
      address: details.address || details.output_address || details.wallet_address
    };

    const renderValue = (key, value) => {
      // Check if the key is exactly "address" or contains "address" (case-insensitive)
      const isAddress = key === 'address' || key.toLowerCase().includes('address');

      // Added console.log for debugging
      console.log('Key:', key, 'Is Address:', isAddress);

      if (isAddress && onAddressClick && value) {
        return (
          <span
            className="text-blue-400 hover:text-blue-300 cursor-pointer underline"
            onClick={(e) => {
              e.stopPropagation(); // Prevent event bubbling
              onAddressClick(value);
            }}
          >
            {value}
          </span>
        );
      }

      // For non-address values, render normally
      return (
        <span className="text-gray-200 break-all">
          {typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
        </span>
      );
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-gray-800 rounded-2xl p-6 max-w-7xl w-full max-h-[95vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-semibold text-gray-200">Inscription Details</h3>
            <button
              onClick={() => setSelectedInscription(null)}
              className="text-gray-400 hover:text-gray-200 text-2xl"
            >
              ×
            </button>
          </div>
          <div className="flex">
            <div className="w-2/3 pr-6 border-r border-gray-700">
              {inscriptionData.type === 'image' ? (
                <img
                  src={inscriptionData.url}
                  alt={`Inscription ${formattedDetails.inscriptionId}`}
                  className="w-full h-auto max-h-[80vh] object-contain rounded-2xl shadow-md"
                />
              ) : inscriptionData.type === 'text' ? (
                <div className="flex items-center justify-center h-full p-4 bg-gray-700 text-gray-200 rounded-2xl shadow-md">
                  <pre className="text-sm overflow-auto max-h-full max-w-full text-center">
                    {inscriptionData.content}
                  </pre>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-sm bg-gray-700 text-gray-300 rounded-2xl">
                  Unsupported content type
                </div>
              )}
            </div>
            <div className="w-1/3 pl-6 space-y-4">
              {Object.entries(formattedDetails).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-gray-400 text-sm font-medium">{key}</span>
                  {renderValue(key, value)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const hasNonTextInscriptions = () => {
    return Object.values(inscriptionImages).some((data) => data && data.type === 'image');
  };

  const hasTextInscriptions = () => {
    return Object.values(inscriptionImages).some((data) => data && data.type === 'text');
  };

  const filteredInscriptions = blockDetails?.inscriptions?.filter((inscriptionId) => {
    const inscriptionData = inscriptionImages[inscriptionId];
    return !hideTextInscriptions || (inscriptionData && inscriptionData.type !== 'text');
  });

  const shouldShowNoInscriptions =
    !loading &&
    ((hideTextInscriptions && !hasNonTextInscriptions()) ||
      (!hideTextInscriptions && !hasTextInscriptions() && !hasNonTextInscriptions()));

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-semibold text-gray-200">Inscriptions in Block</h3>
        <button
          onClick={toggleTextInscriptions}
          className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors shadow-md"
        >
          {hideTextInscriptions ? 'Show Text Inscriptions' : 'Hide Text Inscriptions'}
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
        </div>
      ) : shouldShowNoInscriptions ? (
        <div className="flex flex-col items-center justify-center text-center text-gray-400 mt-4">
          {navItems[0].icon}
          <p className="mt-2">No inscriptions</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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