// app/components/blocks/UpcomingBlockDisplay.js

import React from 'react';

const UpcomingBlockDisplay = ({ block, mempoolSize }) => {
  const { block_height, fees_estimate, feeSpan = { min: null, max: null }, timestamp } = block;

  // Optional: format timestamp if present
  const formattedTimestamp = timestamp ? new Date(timestamp).toLocaleString() : 'Timestamp not available';

  return (
    <div
      className="block-height inline-block text-center mb-2"
      style={{ flex: '0 0 auto', marginLeft: 'auto' }}
      key={block_height}
      aria-label={`Block #${block_height} with estimated fee of ${fees_estimate || 'N/A'} sat/vB`}
    >
      <h3 className="text-xl font-bold text-orange-500">#{block_height}</h3>
      <div className="relative perspective-3d m-4">
        <div
          className="block-face text-white p-4 top-4 left-4 flex flex-col justify-between relative animate-pulse-color"
          style={{
            background: 'radial-gradient(circle, #FFD700, #FF4500)', // Radiating yellow to orange gradient
          }}
        >
          <div>
            <p className="text-xs mb-1">{fees_estimate ? `${fees_estimate} sat/vB` : 'sat/vB'}</p>
            <p className="text-xs mb-1">
              {feeSpan && feeSpan.min !== null && feeSpan.max !== null && !isNaN(feeSpan.min) && !isNaN(feeSpan.max)
                ? `${Number(feeSpan.min).toFixed(2)} - ${Number(feeSpan.max).toFixed(2)} sat/vB`
                : 'Fee Span: Not Available'}
            </p>
            <p className="text-xs">{mempoolSize ? `${mempoolSize} Transactions in Mempool` : 'Mempool Size Not Available'}</p>
          </div>
          <p className="text-sm">~ 10 min</p>
        </div>
        <div className="block-side absolute h-full w-4 skew-y-[44deg] bg-[rgba(255,165,0,0.4)] dark:bg-[#ffb84d] top-0 left-0 origin-top-left z-10 animate-pulse-color"></div>
        <div className="block-top absolute w-full h-4 skew-x-[45deg] bg-[rgba(255,165,0,0.2)] dark:bg-[#ffcc80] top-0 right-0 origin-top-right z-10 animate-pulse-color"></div>
      </div>
    </div>
  );
};

export default UpcomingBlockDisplay;
