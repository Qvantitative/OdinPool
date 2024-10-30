// app/api/ordFetcher.js

export const ordFetcher = async (endpoint) => {
  const baseUrl = process.env.NEXT_PUBLIC_ORD_SERVER_URL;
  console.log('ORD Server URL:', baseUrl);

  try {
    const response = await fetch(`${baseUrl}/${endpoint}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',  // This tells the server to return JSON
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch data from ord server: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('ORD API fetch error:', error.message);
    return null;
  }
};
