// app/components/blocks/Wallet.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import https from 'https';
import { ImageOff } from 'lucide-react';

// Create an axios instance for making network requests
const axiosInstance = axios.create({
  baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '/ord',
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

// Caches for storing fetched data
const addressCache = {};
const inscriptionContentTypeCache = {};
const inscriptionContentCache = {};
const inscriptionDetailsCache = {};

// Function to fetch wallet inscriptions with caching
const fetchWalletInscriptions = async (address, setInscriptionImages, setLoading, setError) => {
  if (!address) {
    setLoading(false);
    return;
  }

  setLoading(true);
  setError(null);

  try {
    let htmlString;

    // Check if the HTML response for the address is cached
    if (addressCache[address]) {
      htmlString = addressCache[address];
    } else {
      const response = await axiosInstance.get(`/address/${address}`, {
        headers: { Accept: 'text/html' },
      });
      htmlString = response.data;
      addressCache[address] = htmlString; // Cache the HTML response
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const inscriptionElements = doc.querySelectorAll('dd.thumbnails a');

    const images = {};

    await Promise.all(
      Array.from(inscriptionElements).map(async (element) => {
        const href = element.getAttribute('href');
        const inscriptionId = href.split('/').pop();

        // Skip if we already have this inscription data
        if (images[inscriptionId]) {
          return;
        }

        try {
          let contentType;

          // Check if the content type is cached
          if (inscriptionContentTypeCache[inscriptionId]) {
            contentType = inscriptionContentTypeCache[inscriptionId];
          } else {
            const headResponse = await axiosInstance.head(`/content/${inscriptionId}`);
            contentType = headResponse.headers['content-type'];
            inscriptionContentTypeCache[inscriptionId] = contentType; // Cache the content type
          }

          // Fetch and cache the content based on the content type
          if (contentType.includes('application/json')) {
            let content;
            if (inscriptionContentCache[inscriptionId]) {
              content = inscriptionContentCache[inscriptionId];
            } else {
              const jsonResponse = await axiosInstance.get(`/content/${inscriptionId}`, {
                responseType: 'text',
              });
              content = jsonResponse.data;
              inscriptionContentCache[inscriptionId] = content; // Cache the content
            }

            try {
              const parsedJson = JSON.parse(content);
              images[inscriptionId] = {
                content: parsedJson,
                type: 'json',
                contentType: contentType,
              };
            } catch (jsonError) {
              images[inscriptionId] = {
                content: content,
                type: 'json',
                error: 'Invalid JSON format',
              };
            }
          } else if (contentType.startsWith('image/')) {
            let imageUrl;
            if (inscriptionContentCache[inscriptionId]) {
              imageUrl = inscriptionContentCache[inscriptionId];
            } else {
              const contentResponse = await axiosInstance.get(`/content/${inscriptionId}`, {
                responseType: 'blob',
              });
              if (contentType === 'image/svg+xml') {
                const svgText = await contentResponse.data.text();
                const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
                imageUrl = URL.createObjectURL(svgBlob);
              } else {
                imageUrl = URL.createObjectURL(contentResponse.data);
              }
              inscriptionContentCache[inscriptionId] = imageUrl; // Cache the image URL
            }
            images[inscriptionId] = {
              url: imageUrl,
              type: 'image',
            };
          } else if (contentType.startsWith('text/')) {
            let content;
            if (inscriptionContentCache[inscriptionId]) {
              content = inscriptionContentCache[inscriptionId];
            } else {
              const contentResponse = await axiosInstance.get(`/content/${inscriptionId}`, {
                responseType: 'text',
              });
              content = contentResponse.data;
              inscriptionContentCache[inscriptionId] = content; // Cache the content
            }
            images[inscriptionId] = {
              content: content,
              type: 'text',
            };
          } else {
            images[inscriptionId] = {
              type: 'unsupported',
              contentType: contentType,
            };
          }
        } catch (contentErr) {
          console.error(`Error fetching content for inscription ${inscriptionId}:`, contentErr);
          images[inscriptionId] = {
            type: 'error',
            error: 'Content unavailable',
          };
        }
      })
    );

    setInscriptionImages(images);
  } catch (error) {
    console.error(`Error fetching data for address ${address}:`, error);
    setError(`Error loading wallet: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

// Function to handle inscription click with caching
const handleInscriptionClick = async (inscriptionId, inscriptionData, setSelectedInscription) => {
  try {
    let data;

    // Check if the inscription details are cached
    if (inscriptionDetailsCache[inscriptionId]) {
      data = inscriptionDetailsCache[inscriptionId];
    } else {
      const response = await axiosInstance.get(`/inscription/${inscriptionId}`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
      data = response.data;
      inscriptionDetailsCache[inscriptionId] = data; // Cache the details
    }

    setSelectedInscription({
      ...data,
      inscriptionData,
    });
  } catch (error) {
    console.error('Error fetching inscription data:', error);
  }
};

// Main Wallet component
const Wallet = ({ address, onAddressClick }) => {
  const [inscriptionImages, setInscriptionImages] = useState({});
  const [hideTextInscriptions, setHideTextInscriptions] = useState(true);
  const [selectedInscription, setSelectedInscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch inscriptions when the address changes
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

  // Function to render inscription content
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
      case 'json':
        return (
          <div className="flex flex-col h-full bg-gray-900 text-gray-200 rounded-2xl overflow-hidden">
            <div className="p-2 bg-gray-800 text-xs text-gray-400">{inscriptionData.contentType}</div>
            <div className="flex-1 p-4 font-mono text-xs overflow-auto">
              <pre className="whitespace-pre-wrap break-all">
                {typeof inscriptionData.content === 'object'
                  ? JSON.stringify(inscriptionData.content, null, 2)
                  : inscriptionData.content}
              </pre>
            </div>
            {inscriptionId && (
              <div className="p-2 bg-gray-800 text-xs text-gray-400 border-t border-gray-700">
                #{inscriptionId}
                <div className="text-gray-500">JSON</div>
              </div>
            )}
          </div>
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
          <div className="flex flex-col items-center justify-center h-full text-sm bg-gray-700 text-gray-300 rounded-2xl p-4">
            <p>Unsupported content type</p>
            {inscriptionData.contentType && (
              <p className="text-xs mt-2 text-gray-400">{inscriptionData.contentType}</p>
            )}
          </div>
        );
    }
  };

  // Function to render inscription caption
  const renderInscriptionCaption = (inscriptionId, inscriptionData) => (
    <p className="mt-3 text-sm text-center truncate max-w-full text-gray-500">
      {inscriptionData?.rune || inscriptionId.slice(0, 8) + '...'}
    </p>
  );

  const hasNonTextInscriptions = () => {
    return Object.values(inscriptionImages).some((data) => data && data.type === 'image');
  };

  const hasTextInscriptions = () => {
    return Object.values(inscriptionImages).some((data) => data && data.type === 'text');
  };

  const inscriptionsList = Object.keys(inscriptionImages);

  const filteredInscriptions = inscriptionsList.filter((inscriptionId) => {
    const inscriptionData = inscriptionImages[inscriptionId];
    return !hideTextInscriptions || (inscriptionData && inscriptionData.type !== 'text');
  });

  const shouldShowNoInscriptions =
    !loading &&
    ((hideTextInscriptions && !hasNonTextInscriptions()) ||
      (!hideTextInscriptions && !hasTextInscriptions() && !hasNonTextInscriptions()));

  // Function to render the selected inscription details
  const renderSelectedInscriptionDetails = () => {
    if (!selectedInscription) return null;

    const { inscriptionData, ...details } = selectedInscription;

    const renderValue = (key, value) => {
      const isAddress = key === 'address' || key.toLowerCase().includes('address');

      if (isAddress && value && typeof value === 'string') {
        const cleanAddress = value.split(':')[0];
        return (
          <span
            className="text-blue-400 hover:text-blue-300 cursor-pointer underline"
            onClick={(e) => {
              e.stopPropagation();
              onAddressClick?.(cleanAddress);
            }}
          >
            {cleanAddress}
          </span>
        );
      }

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
              {renderInscriptionContent(selectedInscription.inscriptionId, inscriptionData)}
            </div>
            <div className="w-1/3 pl-6 space-y-4">
              {Object.entries(details).map(([key, value]) => (
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

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-semibold text-gray-200">Inscriptions for Address {address}</h3>
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
          <ImageOff className="w-12 h-12" />
          <p className="mt-2">No inscriptions found for this address</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredInscriptions.map((inscriptionId) => {
            const inscriptionData = inscriptionImages[inscriptionId];
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

export default Wallet;
