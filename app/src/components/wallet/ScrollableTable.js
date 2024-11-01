import React from 'react';

const ScrollableTable = ({
  collections,
  sortConfig,
  handleSort,
  handleCollectionClick,
  fpInBTC,
  toggleFloorPrice  // Receive the prop here
}) => {

  return (
    <div className="h-full border-separate overflow-clip rounded-xl border border-solid flex flex-col">
      <table className="w-full table-fixed">
        <thead className="sticky top-0">
          <tr>
            <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('name')}>
              Collection {sortConfig.key === 'name' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
            </th>
            <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('fp')}>
              Floor Price (BTC) {sortConfig.key === 'fp' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
            </th>
            <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('fpPctChg')}>
              1D % Change {sortConfig.key === 'fpPctChg' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
            </th>
            <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('vol')}>
              Volume {sortConfig.key === 'vol' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
            </th>
            <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('marketCapUsd')}>
              Market Cap {sortConfig.key === 'marketCapUsd' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
            </th>
            <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('ownerCount')}>
              Owner Count {sortConfig.key === 'ownerCount' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
            </th>
            <th className="border border-gray-400 px-2 py-1 cursor-pointer" onClick={() => handleSort('listedCount')}>
              Listed Count {sortConfig.key === 'listedCount' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
            </th>
          </tr>
        </thead>
      </table>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full table-fixed">
          <tbody>
            {collections.slice(0, 100).map((collection, index) => (
              <tr key={index} onClick={() => handleCollectionClick(collection.name)} className="cursor-pointer">
                <td className="border border-gray-400 px-2 py-1">
                  <div className="flex items-center space-x-2">
                    <img
                      src={collection.image}
                      alt={collection.name}
                      className="w-8 h-8 object-cover rounded-full"
                    />
                    <span className="font-bold truncate" style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {collection.name}
                    </span>
                  </div>
                </td>
                <td className="border border-gray-400 px-2 py-1">
                  <div onClick={toggleFloorPrice} className="cursor-pointer">
                    {fpInBTC
                      ? `${parseFloat(collection.fp ?? 0).toFixed(4)} BTC`
                      : `$${((collection.fp ?? 0) * collection.currencyUsdRate).toFixed(4)}`}
                  </div>
                </td>
                <td className="border border-gray-400 px-2 py-1">
                  <div className={`text-xs ${collection.fpPctChg >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {collection.fpPctChg !== undefined && collection.fpPctChg !== null
                      ? `${collection.fpPctChg >= 0 ? '+' : ''}${collection.fpPctChg.toFixed(2)}%`
                      : 'N/A'}
                  </div>
                </td>
                <td className="border border-gray-400 px-2 py-1">
                  {collection.vol !== undefined && collection.vol !== null
                    ? parseFloat(collection.vol).toFixed(4)
                    : 'N/A'}
                </td>
                <td className="border border-gray-400 px-2 py-1">
                  {collection.marketCapUsd !== undefined && collection.marketCapUsd !== null
                    ? `$${parseFloat(collection.marketCapUsd).toFixed(2)}`
                    : 'N/A'}
                </td>
                <td className="border border-gray-400 px-2 py-1">
                  {collection.ownerCount !== undefined && collection.ownerCount !== null
                    ? collection.ownerCount
                    : 'N/A'}
                </td>
                <td className="border border-gray-400 px-2 py-1">
                  {collection.listedCount !== undefined && collection.listedCount !== null
                    ? collection.listedCount
                    : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScrollableTable;