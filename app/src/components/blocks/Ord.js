// app/components/blocks/Ord

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import https from 'https';
import { ImageOff, FileText, ChevronLeft, ChevronRight, RefreshCw, Switch } from 'lucide-react';

const axiosInstance = axios.create({
  baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '/ord',
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

const fetchWithRetry = async (url, options = {}, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axiosInstance.get(url, options);
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

const Ord = () => {
  const [view, setView] = useState('inscriptions');
  const [inscriptionsList, setInscriptionsList] = useState([]);
  const [runesList, setRunesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInscription, setSelectedInscription] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const ITEMS_PER_PAGE = 16;

  const parseInscriptionsFromHTML = (htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const inscriptionElements = doc.querySelectorAll('a[href^="/inscription/"]');

    return Array.from(inscriptionElements).map(element => {
      const href = element.getAttribute('href');
      const inscriptionId = href.replace('/inscription/', '');
      return { id: inscriptionId };
    });
  };

  const fetchInscriptionContent = async (inscriptionId) => {
    try {
      const contentResponse = await fetchWithRetry(`/content/${inscriptionId}`, {
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
        return { url: imageUrl, type: 'image', blob: contentResponse.data };
      } else if (contentType.startsWith('text/')) {
        const textContent = await contentResponse.data.text();
        return { content: textContent, type: 'text', blob: contentResponse.data };
      }

      return { type: 'unsupported', blob: contentResponse.data };
    } catch (error) {
      console.error(`Error fetching content for inscription ${inscriptionId}:`, error);
      return null;
    }
  };

  const fetchLatestInscriptions = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/', {
        headers: {
          'Accept': 'text/html'
        },
        responseType: 'text'
      });

      const parsedInscriptions = parseInscriptionsFromHTML(response.data);

      const inscriptionsWithContent = await Promise.all(
        parsedInscriptions.map(async (inscription) => {
          const content = await fetchInscriptionContent(inscription.id);
          return {
            ...inscription,
            ...content
          };
        })
      );

      setInscriptionsList(inscriptionsWithContent);
    } catch (err) {
      console.error('Error fetching latest inscriptions:', err);
      setError('Failed to load latest inscriptions');
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestRunes = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/rune', {
        headers: {
          'Accept': 'application/json'
        }
      });

      const runesData = await Promise.all(
        response.data.map(async (rune) => {
          const runeResponse = await axiosInstance.get(`/rune/${rune}`, {
            headers: {
              Accept: 'application/json',
            },
          });
          const runeInfo = runeResponse.data;

          const cap = parseInt(runeInfo.entry?.terms?.cap, 10);
          const mints = parseInt(runeInfo.entry?.mints, 10);

          if (!isNaN(cap) && !isNaN(mints)) {
            const mintsRemaining = cap - mints;
            const progress = Math.min((mints / cap) * 100, 100).toFixed(2);

            return {
              rune,
              status: mints < cap ? 'Minting' : 'Ended',
              mintsRemaining,
              progress: parseFloat(progress),
              cap,
              mints
            };
          }

          return {
            rune,
            status: 'Not Mintable',
            mintsRemaining: '-',
            progress: null,
          };
        })
      );

      setRunesList(runesData);
    } catch (err) {
      console.error('Error fetching latest runes:', err);
      setError('Failed to load latest runes');
    } finally {
      setLoading(false);
    }
  };

  const handleInscriptionClick = async (inscriptionId, inscriptionData) => {
    try {
      const response = await axiosInstance.get(`/inscription/${inscriptionId}`, {
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

  const handleRefresh = () => {
    if (view === 'inscriptions') {
      fetchLatestInscriptions();
    } else {
      fetchLatestRunes();
    }
  };

  useEffect(() => {
    if (view === 'inscriptions') {
      fetchLatestInscriptions();
    } else {
      fetchLatestRunes();
    }
    return () => {
      inscriptionsList.forEach(inscription => {
        if (inscription.url) {
          URL.revokeObjectURL(inscription.url);
        }
      });
    };
  }, [view]);

  const renderSelectedInscriptionDetails = () => {
    if (!selectedInscription) return null;

    const { inscriptionData, ...details } = selectedInscription;

    const formattedDetails = {
      address: details.address || details.output_address || details.satpoint?.split(':')[0] || '',
      ...details,
    };

    const renderValue = (key, value) => {
      const isAddress = key === 'address' || key.toLowerCase().includes('address');

      if (isAddress && value && typeof value === 'string') {
        const cleanAddress = value.split(':')[0];
        return (
          <span
            className="text-blue-400 hover:text-blue-300 cursor-pointer underline"
            onClick={(e) => {
              e.stopPropagation();
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

    const orderedEntries = Object.entries(formattedDetails).sort(([keyA], [keyB]) => {
      if (keyA === 'address') return -1;
      if (keyB === 'address') return 1;
      return 0;
    });

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
                  alt={`Inscription ${formattedDetails.id}`}
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
              {orderedEntries.map(([key, value]) => (
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

  const renderRunesView = () => (
    <table className="min-w-full bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <thead>
        <tr className="bg-blue-600 text-white">
          <th className="py-3 px-6 text-lg font-medium">Rune</th>
          <th className="py-3 px-6 text-lg font-medium">Status</th>
          <th className="py-3 px-6 text-lg font-medium">Mints Remaining</th>
        </tr>
      </thead>
      <tbody>
        {runesList.map((data, index) => (
          <tr
            key={index}
            className="text-gray-300 hover:bg-gray-700 transition-colors duration-200"
          >
            <td className="py-4 px-6 border-b border-gray-700 text-center">
              {data.rune}
            </td>
            <td className="py-4 px-6 border-b border-gray-700 text-center font-semibold rounded-full relative">
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
            <td className="py-4 px-6 border-b border-gray-700 text-center">
              {data.progress !== null ? (
                <>
                  <div className="relative w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`absolute h-full rounded-full ${
                        data.mintsRemaining === 0 ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{
                        width: `${data.progress}%`,
                        transition: 'width 0.5s ease-in-out'
                      }}
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
  );

  const totalPages = Math.ceil(inscriptionsList.length / ITEMS_PER_PAGE);
  const paginatedInscriptions = inscriptionsList.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-white">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-white">
          Latest {view === 'inscriptions' ? 'Inscriptions' : 'Runes'}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setView(view === 'inscriptions' ? 'runes' : 'inscriptions')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white transition-colors flex items-center gap-2"
          >
            <Switch className="w-4 h-4" />
            Switch to {view === 'inscriptions' ? 'Runes' : 'Inscriptions'}
          </button>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-md text-white transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
        </div>
      ) : (
        <>
          {view === 'inscriptions' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {paginatedInscriptions.map((inscription) => (
                <div
                  key={inscription.id}
                  className="relative group cursor-pointer"
                  onClick={() => handleInscriptionClick(inscription.id, inscription)}
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-800 hover:shadow-lg transition-all duration-300">
                    {inscription.type === 'image' ? (
                      <img
                        src={inscription.url}
                        alt={`Inscription ${inscription.id}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : inscription.type === 'text' ? (
                      <div className="flex items-center justify-center h-full p-4 text-gray-400">
                        <div className="text-center">
                          <FileText className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm">Text content</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full p-4 text-gray-400">
                        <div className="text-center">
                          <ImageOff className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm">Preview not available</p>
                        </div>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="text-white text-center p-4">
                        <p className="text-sm font-medium">
                          #{inscription.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            renderRunesView()
          )}

          {view === 'inscriptions' && totalPages > 1 && (
            <div className="flex justify-center items-center mt-4 space-x-4">
              <button
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
                className="p-2 rounded-full bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <span className="text-white">
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                disabled={currentPage === totalPages - 1}
                className="p-2 rounded-full bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          )}
        </>
      )}

      {renderSelectedInscriptionDetails()}

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
  );
};

export default Ord;