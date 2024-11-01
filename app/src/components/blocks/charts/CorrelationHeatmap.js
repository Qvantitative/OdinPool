// app/components/blocks/charts/CorrelationHeatMap.js

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';

const Plot = dynamic(
  () => import('react-plotly.js').then((mod) => mod.default),
  { ssr: false, loading: () => <div>Loading chart...</div> }
);

const preprocessData = (data, variables) => {
  return data.map(block => {
    const processedBlock = {};
    variables.forEach(variable => {
      let value;
      if (variable === 'min_fee') {
        value = block.feeSpan?.min;
      } else if (variable === 'max_fee') {
        value = block.feeSpan?.max;
      } else {
        value = block[variable];
      }
      if (typeof value === 'string') {
        value = parseFloat(value);
      }
      processedBlock[variable] = isNaN(value) ? null : value;
    });
    return processedBlock;
  });
};

const calculateCorrelation = (data, var1, var2) => {
  const validPairs = data.filter(d =>
    d[var1] !== null && d[var2] !== null &&
    typeof d[var1] === 'number' && typeof d[var2] === 'number'
  );
  const n = validPairs.length;

  if (n === 0) return 0;
  if (var1 === var2) return 1; // Perfect correlation for same variable

  let sum_X = 0, sum_Y = 0, sum_XY = 0;
  let squareSum_X = 0, squareSum_Y = 0;

  for (let i = 0; i < n; i++) {
    const x = validPairs[i][var1];
    const y = validPairs[i][var2];
    sum_X += x;
    sum_Y += y;
    sum_XY += x * y;
    squareSum_X += x * x;
    squareSum_Y += y * y;
  }

  const numerator = n * sum_XY - sum_X * sum_Y;
  const denominator = Math.sqrt((n * squareSum_X - sum_X * sum_X) * (n * squareSum_Y - sum_Y * sum_Y));
  return denominator === 0 ? 0 : numerator / denominator;
};

const CorrelationHeatmap = ({ blockData }) => {
  const variables = ['transactions', 'fees_estimate', 'min_fee', 'max_fee'];

  const correlationData = useMemo(() => {
    if (!blockData || blockData.length === 0) return [];

    const preprocessedData = preprocessData(blockData, variables);
    console.log("Preprocessed data sample:", preprocessedData.slice(0, 5));

    const correlations = variables.map((var1) =>
      variables.map((var2) => {
        const corr = calculateCorrelation(preprocessedData, var1, var2);
        console.log(`Correlation between ${var1} and ${var2}: ${corr}`);
        console.log(`Sample values for ${var1}:`, preprocessedData.slice(0, 5).map(d => d[var1]));
        console.log(`Sample values for ${var2}:`, preprocessedData.slice(0, 5).map(d => d[var2]));
        return corr;
      })
    );

    return correlations;
  }, [blockData]);

  const customColorScale = [
    [0, 'rgb(0, 0, 255)'],
    [0.25, 'rgb(100, 100, 255)'],
    [0.5, 'rgb(255, 255, 255)'],
    [0.75, 'rgb(255, 100, 100)'],
    [1, 'rgb(255, 0, 0)']
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
      <h2 className="text-2xl font-semibold text-white mb-4">Correlation Heatmap</h2>
      {correlationData.length > 0 ? (
        <div style={{ width: '100%', height: '400px' }}>
          <Plot
            data={[
              {
                z: correlationData,
                x: variables,
                y: variables,
                type: 'heatmap',
                colorscale: customColorScale,
                zmin: -1,
                zmax: 1,
                hoverongaps: false,
                hovertemplate: 'X: %{x}<br>Y: %{y}<br>Correlation: %{z:.2f}<extra></extra>',
              },
            ]}
            layout={{
              autosize: true,
              title: '',
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              font: { family: 'Arial, sans-serif', size: 12, color: '#ffffff' },
              xaxis: {
                title: 'Variables',
                titlefont: { size: 14, color: '#ffffff' },
                tickfont: { size: 12, color: '#ffffff' },
              },
              yaxis: {
                title: 'Variables',
                titlefont: { size: 14, color: '#ffffff' },
                tickfont: { size: 12, color: '#ffffff' },
                automargin: true,
              },
              margin: { t: 50, l: 100, r: 20, b: 80 },
              annotations: variables.map((var1, i) =>
                variables.map((var2, j) => ({
                  text: correlationData[i][j].toFixed(2),
                  x: var2,
                  y: var1,
                  xref: 'x',
                  yref: 'y',
                  showarrow: false,
                  font: {
                    color: Math.abs(correlationData[i][j]) > 0.5 ? 'white' : 'black',
                    size: 10,
                  },
                })).flat()
              ),
            }}
            config={{ responsive: true }}
            useResizeHandler={true}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      ) : (
        <div className="text-white">No data available for correlation analysis</div>
      )}
    </div>
  );
};

export default CorrelationHeatmap;