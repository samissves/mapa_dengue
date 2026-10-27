import rawGeoJson from './bairros_limpos.json';
import { GeoJsonNeighborhoodCollection } from '../types/dengue';

/**
 * Malha cartográfica oficial dos bairros de São Luís - MA (bairros_limpos.geojson)
 * 264 bairros distribuídos pelos 9 Distritos Sanitários de São Luís.
 */
export const SAO_LUIS_BAIRROS_GEOJSON: GeoJsonNeighborhoodCollection = {
  type: 'FeatureCollection',
  name: 'Bairros de São Luís - MA',
  features: (rawGeoJson as any).features.map((feat: any, idx: number) => {
    const p = feat.properties || {};
    const name = p.name || p.NM_BAIRRO || `Bairro ${idx + 1}`;
    const layer = p.layer || 'DISTRITO 1 - CENTRO';
    const pop = Number(p.POPULACAO) || 25000;
    const fid = p.fid !== undefined ? String(p.fid) : `poly-${idx}`;
    return {
      type: 'Feature',
      properties: {
        ...p,
        id: fid,
        name,
        NM_BAIRRO: name,
        layer,
        distrito: layer,
        POPULACAO: pop
      },
      geometry: feat.geometry
    };
  })
};
