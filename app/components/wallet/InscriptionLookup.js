// app/components/wallets/InscriptionID.js

import React, { useState } from 'react';

const InscriptionLookup = () => {
 const [inscriptionId, setInscriptionId] = useState('');
 const [walletInfo, setWalletInfo] = useState(null);
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);

 const lookupInscription = async () => {
   if (!inscriptionId.trim()) {
     setError('Please enter an inscription ID');
     return;
   }

   setLoading(true);
   setError('');
   setWalletInfo(null);

   try {
     const response = await fetch(`http://143.198.17.64:3001/api/ord/inscription/${inscriptionId}`);
     console.log('Response status:', response.status);

     if (!response.ok) {
       throw new Error(`Inscription not found (Status: ${response.status})`);
     }

     const data = await response.json();
     console.log('Response data:', data);
     setWalletInfo(data);
   } catch (err) {
     console.error('Error details:', err);
     setError(err.message || 'Error fetching inscription information');
   } finally {
     setLoading(false);
   }
 };

 const formatTimestamp = (timestamp) => {
   return new Date(timestamp * 1000).toLocaleString();
 };

 const formatSats = (sats) => {
   return new Intl.NumberFormat().format(sats);
 };

 return (
   <div className="w-full max-w-md mx-auto p-6 border rounded-lg shadow-sm bg-white text-black">
     <h3 className="text-lg font-semibold mb-4 text-black">Inscription Lookup</h3>
     <div className="space-y-4">
       <div className="flex gap-2">
         <input
           type="text"
           placeholder="Enter inscription ID"
           value={inscriptionId}
           onChange={(e) => setInscriptionId(e.target.value)}
           className="flex-1 p-2 border rounded text-black"
         />
         <button
           onClick={lookupInscription}
           disabled={loading}
           className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
         >
           {loading ? 'Loading...' : 'Lookup'}
         </button>
       </div>

       {error && (
         <div className="p-3 bg-red-100 text-red-700 rounded">
           {error}
         </div>
       )}

       {walletInfo && (
         <div className="space-y-2">
           <h3 className="font-medium text-black">Inscription Details:</h3>
           <div className="bg-gray-50 p-4 rounded space-y-2 text-black">
             <p><span className="font-medium">Address:</span> {walletInfo.address}</p>
             <p><span className="font-medium">ID:</span> {walletInfo.id}</p>
             <p><span className="font-medium">Content Type:</span> {walletInfo.content_type}</p>
             <p><span className="font-medium">Content Length:</span> {walletInfo.content_length} bytes</p>
             <p><span className="font-medium">Height:</span> {walletInfo.height}</p>
             <p><span className="font-medium">Fee:</span> {walletInfo.fee} sats</p>
             <p><span className="font-medium">Timestamp:</span> {formatTimestamp(walletInfo.timestamp)}</p>
             <p><span className="font-medium">Value:</span> {formatSats(walletInfo.value)} sats</p>
             <p><span className="font-medium">Number:</span> {walletInfo.number}</p>
             {walletInfo.rune && <p><span className="font-medium">Rune:</span> {walletInfo.rune}</p>}
             {walletInfo.sat && <p><span className="font-medium">Sat:</span> {formatSats(walletInfo.sat)}</p>}

             <div className="mt-4">
               <p className="font-medium text-black">Links:</p>
               {walletInfo.previous && (
                 <p className="text-black"><span className="text-sm">Previous:</span> <span className="text-xs break-all">{walletInfo.previous}</span></p>
               )}
               {walletInfo.next && (
                 <p className="text-black"><span className="text-sm">Next:</span> <span className="text-xs break-all">{walletInfo.next}</span></p>
               )}
             </div>
           </div>
         </div>
       )}
     </div>
   </div>
 );
};

export default InscriptionLookup;