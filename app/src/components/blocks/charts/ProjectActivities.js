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

  // Prepare traces for each project
  const dataTraces = projects.map((project, index) => {
    const yValues = timeIntervals.map((interval) => {
      const item = transferIntervals.find(
        (d) => d.time_interval === interval && d.project_slug === project
      );
      return item ? parseInt(item.transfer_count, 10) : 0;
    });

    return {
      x: timeIntervals,
      y: yValues,
      name: project,
      type: 'bar',
      offsetgroup: index, // Ensure bars within the same interval stack tightly
    };
  });

  const layout = {
    barmode: 'group', // Grouped bars without space
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
    bargap: 0, // Remove gaps between bars
    bargroupgap: 0, // Remove gaps within groups
  };

  return (
    <div className="p-4 bg-gray-700 rounded-lg">
      <Plot
        data={dataTraces}
        layout={layout}
        style={{ width: '100%', height: '100%' }}
        config={{ responsive: true }}
      />
    </div>
  );
};

export default ProjectActivities;
