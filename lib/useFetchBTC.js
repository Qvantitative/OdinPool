import { useState, useEffect } from 'react';

export function useFetchBTC() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const response = await fetch('https://blockstream.info/api/blocks');
      setData(await response.json());
    }
    fetchData();
  }, []);

  return data;
}
