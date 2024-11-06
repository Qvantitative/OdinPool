// app/components/blocks/InscriptionsLatest.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import https from 'https';

// Create axios instance with base URL
const axiosInstanceWithoutSSL = axios.create({
  baseURL: process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'  // Local development
    : '/ord',  // Production (using Next.js rewrites)
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

// Function to fetch Ordinals API homepage data
const fetchOrdHomepage = async (setHomepageData) => {
  try {
    // Fetch the homepage data
    const response = await axiosInstanceWithoutSSL.get(`/api/ord`);
    setHomepageData(response.data);
  } catch (error) {
    console.error('Error fetching the Ordinals API homepage:', error);
  }
};

// Component definition
const InscriptionsLatest = () => {
  const [homepageData, setHomepageData] = useState(null);

  // Fetch homepage data on mount
  useEffect(() => {
    fetchOrdHomepage(setHomepageData);
  }, []);

  if (!homepageData) return <div>Loading...</div>;

  return (
    <div className="mb-8">
      <h3 className="text-xl font-semibold">Welcome to the Ordinals API</h3>
      <p>{homepageData.description}</p>
      <h4 className="mt-4 text-lg font-semibold">Available Endpoints:</h4>
      <ul className="list-disc list-inside">
        {homepageData.available_endpoints.map((endpoint, index) => (
          <li key={index}>
            <strong>{endpoint.method}</strong> {endpoint.path} - {endpoint.description}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default InscriptionsLatest;
