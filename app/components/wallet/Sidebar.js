import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const Sidebar = ({ show, onMouseEnter, onMouseLeave, walletAddress }) => {
  const [walletConnected, setWalletConnected] = useState(true); // Assume connected for this purpose
  const router = useRouter(); // Use Next.js router for navigation

  const handleDisconnect = async () => {
    try {
      console.log("Attempting to disconnect from the wallet...");

      if (window.XverseProviders && typeof window.XverseProviders.request === 'function') {
        const response = await window.XverseProviders.request("wallet_renouncePermissions");
        if (response.status !== 'success') {
          throw new Error('Renounce permissions failed.');
        }
      } else {
        console.log("Renouncing permissions not available, proceeding with manual disconnect.");
      }

      // Clear session storage, update state, and redirect to landing page
      sessionStorage.removeItem('accountData');
      setWalletConnected(false);
      alert('Disconnected from the wallet');

      // Redirect to the landing page
      router.push('/landingPage');

    } catch (err) {
      console.error("Error during wallet disconnect process:", err);
      alert('Something went wrong during the wallet disconnect process');
    }
  };

  return (
    <div
      className={`fixed right-0 h-[calc(100%-64px)] bg-gray-800 text-white w-64 shadow-lg transform transition-transform ${
        show ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{
        top: '64px',
        zIndex: 1000,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="p-4">
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Wallet Address</h3>
          <p className="text-sm break-words">{walletAddress}</p>
        </div>
        <div className="mt-6">
          {walletConnected && (
            <button
              onClick={handleDisconnect}
              className="text-white p-2 rounded-md shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
