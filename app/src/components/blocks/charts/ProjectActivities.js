// app/components/blocks/charts/ProjectActivities.js

import dynamic from 'next/dynamic';

// Dynamically import Plotly without SSR
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

const ProjectActivities = ({ transferIntervals }) => {
  // Prepare data for Plotly
  const intervalOrder = { '10m': 1, '30m': 2, '1hr': 3, '4hr': 4 };

  // Sort time intervals
  const timeIntervals = [...new Set(transferIntervals.map((d) => d.time_interval))];
  timeIntervals.sort((a, b) => intervalOrder[a] - intervalOrder[b]);

  // Get unique projects
  const projects = [...new Set(transferIntervals.map((d) => d.project_slug))];

  // Prepare traces for Plotly
  const dataTraces = timeIntervals.map((interval) => {
    // Filter transferIntervals for this specific time interval
    const filteredData = transferIntervals.filter((d) => d.time_interval === interval);

    // Create bars dynamically for projects with non-zero transfer counts
    return filteredData.map((projectData, index) => ({
      x: [interval],
      y: [parseInt(projectData.transfer_count, 10)],
      name: projectData.project_slug,
      type: 'bar',
      offsetgroup: interval, // Ensures all bars for the same interval align together
    }));
  });

  // Flatten the dataTraces array as Plotly expects a flat array of traces
  const flatTraces = dataTraces.flat();

  const layout = {
    barmode: 'stack', // Stack bars to fill empty spaces dynamically
    title: 'Project Activities Over Intervals',
    xaxis: { title: 'Time Intervals', tickfont: { color: '#ccc' } },
    yaxis: { title: 'Transfer Count', tickfont: { color: '#ccc' } },
    plot_bgcolor: '#2d3748',
    paper_bgcolor: '#2d3748',
    font: {
      color: '#f7fafc',
    },
    legend: {
      orientation: 'h',
      y: -0.2,
      font: { color: '#ccc' },
    },
  };

  return (
    <div className="p-4 bg-gray-700 rounded-lg">
      <Plot
        data={flatTraces}
        layout={layout}
        style={{ width: '100%', height: '100%' }}
        config={{ responsive: true }}
      />
    </div>
  );
};

export default ProjectActivities;
