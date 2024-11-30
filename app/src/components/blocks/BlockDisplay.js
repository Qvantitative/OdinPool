// app/components/blocks/BlockDisplay.js

import React from 'react';

const BlockDisplay = ({ block, onBlockClick }) => {
  const { block_height, fees_estimate, feeSpan, transactions, timestamp, mining_pool, inscriptions } = block || {};

  // Optional: format timestamp if present
  const formattedTimestamp = timestamp ? new Date(timestamp).toLocaleString() : 'Timestamp not available';

  return (
    <div
      className="block-height inline-block text-center mb-2 cursor-pointer"
      style={{ flex: '0 0 auto', marginRight: 'auto' }}
      aria-label={`Block #${block_height} mined by ${mining_pool || 'Unknown'} with estimated fee of ${fees_estimate || 'N/A'} sat/vB`}
      onClick={() => onBlockClick(block)}
    >
      <h3 className="text-xl font-bold text-blue-500">#{block_height}</h3>
      <div className="relative perspective-3d m-4">
        <div
          className="block-face text-white p-4 top-4 left-4 flex flex-col justify-between relative"
          style={{
            background: 'linear-gradient(to bottom, #008080, #007BFF)', // Teal to Blue gradient
          }}
        >
          <div>
            <p className="text-xs mb-1">{fees_estimate ? `${fees_estimate} sat/vB` : 'sat/vB'}</p>
            <p className="text-xs mb-1">
              {feeSpan && feeSpan.min !== null && feeSpan.max !== null && !isNaN(feeSpan.min) && !isNaN(feeSpan.max)
                ? `${Number(feeSpan.min).toFixed(2)} - ${Number(feeSpan.max).toFixed(2)} sat/vB`
                : 'Fee Span: Not Available'}
            </p>
            <p className="text-xs">{inscriptions} Inscriptions</p>
            <p className="text-xs">{transactions} Transactions</p>
          </div>
          <p className="text-sm">
            {formattedTimestamp}
          </p>
        </div>
        <div className="block-side absolute h-full w-4 skew-y-[44deg] bg-[rgba(55,67,128,0.4)] dark:bg-[#233070] top-0 left-0 origin-top-left z-10"></div>
        <div className="block-top absolute w-full h-4 skew-x-[45deg] bg-[rgba(55,67,128,0.2)] dark:bg-[#374590] top-0 right-0 origin-top-right z-10"></div>
      </div>
      <h3 className="text-md text-yellow-500 p-2 ml-6">{mining_pool || 'Unknown'}</h3>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(BlockDisplay);
