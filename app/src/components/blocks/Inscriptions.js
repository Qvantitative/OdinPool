// app/components/blocks/Inscriptions

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import https from 'https';
import { ImageOff } from 'lucide-react';

// ------------------------
// Helper Functions
// ------------------------

const axiosInstanceWithSSL = axios.create({
  baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '/ord',
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

const axiosInstanceWithoutSSL = axios.create({
  baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '/ord',
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

const fetchWithRetry = async (url, options = {}, retries = 3) => {
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

// Extract the first <img src="..."> from HTML content
const extractImageSourceFromHTML = (htmlContent) => {
  const imgMatch = htmlContent.match(/<img[^>]+src="([^"]+)"/);
  return imgMatch ? imgMatch[1] : null;
};

// Extract the first <svg>...</svg> block from HTML
const extractSVGFromHTML = (htmlContent) => {
  const svgMatch = htmlContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  return svgMatch ? svgMatch[0] : null;
};

// Convert binary data to a data URL
const convertToDataURL = (buffer, contentType) => {
  const base64String = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return `data:${contentType};base64,${base64String}`;
};

// Inline SVG images that reference /content/... inside the SVG
const inlineSVGImages = async (svgContent) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  const images = doc.querySelectorAll('image[href^="/content/"]');

  for (let img of images) {
    const href = img.getAttribute('href');
    if (href.startsWith('/content/')) {
      try {
        const imageResponse = await fetchWithRetry(href, { responseType: 'arraybuffer' });
        const contentType = imageResponse.headers['content-type'];
        const imageBuffer = imageResponse.data;
        const dataUrl = convertToDataURL(imageBuffer, contentType);
        img.setAttribute('href', dataUrl);
      } catch (error) {
        console.error(`Failed to fetch image at ${href}`, error);
      }
    }
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc.documentElement);
};

// Inline <script src="/content/..."> references directly into the HTML
const inlineScriptContent = async (htmlContent) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const scripts = doc.querySelectorAll('script[src^="/content/"]');

  for (let script of scripts) {
    const src = script.getAttribute('src');
    if (src.startsWith('/content/')) {
      try {
        const scriptResponse = await fetchWithRetry(src, { responseType: 'text' });
        const scriptContent = scriptResponse.data;
        script.removeAttribute('src');
        script.textContent = scriptContent;
      } catch (error) {
        console.error(`Failed to fetch script at ${src}`, error);
      }
    }
  }

  return doc.documentElement.outerHTML;
};

// Inline dynamically generated scripts that append another <script> element
const inlineDynamicGeneratedScript = async (htmlContent) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const scripts = doc.querySelectorAll('script');

  for (let script of scripts) {
    let scriptCode = script.textContent || '';

    // Look for pattern: createElement('script'), set script.src and onload, then appendChild
    const createScriptMatch = scriptCode.match(/const script = document\.createElement\('script'\);([\s\S]*?)document\.head\.appendChild\(script\);/);
    if (createScriptMatch) {
      const scriptBlock = createScriptMatch[0];
      const srcMatch = scriptBlock.match(/script\.src\s*=\s*['"]([^'"]+)['"]/);
      if (srcMatch) {
        const externalScriptUrl = srcMatch[1];
        try {
          const externalScriptResponse = await fetchWithRetry(externalScriptUrl, { responseType: 'text' });
          const externalScriptContent = externalScriptResponse.data;

          const onloadMatch = scriptBlock.match(/script\.onload\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\};/);
          let onloadBody = '';
          if (onloadMatch) {
            onloadBody = onloadMatch[1].trim();
          }

          const replacement = `
            // Inlined external script from ${externalScriptUrl}:
            ${externalScriptContent}

            // Onload logic inlined:
            ${onloadBody}
          `;

          scriptCode = scriptCode.replace(scriptBlock, replacement);
          script.textContent = scriptCode;
        } catch (error) {
          console.error('Error inlining external script referenced by dynamically created <script>:', error);
        }
      }
    }
  }

  return doc.documentElement.outerHTML;
};

