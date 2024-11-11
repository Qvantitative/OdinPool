// app/components/blocks/Wallet.js

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

const fetchWalletInscriptions = async (
  address,
  setInscriptionImages,
  setLoading,
  setError
) => {
  if (!address) {
    setLoading(false);
    return;
  }

  setLoading(true);
  setError(null);

  try {
    // Now we can use the same paths as Inscriptions.js
    const addressResponse = await axiosInstanceWithoutSSL.get(
      `/address/${address}`  // No need for /ord/ prefix as it's in the baseURL
    );

    const inscriptionsList = addressResponse.data?.inscriptions || [];

    // Rest of the function remains the same but using paths without /ord/ prefix
    await Promise.all(
      inscriptionsList.map(async (inscriptionId) => {
        try {
          const detailsResponse = await axiosInstanceWithoutSSL.get(
            `/inscription/${inscriptionId}`
          );
          const details = detailsResponse.data;

          if (details) {
            try {
              const contentResponse = await axiosInstanceWithSSL.get(
                `/ord/content/${inscriptionId}`,  // Changed path to match rewrite rules
                {
                  responseType: 'blob',
                }
              );
              // Rest of the function remains the same...
            } catch (contentErr) {
              console.error(`Error fetching content for inscription ${inscriptionId}:`, contentErr);
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
  } catch (error) {
    console.error(`Error fetching data for address ${address}:`, error);
    setError(`Error loading wallet: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

const handleInscriptionClick = async (
  inscriptionId,
  inscriptionData,
  setSelectedInscription
) => {
  // Log all available data
  console.log('Inscription ID:', inscriptionId);
  console.log('Inscription Data:', inscriptionData);

  // Make the API call and log the response
  try {
    const response = await axiosInstanceWithoutSSL.get(
      `/inscription/${inscriptionId}`,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
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

const Wallet = ({ address }) => {
  const [inscriptionImages, setInscriptionImages] = useState({});
  const [hideTextInscriptions, setHideTextInscriptions] = useState(true);
  const [selectedInscription, setSelectedInscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (address) {
      fetchWalletInscriptions(address, setInscriptionImages, setLoading);
    } else {
      setLoading(false);
    }
  }, [address]);

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
          handleInscriptionClick(
            inscriptionId,
            inscriptionData,
            setSelectedInscription
          )
        }
      >
        <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer bg-gray-800">
          {inscriptionData ? (
            inscriptionData.type === 'image' ? (
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

  // Selected inscription details panel
  const renderSelectedInscriptionDetails = () => {
    if (!selectedInscription) return null;

    const { inscriptionData, ...details } = selectedInscription;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-gray-800 rounded-2xl p-6 max-w-7xl w-full max-h-[95vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-semibold text-gray-200">
              Inscription Details
            </h3>
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
                  alt={`Inscription ${details.inscriptionId}`}
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
              {Object.entries(details).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-gray-400 text-sm font-medium">
                    {key}
                  </span>
                  <span className="text-gray-200 break-all">
                    {typeof value === 'object'
                      ? JSON.stringify(value, null, 2)
                      : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const hasNonTextInscriptions = () => {
    return Object.values(inscriptionImages).some(
      (data) => data && data.type === 'image'
    );
  };

  const hasTextInscriptions = () => {
    return Object.values(inscriptionImages).some(
      (data) => data && data.type === 'text'
    );
  };

  const inscriptionsList = Object.keys(inscriptionImages);

  const filteredInscriptions = inscriptionsList.filter((inscriptionId) => {
    const inscriptionData = inscriptionImages[inscriptionId];
    return (
      !hideTextInscriptions || (inscriptionData && inscriptionData.type !== 'text')
    );
  });

  const shouldShowNoInscriptions =
    !loading &&
    ((hideTextInscriptions && !hasNonTextInscriptions()) ||
      (!hideTextInscriptions &&
        !hasTextInscriptions() &&
        !hasNonTextInscriptions()));

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-semibold text-gray-200">
          Inscriptions for Address
        </h3>
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
              (inscriptionData.type === 'text' ||
                inscriptionData.type === 'unsupported')
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

export default Wallet;
