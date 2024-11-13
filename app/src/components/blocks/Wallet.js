// app/components/blocks/Wallet.js

import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import axios from 'axios';
import https from 'https';
import { ImageOff, Coins } from 'lucide-react';

// Create an axios instance for making network requests
const axiosInstance = axios.create({
  baseURL:
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '/ord',
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

// Model component that loads and renders the GLTF
const Model = ({ url }) => {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
};

// Caches for storing fetched data
const addressCache = {};
const inscriptionContentTypeCache = {};
const inscriptionContentCache = {};
const inscriptionDetailsCache = {};

// Function to fetch wallet data with caching
const fetchWalletData = async (
  address,
  setInscriptionImages,
  setRunesBalances,
  setOutputs,
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
    let htmlString;

    if (addressCache[address]) {
      htmlString = addressCache[address];
    } else {
      const response = await axiosInstance.get(`/address/${address}`, {
        headers: { Accept: 'text/html' },
      });
      htmlString = response.data;
      addressCache[address] = htmlString;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // Debug: Log the full HTML
    console.log('Full HTML:', htmlString);

    // Existing code to extract inscriptions
    const inscriptionElements = doc.querySelectorAll('dd.thumbnails a');
    const images = {};

    await Promise.all(
      Array.from(inscriptionElements).map(async (element) => {
        const href = element.getAttribute('href');
        const inscriptionId = href.split('/').pop();

        if (images[inscriptionId]) {
          return;
        }

        try {
          let contentType;

          if (inscriptionContentTypeCache[inscriptionId]) {
            contentType = inscriptionContentTypeCache[inscriptionId];
          } else {
            const headResponse = await axiosInstance.head(
              `/content/${inscriptionId}`
            );
            contentType = headResponse.headers['content-type'];
            inscriptionContentTypeCache[inscriptionId] = contentType;
          }

          // Handle different content types
          if (inscriptionContentCache[inscriptionId]) {
            images[inscriptionId] = inscriptionContentCache[inscriptionId];
            return;
          }

          switch (true) {
            case contentType === 'video/mp4': {
              const videoResponse = await axiosInstance.get(
                `/content/${inscriptionId}`,
                {
                  responseType: 'blob',
                }
              );
              const videoUrl = URL.createObjectURL(videoResponse.data);
              const result = {
                url: videoUrl,
                type: 'video',
                contentType,
              };
              inscriptionContentCache[inscriptionId] = result;
              images[inscriptionId] = result;
              break;
            }

            case contentType === 'model/gltf-json' ||
              contentType === 'model/gltf+json': {
              const gltfResponse = await axiosInstance.get(
                `/content/${inscriptionId}`,
                {
                  responseType: 'blob',
                }
              );
              const gltfUrl = URL.createObjectURL(gltfResponse.data);
              const result = {
                url: gltfUrl,
                type: 'gltf',
                contentType,
              };
              inscriptionContentCache[inscriptionId] = result;
              images[inscriptionId] = result;
              break;
            }

            case contentType.includes('application/json'): {
              const jsonResponse = await axiosInstance.get(
                `/content/${inscriptionId}`,
                {
                  responseType: 'text',
                }
              );
              let result;
              try {
                const parsedJson = JSON.parse(jsonResponse.data);
                result = {
                  content: parsedJson,
                  type: 'json',
                  contentType,
                };
              } catch (jsonError) {
                result = {
                  content: jsonResponse.data,
                  type: 'json',
                  error: 'Invalid JSON format',
                };
              }
              inscriptionContentCache[inscriptionId] = result;
              images[inscriptionId] = result;
              break;
            }

            case contentType.startsWith('image/'): {
              const contentResponse = await axiosInstance.get(
                `/content/${inscriptionId}`,
                {
                  responseType: 'blob',
                }
              );
              let imageUrl;
              if (contentType === 'image/svg+xml') {
                const svgText = await contentResponse.data.text();
                const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
                imageUrl = URL.createObjectURL(svgBlob);
              } else {
                imageUrl = URL.createObjectURL(contentResponse.data);
              }
              const result = {
                url: imageUrl,
                type: 'image',
              };
              inscriptionContentCache[inscriptionId] = result;
              images[inscriptionId] = result;
              break;
            }

            case contentType.startsWith('text/'): {
              const contentResponse = await axiosInstance.get(
                `/content/${inscriptionId}`,
                {
                  responseType: 'text',
                }
              );
              const result = {
                content: contentResponse.data,
                type: 'text',
              };
              inscriptionContentCache[inscriptionId] = result;
              images[inscriptionId] = result;
              break;
            }

            default: {
              const result = {
                type: 'unsupported',
                contentType,
              };
              inscriptionContentCache[inscriptionId] = result;
              images[inscriptionId] = result;
            }
          }
        } catch (contentErr) {
          console.error(
            `Error fetching content for inscription ${inscriptionId}:`,
            contentErr
          );
          const errorResult = {
            type: 'error',
            error: 'Content unavailable',
          };
          inscriptionContentCache[inscriptionId] = errorResult;
          images[inscriptionId] = errorResult;
        }
      })
    );

    // Extract runes balances with fixed parsing
    const dtElements = doc.querySelectorAll('dt');
    const runesBalances = [];
    const outputs = [];

    dtElements.forEach((dt) => {
      const term = dt.textContent.trim().toLowerCase();
      console.log('Found dt element with term:', term);

      const dd = dt.nextElementSibling;
      if (!dd) {
        console.log('No dd element found for term:', term);
        return;
      }

      if (term === 'runes balances') {
        console.log('Found runes balances section');
        console.log('DD innerHTML:', dd.innerHTML);
        console.log('DD textContent:', dd.textContent);

        // Log each child node
        dd.childNodes.forEach((node, index) => {
          console.log(`Node ${index}:`, {
            type: node.nodeType,
            tagName: node.nodeType === 1 ? node.tagName : null,
            textContent: node.textContent,
            innerHTML: node.nodeType === 1 ? node.innerHTML : null,
          });
        });

        // Try to parse runes
        let runePairs = dd.textContent.split(',').map(pair => pair.trim());
        console.log('Split rune pairs:', runePairs);

        runePairs.forEach(pair => {
          // Find the rune name (should be the text of the <a> tag)
          const runeMatch = pair.match(/([^\s]+)\s+([\d,]+)/);
          if (runeMatch) {
            console.log('Found rune match:', runeMatch);
            const [_, runeName, amount] = runeMatch;
            runesBalances.push({
              runeName: runeName.trim(),
              href: `/rune/${runeName.trim()}`,
              amount: amount.trim(),
            });
          } else {
            console.log('No match found for pair:', pair);
          }
        });

        console.log('Final runesBalances array:', runesBalances);
      } else if (term === 'outputs') {
        const outputLinks = dd.querySelectorAll('li a.monospace');
        outputs.push(
          ...Array.from(outputLinks).map((link) => {
            const outputId = link.textContent;
            const href = link.getAttribute('href');
            return { outputId, href };
          })
        );
      }
    });

    setRunesBalances(runesBalances);
    setOutputs(outputs);

    setInscriptionImages(images);
  } catch (error) {
    console.error(`Error fetching data for address ${address}:`, error);
    setError(`Error loading wallet: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

// Function to handle inscription click with caching
const handleInscriptionClick = async (
  inscriptionId,
  inscriptionData,
  setSelectedInscription
) => {
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
  const [runesBalances, setRunesBalances] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [hideTextInscriptions, setHideTextInscriptions] = useState(true);
  const [selectedInscription, setSelectedInscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('Inscriptions');

  // Added state variables for runes data
  const [runeData, setRuneData] = useState([]);
  const [runeLoading, setRuneLoading] = useState(false);
  const [runeError, setRuneError] = useState(null);

  // Fetch data when the address changes
  useEffect(() => {
    if (address) {
      fetchWalletData(
        address,
        setInscriptionImages,
        setRunesBalances,
        setOutputs,
        setLoading,
        setError
      );
    } else {
      setLoading(false);
    }
  }, [address]);

  // Fetch rune data when runesBalances change
  useEffect(() => {
    const fetchRuneData = async () => {
      if (runesBalances.length === 0) {
        return;
      }
      setRuneLoading(true);
      try {
        const data = await Promise.all(
          runesBalances.map(async (rune) => {
            const runeName = rune.runeName;
            const amount = rune.amount;
            const response = await axiosInstance.get(`/rune/${runeName}`, {
              headers: {
                Accept: 'application/json',
              },
            });
            const runeInfo = response.data;

            // Parse cap and mints as integers
            const cap = parseInt(runeInfo.entry?.terms?.cap, 10);
            const mints = parseInt(runeInfo.entry?.mints, 10);

            // Check if cap and mints are valid numbers
            if (!isNaN(cap) && !isNaN(mints)) {
              const status = mints < cap ? 'Minting' : 'Ended';
              const mintsRemaining = cap - mints;
              // Changed progress calculation to fill as mintsRemaining approaches 0
              const progress = ((cap - mintsRemaining) / cap) * 100;

              return {
                runeName,
                amount,
                status,
                mintsRemaining,
                progress,
              };
            } else {
              return {
                runeName,
                amount,
                status: 'Not Mintable',
                mintsRemaining: '-',
                progress: null, // No progress for Not Mintable items
              };
            }
          })
        );
        setRuneData(data);
      } catch (error) {
        console.error('Error fetching rune data:', error);
        setRuneError(error.message);
      } finally {
        setRuneLoading(false);
      }
    };

    if (runesBalances && runesBalances.length > 0) {
      fetchRuneData();
    }
  }, [runesBalances]);

  // Add cleanup effect at component level
  useEffect(() => {
    // Cleanup function to revoke blob URLs when component unmounts
    return () => {
      Object.values(inscriptionImages).forEach((data) => {
        if (
          data.url &&
          (data.type === 'gltf' || data.type === 'image' || data.type === 'video')
        ) {
          URL.revokeObjectURL(data.url);
        }
      });
    };
  }, [inscriptionImages]);

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
      case 'gltf':
        return (
          <div className="flex flex-col h-full bg-gray-900 text-gray-200 rounded-2xl overflow-hidden">
            <div className="p-2 bg-gray-800 text-xs text-gray-400">
              model/gltf+json
            </div>
            <div className="flex-1 relative">
              <Canvas
                camera={{ position: [0, 0, 5], fov: 45 }}
                style={{ background: '#1f2937' }}
              >
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                <Suspense fallback={null}>
                  <Model url={inscriptionData.url} /> {/* Use the cached blob URL instead */}
                  <OrbitControls
                    enableZoom={true}
                    enablePan={true}
                    enableRotate={true}
                    autoRotate={true}
                    autoRotateSpeed={2}
                  />
                </Suspense>
              </Canvas>
            </div>
            {inscriptionId && (
              <div className="p-2 bg-gray-800 text-xs text-gray-400 border-t border-gray-700">
                #{inscriptionId}
                <div className="text-gray-500">GLTF</div>
              </div>
            )}
          </div>
        );
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
            <div className="p-2 bg-gray-800 text-xs text-gray-400">
              {inscriptionData.contentType}
            </div>
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
          <div className="flex flex-col h-full bg-gray-900 text-gray-200 rounded-2xl overflow-hidden">
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              <p className="text-sm text-gray-300">Unsupported content type</p>
              {inscriptionData.contentType && (
                <p className="text-xs mt-2 text-gray-400">
                  {inscriptionData.contentType}
                </p>
              )}
            </div>
            {inscriptionId && (
              <div className="p-2 bg-gray-800 text-xs text-gray-400 border-t border-gray-700">
                #{inscriptionId}
              </div>
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
              {renderInscriptionContent(
                selectedInscription.inscriptionId,
                inscriptionData
              )}
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
    <div className="mb-8 flex">
      {/* Sidebar Navigation */}
      <div className="w-48 flex-shrink-0">
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => setSelectedTab('Inscriptions')}
            className={`px-4 py-2 text-left ${
              selectedTab === 'Inscriptions'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300'
            } rounded-lg focus:outline-none`}
          >
            Inscriptions
          </button>
          <button
            onClick={() => setSelectedTab('Runes')}
            className={`px-4 py-2 text-left ${
              selectedTab === 'Runes'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300'
            } rounded-lg focus:outline-none`}
          >
            Runes
          </button>
          <button
            onClick={() => setSelectedTab('Transactions')}
            className={`px-4 py-2 text-left ${
              selectedTab === 'Transactions'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300'
            } rounded-lg focus:outline-none`}
          >
            Transactions
          </button>
        </div>
      </div>

      {/* Content Based on Selected Tab */}
      <div className="flex-1 ml-6">
        {selectedTab === 'Inscriptions' && (
          <>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold text-gray-200">
                Inscriptions for Address {address}
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
                      onClick={() =>
                        handleInscriptionClick(
                          inscriptionId,
                          inscriptionData,
                          setSelectedInscription
                        )
                      }
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
          </>
        )}

        {selectedTab === 'Runes' && (
          <>
            <div className="p-4">
              {runeLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
                </div>
              ) : runeError ? (
                <div className="text-red-500 text-center">Error: {runeError}</div>
              ) : runeData.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center text-gray-500 mt-4">
                  <Coins className="w-12 h-12 text-gray-400" />
                  <p className="mt-2 text-lg">No runes balances found for this address.</p>
                </div>
              ) : (
                // Display rune data in table
                <div className="mb-8">
                  <h3 className="text-2xl font-semibold mb-4 text-center text-blue-400">
                    Rune Balances
                  </h3>
                  <table className="min-w-full bg-[#1a1c2e] rounded-lg shadow-lg overflow-hidden">
                    <thead>
                      <tr className="bg-blue-600 text-white">
                        <th className="py-3 px-6 text-lg font-medium">Rune</th>
                        <th className="py-3 px-6 text-lg font-medium">Amount</th>
                        <th className="py-3 px-6 text-lg font-medium">Status</th>
                        <th className="py-3 px-6 text-lg font-medium">Mints Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runeData.map((data, index) => (
                        <tr
                          key={index}
                          className="text-gray-300 hover:bg-blue-700 transition-colors duration-200"
                        >
                          <td className="py-4 px-6 border-b border-gray-600 text-center">
                            {data.runeName}
                          </td>
                          <td className="py-4 px-6 border-b border-gray-600 text-center">
                            {data.amount}
                          </td>
                          <td className="py-4 px-6 border-b border-gray-600 text-center font-semibold rounded-full relative">
                            <span
                              className={`${
                                data.status === 'Minting' ? 'radiating-glow' : ''
                              } inline-block px-4 py-2 rounded-full ${
                                data.status === 'Minting'
                                  ? 'bg-green-600 text-white'
                                  : 'bg-red-600 text-white'
                              }`}
                            >
                              {data.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 border-b border-gray-600 text-center">
                            {data.progress !== null ? (
                              <>
                                <div className="relative w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className={`absolute h-full rounded-full ${
                                      data.mintsRemaining === 0
                                        ? 'bg-red-500'
                                        : 'bg-green-500'
                                    }`}
                                    style={{ width: `${data.progress}%` }}
                                  ></div>
                                </div>
                                <p className="mt-1 text-sm text-gray-400">
                                  {data.mintsRemaining.toLocaleString()} remaining
                                </p>
                              </>
                            ) : (
                              <p className="text-sm text-gray-400">-</p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <style jsx>{`
                    .radiating-glow {
                      position: relative;
                      animation: pulse 2s infinite ease-in-out;
                    }
                    @keyframes pulse {
                      0% {
                        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
                      }
                      50% {
                        box-shadow: 0 0 15px 15px rgba(34, 197, 94, 0.3);
                      }
                      100% {
                        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
                      }
                    }
                  `}</style>
                </div>
              )}
            </div>
          </>
        )}

        {selectedTab === 'Transactions' && (
          <div className="p-4">
            {outputs.length > 0 ? (
              <ul className="list-disc list-inside">
                {outputs.map((output, index) => (
                  <li key={index}>
                    <a
                      className="text-blue-400 hover:text-blue-300 underline"
                      href={output.href}
                    >
                      {output.outputId}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-300">No outputs found for this address.</p>
            )}
          </div>
        )}
      </div>

      {renderSelectedInscriptionDetails()}
    </div>
  );
};

export default Wallet;
