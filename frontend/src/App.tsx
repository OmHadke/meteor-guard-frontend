import {useEffect, useMemo, useState} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {DeckGL} from '@deck.gl/react';
import {GeoJsonLayer} from '@deck.gl/layers';
import {simulate, neoSearch} from './api';
import type {GeoJSON} from 'geojson';

const MAP_STYLE = 'https://demotiles.maplibre.org/style.json';

function circle(center: [number, number], radiusMeters: number, steps=128) {
  const [lon, lat] = center;
  const coords: [number, number][] = [];
  const R = 6378137;
  for (let i=0; i<steps; i++) {
    const theta = (i/steps) * 2*Math.PI;
    const dx = radiusMeters * Math.cos(theta);
    const dy = radiusMeters * Math.sin(theta);
    const dLon = dx / (R * Math.cos(lat * Math.PI/180)) * 180/Math.PI;
    const dLat = dy / R * 180/Math.PI;
    coords.push([lon + dLon, lat + dLat]);
  }
  coords.push(coords[0]);
  return { type:'Feature' as const, geometry:{ type:'Polygon' as const, coordinates:[coords] }, properties:{} };
}

export default function App() {
  // Removed unused map state
  const [center, setCenter] = useState<[number, number]>([77.5946, 12.9716]);
  const [sim, setSim] = useState<any>(null);
  const [params, setParams] = useState({ diameter_m: 140, density_kg_m3: 3000, velocity_kms: 19, angle_deg: 30, composition: 'stony' });

  useEffect(() => {
  const m = new maplibregl.Map({ container:'map', style: MAP_STYLE, center, zoom: 8 });
  m.on('click', (e) => setCenter([e.lngLat.lng, e.lngLat.lat]));
  return () => m.remove();
  }, []);

  const layers = useMemo(() => {
    if (!sim) return [];
    const ctr: [number, number] = [sim.center.lon, sim.center.lat];
      const f1 = circle(ctr, sim.overpressure_radii_m['1psi']);
      const f5 = circle(ctr, sim.overpressure_radii_m['5psi']);
      const fc1: GeoJSON = { type: 'FeatureCollection', features: [f1] };
      const fc5: GeoJSON = { type: 'FeatureCollection', features: [f5] };
      return [
        new GeoJsonLayer({ id:'op-1psi', data:fc1 as GeoJSON, filled:true, stroked:true, getLineColor:[255,0,0,180], getFillColor:[255,0,0,50] }),
        new GeoJsonLayer({ id:'op-5psi', data:fc5 as GeoJSON, filled:true, stroked:true, getLineColor:[255,165,0,180], getFillColor:[255,165,0,50] })
      ];
  }, [sim]);

  async function runSim() {
    const data = await simulate({ ...params, lat: center[1], lon: center[0] });
    setSim(data);
  }

  return (
    <div style={{height:'100vh', display:'grid', gridTemplateColumns:'320px 1fr'}}>
      <aside style={{padding:12, borderRight:'1px solid #eee'}}>
        <h3>MeteorGuard</h3>
        <label>Diameter (m)
          <input type="number" value={params.diameter_m}
            onChange={e=>setParams(p=>({...p, diameter_m:Number(e.target.value)}))}/>
        </label>
        <label>Velocity (km/s)
          <input type="number" value={params.velocity_kms}
            onChange={e=>setParams(p=>({...p, velocity_kms:Number(e.target.value)}))}/>
        </label>
        <label>Angle (deg)
          <input type="number" value={params.angle_deg}
            onChange={e=>setParams(p=>({...p, angle_deg:Number(e.target.value)}))}/>
        </label>
        <label>Density (kg/m³)
          <input type="number" value={params.density_kg_m3}
            onChange={e=>setParams(p=>({...p, density_kg_m3:Number(e.target.value)}))}/>
        </label>
        <button onClick={runSim} style={{marginTop:8}}>Run simulation</button>
        <hr/>
        <button onClick={async ()=>{
          const rows = await neoSearch(true, 10);
          alert('Sample PHAs: ' + rows.map((r:any)=>r.des).join(', '));
        }}>Find PHAs</button>
        {sim && (
          <div style={{marginTop:8}}>
            <div>Regime: {sim.regime}</div>
            <div>Energy: {sim.e_kt.toFixed(1)} kt</div>
            <div>1 psi radius: {Math.round(sim.overpressure_radii_m['1psi']/1000)} km</div>
            <div>5 psi radius: {Math.round(sim.overpressure_radii_m['5psi']/1000)} km</div>
          </div>
        )}
        <p style={{fontSize:12, color:'#666'}}>Click map to set entry center.</p>
      </aside>
      <div style={{position:'relative'}}>
        <div id="map" style={{position:'absolute', inset:0}} />
        <DeckGL layers={layers} controller initialViewState={{longitude:center[0], latitude:center[1], zoom:8}} />
      </div>
    </div>
  );
}
