// app/components/blocks/charts/ProjectActivities.js

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';

const ProjectActivities = ({ transferIntervals }) => {
  // Prepare data for the chart
  const data = transferIntervals.map(item => ({
    time_interval: item.time_interval,
    transfer_count: parseInt(item.transfer_count, 10),
  }));

  // Sort data to ensure consistent order
  const intervalOrder = { '10m': 1, '30m': 2, '1hr': 3, '4hr': 4 };
  data.sort((a, b) => intervalOrder[a.time_interval] - intervalOrder[b.time_interval]);

  return (
    <div className="p-4 bg-gray-700 rounded-lg">
      <h2 className="text-xl font-semibold text-white mb-4">Project Activities Over Intervals</h2>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#555" />
          <XAxis dataKey="time_interval" stroke="#ccc" />
          <YAxis stroke="#ccc" />
          <Tooltip contentStyle={{ backgroundColor: '#333', borderColor: '#555' }} />
          <Legend wrapperStyle={{ color: '#ccc' }} />
          <Bar dataKey="transfer_count" fill="#8884d8" barSize={50} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProjectActivities;