// A helper to fully process HTML content inscriptions
const processHTMLContent = async (htmlContent) => {
  // Check for inline SVG scenario
  const svgContent = extractSVGFromHTML(htmlContent);
  if (svgContent) {
    const inlinedSVG = await inlineSVGImages(svgContent);
    // Return as image
    const svgBlob = new Blob([inlinedSVG], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);
    return { type: 'image', url: svgUrl, originalHtml: htmlContent };
  }

  // Check for a simple <img> tag
  const imageSource = extractImageSourceFromHTML(htmlContent);
  if (imageSource) {
    // Fetch the image
    const imageResponse = await fetchWithRetry(imageSource, { responseType: 'blob' });
    const blob = new Blob([imageResponse.data]);
    const imageUrl = URL.createObjectURL(blob);
    return { type: 'image', url: imageUrl, originalHtml: htmlContent };
  }

  // Inline scripts
  let finalHTML = await inlineScriptContent(htmlContent);
  finalHTML = await inlineDynamicGeneratedScript(finalHTML);

  // Return final HTML as text
  return { type: 'html', content: finalHTML };
};

// ------------------------
// Main Logic for Inscriptions Component
// ------------------------

const fetchInscriptionImages = async (inscriptionsList, setInscriptionImages, setLoading) => {
  if (!inscriptionsList || inscriptionsList.length === 0) {
    setLoading(false);
    return;
  }

  const images = {};

  await Promise.all(
    inscriptionsList.map(async (inscriptionId) => {
      try {
        const detailsResponse = await fetchWithRetry(`/inscription/${inscriptionId}`);
        const details = detailsResponse.data;

        if (details) {
          // Fetch the content as text first to inspect
          try {
            const contentResponse = await fetchWithRetry(`/content/${inscriptionId}`, { responseType: 'text' });
            const contentType = contentResponse.headers['content-type'];
            const rawData = contentResponse.data;

            if (contentType.includes('text/html')) {
              // Process complex HTML scenario
              const processed = await processHTMLContent(rawData);
              images[inscriptionId] = {
                ...processed,
                rune: details.rune,
                details: details,
              };
            } else if (contentType.startsWith('image/')) {
              // If it's an image
              if (contentType === 'image/svg+xml') {
                // Already have SVG text
                const svgText = rawData;
                const inlinedSVG = await inlineSVGImages(svgText);
                const svgBlob = new Blob([inlinedSVG], { type: 'image/svg+xml' });
                const imageUrl = URL.createObjectURL(svgBlob);
                images[inscriptionId] = {
                  type: 'image',
                  url: imageUrl,
                  rune: details.rune,
                  details: details,
                };
              } else {
                // For other images, we need to refetch as blob
                const blobResponse = await fetchWithRetry(`/content/${inscriptionId}`, { responseType: 'blob' });
                const blob = new Blob([blobResponse.data]);
                const imageUrl = URL.createObjectURL(blob);
                images[inscriptionId] = {
                  type: 'image',
                  url: imageUrl,
                  rune: details.rune,
                  details: details,
                };
              }
            } else if (contentType.startsWith('text/')) {
              // Handle plain text (non-html)
              images[inscriptionId] = {
                type: contentType.includes('html') ? 'html' : 'text',
                content: rawData,
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
  setLoading(false);
};

const handleInscriptionClick = async (inscriptionId, inscriptionData, setSelectedInscription) => {
  console.log('Inscription ID:', inscriptionId);
  console.log('Inscription Data:', inscriptionData);
  try {
    const response = await axiosInstanceWithoutSSL.get(`/inscription/${inscriptionId}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    console.log('API Response:', response.data);
    setSelectedInscription({
      ...response.data,
      inscriptionData,
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
        onClick={() => handleInscriptionClick(inscriptionId, inscriptionData, setSelectedInscription)}
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
            ) : inscriptionData.type === 'text' || inscriptionData.type === 'html' ? (
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
    const formattedDetails = {
      address: details.address || details.output_address || details.satpoint?.split(':')[0] || '',
      ...details,
    };

    const renderValue = (key, value) => {
      const isAddress = key === 'address' || key.toLowerCase().includes('address');
      console.log('Key:', key, 'Value:', value, 'Is Address:', isAddress);

      if (isAddress && onAddressClick && value && typeof value === 'string') {
        const cleanAddress = value.split(':')[0];
        return (
          <span
            className="text-blue-400 hover:text-blue-300 cursor-pointer underline"
            onClick={(e) => {
              e.stopPropagation();
              onAddressClick(cleanAddress);
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
              ) : inscriptionData.type === 'text' || inscriptionData.type === 'html' ? (
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
