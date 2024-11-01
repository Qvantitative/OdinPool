import React from 'react';

const RunesBalance = ({ runesBalance }) => (
  <div className="mt-8">
    <h2 className="text-xl font-bold mb-4">Runes Balance</h2>
    <table className="table-auto border-collapse border border-gray-500 w-full">
      <thead>
        <tr>
          <th className="border border-gray-400 px-2 py-1">Rune Name</th>
          <th className="border border-gray-400 px-2 py-1">Amount</th>
          <th className="border border-gray-400 px-2 py-1">Symbol</th>
          <th className="border border-gray-400 px-2 py-1">Inscription ID</th>
        </tr>
      </thead>
      <tbody>
        {runesBalance.map((rune, index) => (
          <tr key={index}>
            <td className="border border-gray-400 px-2 py-1">{rune.runeName}</td>
            <td className="border border-gray-400 px-2 py-1">{rune.amount}</td>
            <td className="border border-gray-400 px-2 py-1">{rune.symbol}</td>
            <td className="border border-gray-400 px-2 py-1">{rune.inscriptionId}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default RunesBalance;
