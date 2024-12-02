// app/components/blocks/Ord

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import https from 'https';
import { ImageOff, FileText } from 'lucide-react';

const axiosInstance = axios.create({
  baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '/ord',
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

const Ord = () => {
  const [inscriptions, setInscriptions] = useState({});
  const [inscriptionsList, setInscriptionsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInscriptionContent = async (inscriptionId) => {
    try {
      // Fetch inscription details
      const detailsResponse = await axiosInstance.get(`/inscription/${inscriptionId}`);
      const details = detailsResponse.data;

      // Fetch the content
      const contentResponse = await axiosInstance.get(`/content/${inscriptionId}`, {
        responseType: 'blob',
      });

      const contentType = contentResponse.headers['content-type'];

      // Handle different content types
      if (contentType.startsWith('image/')) {
        let imageUrl;
        if (contentType === 'image/svg+xml') {
          // Handle SVG content
          const svgText = await contentResponse.data.text();
          const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
          imageUrl = URL.createObjectURL(svgBlob);
        } else {
          // Handle other images
          const blob = new Blob([contentResponse.data]);
          imageUrl = URL.createObjectURL(blob);
        }

        setInscriptions(prev => ({
          ...prev,
          [inscriptionId]: {
            url: imageUrl,
            type: 'image',
            rune: details.rune,
            details: details,
          }
        }));
      } else if (contentType.startsWith('text/')) {
        // Handle text content
        const textContent = await contentResponse.data.text();
        setInscriptions(prev => ({
          ...prev,
          [inscriptionId]: {
            content: textContent,
            type: 'text',
            rune: details.rune,
            details: details,
          }
        }));
      } else {
        // Handle unsupported content
        setInscriptions(prev => ({
          ...prev,
          [inscriptionId]: {
            type: 'unsupported',
            rune: details.rune,
            details: details,
          }
        }));
      }
    } catch (err) {
      console.error(`Error fetching inscription ${inscriptionId}:`, err);
      setInscriptions(prev => ({
        ...prev,
        [inscriptionId]: {
          type: 'error',
          error: err.message
        }
      }));
    }
  };

  const fetchLatestInscriptions = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/');
      setInscriptionsList(response.data);

      // Fetch content for each inscription
      await Promise.all(response.data.map(inscription =>
        fetchInscriptionContent(inscription.id)
      ));
    } catch (err) {
      console.error('Error fetching latest inscriptions:', err);
      setError('Failed to load latest inscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestInscriptions();

    const pollInterval = setInterval(fetchLatestInscriptions, 30000);
    return () => {
      clearInterval(pollInterval);
      // Cleanup URLs
      Object.values(inscriptions).forEach(inscription => {
        if (inscription.type === 'image' && inscription.url) {
          URL.revokeObjectURL(inscription.url);
        }
      });
    };
  }, []);

  const handleInscriptionClick = (id) => {
    window.open(`/inscription/${id}`, '_blank');
  };

  const renderInscriptionContent = (inscription, inscriptionData) => {
    if (!inscriptionData) {
      return (
        <div className="flex items-center justify-center h-full p-4 text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
        </div>
      );
    }

    switch (inscriptionData.type) {
      case 'image':
        return (
          <img
            src={inscriptionData.url}
            alt={`Inscription ${inscription.id}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        );
      case 'text':
        return (
          <div className="flex items-center justify-center h-full p-4 text-gray-400">
            <div className="text-center">
              <FileText className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm truncate max-w-[200px]">{inscriptionData.content}</p>
            </div>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center justify-center h-full p-4 text-red-400">
            <div className="text-center">
              <p className="text-sm">Error loading inscription</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full p-4 text-gray-400">
            <div className="text-center">
              <ImageOff className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Unsupported content</p>
            </div>
          </div>
        );
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchLatestInscriptions}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <h1 className="text-4xl font-bold text-white mb-8 mt-4">Latest Inscriptions</h1>

      {loading && Object.keys(inscriptions).length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {inscriptionsList.map((inscription) => (
            <div
              key={inscription.id}
              className="relative group cursor-pointer"
              onClick={() => handleInscriptionClick(inscription.id)}
            >
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-800 hover:shadow-lg transition-all duration-300">
                {renderInscriptionContent(inscription, inscriptions[inscription.id])}

                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <div className="text-white text-center p-4">
                    <p className="text-sm font-medium mb-2">
                      #{inscription.number}
                    </p>
                    {inscriptions[inscription.id]?.rune && (
                      <p className="text-xs mb-1">{inscriptions[inscription.id].rune}</p>
                    )}
                    <p className="text-xs opacity-75">
                      {inscriptions[inscription.id]?.details?.content_type || 'Loading...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Ord;