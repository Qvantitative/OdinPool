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

const fetchWithRetry = async (url, options, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axiosInstanceWithoutSSL.get(url, options);
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
};

const fetchWalletInscriptions = async (address, setInscriptionImages, setLoading, setError) => {
  if (!address) {
    setLoading(false);
    return;
  }

  setLoading(true);
  setError(null);

  try {
    const response = await axiosInstanceWithoutSSL.get(`/address/${address}`, {
      headers: { Accept: 'text/html' }
    });

    const htmlString = response.data;
    console.log("Fetched HTML String:", htmlString); // Log the raw HTML string

    // Parse the HTML string using DOMParser (available in the browser)
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // Find all <a> tags under <dd class="thumbnails">
    const inscriptionElements = doc.querySelectorAll('dd.thumbnails a');

    // Extract inscription IDs and hrefs
    const images = {};
    inscriptionElements.forEach(element => {
      const href = element.getAttribute('href');
      const inscriptionId = href.split('/').pop();  // Get the last part of the URL path

      images[inscriptionId] = {
        type: 'image',
        url: href,  // Use href as the direct image URL
      };
    });

    setInscriptionImages(images);
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
  try {
    const response = await axiosInstanceWithoutSSL.get(`/inscription/${inscriptionId}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    setSelectedInscription({
      ...response.data,
      inscriptionData,
    });
  } catch (error) {
    console.error('Error fetching inscription data:', error);
  }
};

const Wallet = ({ address, onAddressClick }) => {
  const [inscriptionImages, setInscriptionImages] = useState({});
  const [hideTextInscriptions, setHideTextInscriptions] = useState(true);
  const [selectedInscription, setSelectedInscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);  // Added error state

  useEffect(() => {
    if (address) {
      fetchWalletInscriptions(address, setInscriptionImages, setLoading, setError);
    } else {
      setLoading(false);
    }
  }, [address]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-red-500">
        <h3 className="text-xl font-semibold mb-4">Error</h3>
        <p>{error}</p>
      </div>
    );
  }

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
        <p className="mt-3 text-sm text-center truncate max-w-full text-gray-500">
          {inscriptionId.slice(0, 8)}...
        </p>
      </div>
    );
  };

  // Selected inscription details panel
  const renderSelectedInscriptionDetails = () => {
    if (!selectedInscription) return null;

    const { inscriptionData, ...details } = selectedInscription;

    const renderValue = (key, value) => {
      // Check if the key is exactly "address" or contains "address" (case-insensitive)
      const isAddress = key === 'address' || key.toLowerCase().includes('address');

      if (isAddress && value && typeof value === 'string') {
        // Clean up the address if it's part of a satpoint
        const cleanAddress = value.split(':')[0];
        return (
          <span
            className="text-blue-400 hover:text-blue-300 cursor-pointer underline"
            onClick={(e) => {
              e.stopPropagation();
              onAddressClick?.(cleanAddress);  // Use the prop instead of window.location
            }}
          >
            {cleanAddress}
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
          Inscriptions for Address {address}
        </h3>
        <button
          onClick={() => setHideTextInscriptions(!hideTextInscriptions)}
          className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors shadow-md"
        >
          {hideTextInscriptions ? 'Show Text Inscriptions' : 'Hide Text Inscriptions'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
        </div>
      ) : !Object.keys(inscriptionImages).length ? (
        <div className="flex flex-col items-center justify-center text-center text-gray-400 mt-4">
          <ImageOff className="w-12 h-12" />
          <p className="mt-2">No inscriptions found for this address</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Object.entries(inscriptionImages).map(([inscriptionId, inscriptionData], index) => {
            if (hideTextInscriptions && inscriptionData?.type === 'text') {
              return null;
            }
            return (
              <div
                key={inscriptionId}
                className="flex flex-col items-center"
                onClick={() => handleInscriptionClick(inscriptionId, inscriptionData, setSelectedInscription)}
              >
                <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer bg-gray-800">
                  {renderInscriptionContent(inscriptionId, inscriptionData)}
                </div>
                {renderInscriptionCaption(inscriptionId, inscriptionData)}
              </div>
            );
          })}
        </div>
      )}

      {selectedInscription && renderSelectedInscriptionDetails()}
    </div>
  );
};

const renderInscriptionContent = (inscriptionId, inscriptionData) => {
  if (!inscriptionData) {
    return (
      <div className="flex items-center justify-center h-full text-sm bg-gray-700 text-gray-300 rounded-2xl">
        Loading content...
      </div>
    );
  }

  switch (inscriptionData.type) {
    case 'image':
      return (
        <img
          src={inscriptionData.url}
          alt={`Inscription ${inscriptionId}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      );
    case 'text':
      return (
        <div className="flex items-center justify-center h-full p-4 bg-gray-700 text-gray-200 rounded-2xl">
          <pre className="text-sm overflow-auto max-h-full max-w-full text-center">
            {inscriptionData.content}
          </pre>
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center h-full text-sm bg-gray-700 text-gray-300 rounded-2xl">
          Unsupported content type
        </div>
      );
  }
};

const renderInscriptionCaption = (inscriptionId, inscriptionData) => (
  <p className="mt-3 text-sm text-center truncate max-w-full text-gray-500">
    {inscriptionData?.rune || inscriptionId.slice(0, 8) + '...'}
  </p>
);


export default Wallet;
