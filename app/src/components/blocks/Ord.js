// app/components/blocks/Ord.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ImageOff, FileText, ChevronLeft, ChevronRight, X } from 'lucide-react';

const axiosInstance = axios.create({
  baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '/ord',
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

const extractImageSourceFromHTML = (htmlContent) => {
  const imgMatch = htmlContent.match(/<img[^>]+src="([^"]+)"/);
  return imgMatch ? imgMatch[1] : null;
};

const extractSVGFromHTML = (htmlContent) => {
  const svgMatch = htmlContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  return svgMatch ? svgMatch[0] : null;
};

const fetchBinaryData = async (url) => {
  const response = await fetchWithRetry(url, { responseType: 'arraybuffer' });
  return response.data;
};

const convertToDataURL = (buffer, contentType) => {
  const base64String = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return `data:${contentType};base64,${base64String}`;
};

const inlineSVGImages = async (svgContent) => {
  // Create a temporary DOM to manipulate the SVG
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');

  const images = doc.querySelectorAll('image[href^="/content/"]');

  // Fetch each image referenced inside the SVG
  for (let img of images) {
    const href = img.getAttribute('href');
    if (href.startsWith('/content/')) {
      try {
        // Fetch image content
        const imageResponse = await fetchWithRetry(href, { responseType: 'arraybuffer' });

        const contentType = imageResponse.headers['content-type'];
        const imageBuffer = imageResponse.data;

        // Convert binary data to a data URL
        const dataUrl = convertToDataURL(imageBuffer, contentType);

        // Update the image href to the inline data URL
        img.setAttribute('href', dataUrl);
      } catch (error) {
        console.error(`Failed to fetch image at ${href}`, error);
      }
    }
  }

  // Serialize the updated SVG back to text
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc.documentElement);
};

const inlineScriptContent = async (htmlContent) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  const scripts = doc.querySelectorAll('script[src^="/content/"]');

  for (let script of scripts) {
    const src = script.getAttribute('src');
    if (src.startsWith('/content/')) {
      try {
        // Fetch the script content as text
        const scriptResponse = await fetchWithRetry(src, { responseType: 'text' });
        const scriptContent = scriptResponse.data;

        // Remove the src attribute and insert inline code
        script.removeAttribute('src');
        script.textContent = scriptContent;
      } catch (error) {
        console.error(`Failed to fetch script at ${src}`, error);
      }
    }
  }

  return doc.documentElement.outerHTML;
};

const inlineDynamicGeneratedScript = async (htmlContent) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  // Find script tags
  const scripts = doc.querySelectorAll('script');

  for (let script of scripts) {
    let scriptCode = script.textContent || '';

    // Check for the known pattern of fetching the generator (from previous logic)
    // If needed, handle that logic first, as previously done.
    // (If your code already handles that, you can skip re-checking the /r/sat endpoint.)

    // Now handle the dynamically appended script scenario
    // Look for the pattern:
    // const script = document.createElement('script');
    // script.src = '/content/...';
    // script.onload = () => { ... };
    // document.head.appendChild(script);

    const createScriptMatch = scriptCode.match(/const script = document\.createElement\('script'\);([\s\S]*?)document\.head\.appendChild\(script\);/);
    if (createScriptMatch) {
      const scriptBlock = createScriptMatch[0];

      // Extract the src from this block
      const srcMatch = scriptBlock.match(/script\.src\s*=\s*['"]([^'"]+)['"]/);
      if (srcMatch) {
        const externalScriptUrl = srcMatch[1];  // e.g. /content/c192f63c1990ee1377...
        try {
          // Fetch the external script
          const externalScriptResponse = await fetchWithRetry(externalScriptUrl, { responseType: 'text' });
          const externalScriptContent = externalScriptResponse.data;

          // Extract the onload function body if it exists
          const onloadMatch = scriptBlock.match(/script\.onload\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\};/);
          let onloadBody = '';
          if (onloadMatch) {
            onloadBody = onloadMatch[1].trim();
          }

          // Now we replace the entire script creation block with the external script content + onload logic
          // Essentially, we simulate that the external script is loaded and executed immediately.
          const replacement = `
            // Inlined external script from ${externalScriptUrl}:
            ${externalScriptContent}

            // Onload logic inlined:
            ${onloadBody}
          `;

          // Replace the original block in scriptCode
          scriptCode = scriptCode.replace(scriptBlock, replacement);

          // Update the script's text content
          script.textContent = scriptCode;
        } catch (error) {
          console.error('Error inlining external script referenced by dynamically created <script>:', error);
        }
      }
    }
  }

  return doc.documentElement.outerHTML;
};

