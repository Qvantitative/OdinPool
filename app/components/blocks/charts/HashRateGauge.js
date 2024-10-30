import React, { useState, useEffect } from 'react';
import HashRateGauge from './HashRateGauge';

const App = () => {
  const [hashRate, setHashRate] = useState(0); // Current hash rate
  const maxHashRate = 100; // Define your maximum hash rate

  // Simulate hash rate updates
  useEffect(() => {
    const fetchHashRate = async () => {
      try {
        const response = await fetch('/api/getHashRate'); // Your backend endpoint
        const data = await response.json();
        setHashRate(data.hashRate); // Assuming the API returns { hashRate: <value> }
      } catch (error) {
        console.error('Error fetching hash rate:', error);
      }
    };

    const interval = setInterval(fetchHashRate, 3000); // Update every 3 seconds

    return () => clearInterval(interval); // Clean up on unmount
  }, []);

  return (
    <div>
      <h1>Bitcoin Hash Rate Monitor</h1>
      <HashRateGauge hashRate={hashRate} maxHashRate={maxHashRate} />
    </div>
  );
};

export default App;
