// app/components/blocks/Ord

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import https from 'https';
import { ImageOff, FileText } from 'lucide-react';

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
  const [inscriptionsList, setInscriptionsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

      const imageUrl = URL.createObjectURL(contentResponse.data);
      return imageUrl;
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

      // Fetch content for each inscription
      const inscriptionsWithContent = await Promise.all(
        parsedInscriptions.map(async (inscription) => {
          const previewUrl = await fetchInscriptionContent(inscription.id);
          return {
            ...inscription,
            previewUrl
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

  useEffect(() => {
    fetchLatestInscriptions();
    const pollInterval = setInterval(fetchLatestInscriptions, 30000);
    return () => {
      clearInterval(pollInterval);
      // Cleanup object URLs to prevent memory leaks
      inscriptionsList.forEach(inscription => {
        if (inscription.previewUrl) {
          URL.revokeObjectURL(inscription.previewUrl);
        }
      });
    };
  }, []);

  const handleInscriptionClick = (id) => {
    window.open(`/inscription/${id}`, '_blank');
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

      {loading ? (
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
                {inscription.previewUrl ? (
                  <img
                    src={inscription.previewUrl}
                    alt={`Inscription ${inscription.id}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
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
      )}
    </div>
  );
};

export default Ord;