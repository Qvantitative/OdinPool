import { useEffect, useState } from 'react';

const Ord = () => {
  const [ordData, setOrdData] = useState(null);

  useEffect(() => {
    const fetchOrdData = async () => {
      try {
        const res = await fetch('http://68.9.235.71:3001'); // adjust the endpoint as needed
        const data = await res.json();
        console.log('Fetched data:', data); // Log the fetched data
        setOrdData(data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchOrdData();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">Ord Data</h1>
      {ordData ? (
        <pre>{JSON.stringify(ordData, null, 2)}</pre>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
};

export default Ord;
