const fs = require('fs');
const path = require('path');

function extractFunctionSource(fileText, functionName){
  const start = fileText.indexOf(`function ${functionName}(map)`);
  if(start === -1) throw new Error(`Function ${functionName} not found`);

  const bodyStart = fileText.indexOf('{', start);
  let depth = 0;
  for(let i = bodyStart; i < fileText.length; i++){
    if(fileText[i] === '{') depth++;
    else if(fileText[i] === '}') depth--;
    if(depth === 0) return fileText.slice(start, i + 1);
  }
  throw new Error(`Function ${functionName} has unbalanced braces`);
}

function loadInitializeWaterSources(){
  const scriptPath = path.join(__dirname, 'script.js');
  const scriptText = fs.readFileSync(scriptPath, 'utf8');
  const source = extractFunctionSource(scriptText, 'initializeWaterSources');
  return new Function(`${source}; return initializeWaterSources;`)();
}

describe('initializeWaterSources', () => {
  test('does not re-add the water source when it already exists', () => {
    const initializeWaterSources = loadInitializeWaterSources();
    const existingSource = {
      getClusterExpansionZoom: (_clusterId, cb) => cb(null, 10),
    };
    const map = {
      getSource: jest.fn().mockReturnValue(existingSource),
      addSource: jest.fn(),
      getLayer: jest.fn(() => ({ id: 'existing-layer' })),
      addLayer: jest.fn(),
      on: jest.fn(),
      getCanvas: jest.fn(() => ({ style: {} })),
      querySourceFeatures: jest.fn(() => []),
      easeTo: jest.fn(),
    };

    expect(() => initializeWaterSources(map)).not.toThrow();
    expect(map.addSource).not.toHaveBeenCalled();
  });

  test('adds the water source if missing', () => {
    const initializeWaterSources = loadInitializeWaterSources();
    const map = {
      getSource: jest.fn().mockReturnValue(null),
      addSource: jest.fn(),
      getLayer: jest.fn((id) => {
        if(id === 'water-sources-layer' || id === 'water-sources-cluster' || id === 'water-sources-cluster-count') return null;
        return { id: 'existing-layer' };
      }),
      addLayer: jest.fn(),
      on: jest.fn(),
      getCanvas: jest.fn(() => ({ style: {} })),
      querySourceFeatures: jest.fn(() => []),
      easeTo: jest.fn(),
    };

    initializeWaterSources(map);

    expect(map.addSource).toHaveBeenCalledWith('water-sources', expect.objectContaining({
      type: 'geojson',
      cluster: true,
    }));
  });
});