const Ord = ({ onAddressClick = () => {} }) => {
  const [inscriptionsList, setInscriptionsList] = useState([]);
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

  const fetchInscriptionContent = async (inscriptionId, contentPath = null) => {
    try {
      const path = contentPath || `/content/${inscriptionId}`;
      const initialResponse = await fetchWithRetry(path, { responseType: 'text' });
      const contentType = initialResponse.headers['content-type'];

      if (contentType.includes('text/html')) {
        const htmlContent = initialResponse.data;

        // Check for inline SVG scenario first
        const svgContent = extractSVGFromHTML(htmlContent);
        if (svgContent) {
          const inlinedSVG = await inlineSVGImages(svgContent);
          const svgBlob = new Blob([inlinedSVG], { type: 'image/svg+xml' });
          const svgUrl = URL.createObjectURL(svgBlob);

          return {
            url: svgUrl,
            type: 'image',
            blob: svgBlob,
            originalHtml: htmlContent
          };
        }

        // Check for a simple <img> tag
        const imageSource = extractImageSourceFromHTML(htmlContent);
        if (imageSource) {
          const imageResponse = await fetchWithRetry(imageSource, { responseType: 'blob' });
          const blob = new Blob([imageResponse.data]);
          const imageUrl = URL.createObjectURL(blob);

          return {
            url: imageUrl,
            type: 'image',
            blob: blob,
            originalHtml: htmlContent
          };
        }

        // Inline script content referenced by <script src="/content/...">
        const inlinedScriptHTML = await inlineScriptContent(htmlContent);

        // Now handle the dynamic script scenario where the script fetches /r/sat/45039645507/at/-1
        const finalHTML = await inlineDynamicGeneratedScript(inlinedScriptHTML);

        return {
          content: finalHTML,
          type: 'html',
          blob: new Blob([finalHTML])
        };
      }

      if (contentType.startsWith('image/')) {
        if (contentType === 'image/svg+xml') {
          const svgText = initialResponse.data;
          const inlinedSVG = await inlineSVGImages(svgText);
          const svgBlob = new Blob([inlinedSVG], { type: 'image/svg+xml' });
          const imageUrl = URL.createObjectURL(svgBlob);
          return { url: imageUrl, type: 'image', blob: svgBlob };
        } else {
          const blobResponse = await fetchWithRetry(path, { responseType: 'blob' });
          const blob = new Blob([blobResponse.data]);
          const imageUrl = URL.createObjectURL(blob);
          return { url: imageUrl, type: 'image', blob };
        }
      }

      if (contentType.startsWith('text/')) {
        return {
          content: initialResponse.data,
          type: contentType.includes('html') ? 'html' : 'text',
          blob: new Blob([initialResponse.data])
        };
      }

      return { type: 'unsupported', blob: null };
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
      setError(null);
    } catch (err) {
      console.error('Error fetching latest inscriptions:', err);
      setError('Failed to load latest inscriptions');
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

      // Re-fetch content if needed (for HTML embedded images)
      let finalInscriptionData = inscriptionData;
      if (response.data.content && (!inscriptionData.url || inscriptionData.type === 'html')) {
        const newContent = await fetchInscriptionContent(inscriptionId, response.data.content);
        finalInscriptionData = { ...inscriptionData, ...newContent };
      }

      setSelectedInscription({
        ...response.data,
        inscriptionData: finalInscriptionData,
      });
    } catch (error) {
      console.error('Error fetching inscription data:', error);
    }
  };

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
            onClick={() => onAddressClick(cleanAddress)}
          >
            {cleanAddress}
          </span>
        );
      }

      return (
        <span className="text-gray-200 break-all text-sm">
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
        <div className="bg-gray-800 rounded-xl w-full max-w-xl md:max-w-4xl max-h-[95vh] overflow-y-auto">
          <div className="sticky top-0 bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-200">Inscription Details</h3>
            <button
              onClick={() => setSelectedInscription(null)}
              className="p-1 hover:bg-gray-700 rounded-full"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          <div className="flex flex-col md:flex-row p-4">
            <div className="w-full md:w-2/3 md:pr-4 mb-4 md:mb-0">
              {inscriptionData.type === 'image' ? (
                <img
                  src={inscriptionData.url}
                  alt={`Inscription ${formattedDetails.id}`}
                  className="w-full h-auto max-h-[50vh] md:max-h-[70vh] object-contain rounded-xl"
                />
              ) : inscriptionData.type === 'text' || inscriptionData.type === 'html' ? (
                <div className="bg-gray-700 rounded-xl p-4 max-h-[50vh] md:max-h-[70vh] overflow-auto">
                  <pre className="text-sm text-gray-200 whitespace-pre-wrap">
                    {inscriptionData.content}
                  </pre>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 bg-gray-700 rounded-xl text-gray-300">
                  Unsupported content type
                </div>
              )}
            </div>

            <div className="w-full md:w-1/3 md:pl-4 md:border-l border-gray-700 space-y-3">
              {orderedEntries.map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-gray-400 text-xs font-medium uppercase">{key}</span>
                  {renderValue(key, value)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    fetchLatestInscriptions();
    return () => {
      inscriptionsList.forEach(inscription => {
        if (inscription.url) {
          URL.revokeObjectURL(inscription.url);
        }
      });
    };
  }, []);

  const totalPages = Math.ceil(inscriptionsList.length / ITEMS_PER_PAGE);
  const paginatedInscriptions = inscriptionsList.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="flex justify-between items-center p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">Latest Inscriptions</h1>
        <button
          onClick={fetchLatestInscriptions}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-md text-white transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={fetchLatestInscriptions}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-md text-white transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr">
              {paginatedInscriptions.map((inscription) => (
                <div
                  key={inscription.id}
                  className="relative group cursor-pointer aspect-square"
                  onClick={() => handleInscriptionClick(inscription.id, inscription)}
                >
                  <div className="absolute inset-0 rounded-lg overflow-hidden bg-gray-800 hover:shadow-lg transition-all duration-300">
                    {inscription.type === 'image' ? (
                      <img
                        src={inscription.url}
                        alt={`Inscription ${inscription.id}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : inscription.type === 'text' || inscription.type === 'html' ? (
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
                      <p className="text-sm font-medium text-white">
                        #{inscription.id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-800">
              <div className="flex justify-center items-center space-x-4">
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
            </div>
          )}
        </div>
      )}

      {renderSelectedInscriptionDetails()}
    </div>
  );
};

export default Ord;
