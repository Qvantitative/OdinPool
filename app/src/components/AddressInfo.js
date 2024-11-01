// components/AddressInfo.js
import { useState } from 'react';

const AddressInfo = () => {
  const [walletAddress, setWalletAddress] = useState('');  // Input field for Bitcoin address
  const [addressInfo, setAddressInfo] = useState(null);  // State to store the fetched address info
  const [error, setError] = useState(null);

  // Function to handle form submission and fetch the address info
  const fetchAddressInfo = async (e) => {
    e.preventDefault();  // Prevent the default form submission behavior
    setError(null);  // Clear any previous error messages

    try {
      const response = await fetch('/api/address-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: walletAddress }),  // Send the entered address to the API
      });

      if (!response.ok) {
        throw new Error('Failed to fetch address info');
      }

      const data = await response.json();
      console.log('Address Info:', data);
      setAddressInfo(data);  // Store the fetched address info in state
    } catch (err) {
      console.error('Error fetching address info:', err);
      setError('Failed to fetch address info');  // Set an error message if the fetch fails
    }
  };

  return (
    <section className="mt-10 bg-gray-700 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold text-white mb-4">Fetch Bitcoin Address Info</h2>

      {/* Form to enter the Bitcoin address */}
      <form onSubmit={fetchAddressInfo}>
        <input
          type="text"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          placeholder="Enter Bitcoin Wallet Address"
          className="w-full p-2 mb-4 rounded-md text-black"
        />
        <button type="submit" className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-400">
          Fetch Address Info
        </button>
      </form>

      {/* Display the fetched address information */}
      {addressInfo && (
        <div className="mt-6 bg-gray-800 p-4 rounded-lg">
          <h3 className="text-2xl font-semibold text-white mb-4">Address Information:</h3>
          <pre className="text-white">{JSON.stringify(addressInfo, null, 2)}</pre>
        </div>
      )}

      {/* Display an error message if there's an error */}
      {error && <p className="text-red-500 mt-4">{error}</p>}
    </section>
  );
};

export default AddressInfo;
