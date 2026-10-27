import * as polyclip from 'polyclip-ts';
import dissolve from '@turf/dissolve';
import { GeoJsonNeighborhoodCollection, GeoJsonNeighborhoodFeature } from '../types/dengue';
import { normalizeKey, getCanonicalDistrictName } from '../services/sheetsService';

/**
 * Cria uma coleção GeoJSON com os distritos sanitários unificados (dissolvidos),
 * eliminando as linhas internas entre bairros e deixando apenas o contorno externo de cada distrito.
 */
export function createDissolvedDistrictsGeoJson(
  sourceGeoJson: GeoJsonNeighborhoodCollection
): GeoJsonNeighborhoodCollection {
  if (!sourceGeoJson || !Array.isArray(sourceGeoJson.features) || sourceGeoJson.features.length === 0) {
    return sourceGeoJson;
  }

  try {
    // 1. Agrupar feições por distrito sanitário
    const districtGroups = new Map<string, GeoJsonNeighborhoodFeature[]>();

    sourceGeoJson.features.forEach((feat) => {
      const p = feat.properties || {};
      let distName = 
        p.layer || 
        p.Layer || 
        p.LAYER || 
        p.distrito || 
        p.Distrito || 
        p.DISTRITO || 
        p.NM_DISTRIT || 
        p.distritoSanitario || 
        '';

      distName = getCanonicalDistrictName(String(distName).trim());

      if (!districtGroups.has(distName)) {
        districtGroups.set(distName, []);
      }
      districtGroups.get(distName)!.push(feat);
    });

    const dissolvedFeatures: any[] = [];

    // 2. Para cada distrito, unir todos os polígonos dos bairros correspondentes
    for (const [distName, feats] of districtGroups.entries()) {
      let totalPop = 0;
      const bairrosNames: string[] = [];
      const allPolygons: Array<Array<Array<[number, number]>>> = [];

      feats.forEach((feat) => {
        const p = feat.properties || {};
        totalPop += Number(p.POPULACAO || p.populacao || p.POP) || 0;
        const bName = p.NM_BAIRRO || p.name || '';
        if (bName) bairrosNames.push(bName);

        const geom = feat.geometry;
        if (!geom) return;

        if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
          allPolygons.push(geom.coordinates as any);
        } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
          geom.coordinates.forEach((poly) => {
            if (Array.isArray(poly)) {
              allPolygons.push(poly as any);
            }
          });
        }
      });

      if (allPolygons.length === 0) continue;

      let unionGeometry: any = null;

      // Tenta realizar a união booleana dos polígonos via polyclip-ts
      try {
        if (allPolygons.length === 1) {
          unionGeometry = {
            type: 'Polygon',
            coordinates: allPolygons[0]
          };
        } else {
          // Unir todos os polígonos: elimina completamente as fronteiras internas
          const unionResult = polyclip.union(allPolygons[0], ...allPolygons.slice(1));
          
          if (Array.isArray(unionResult) && unionResult.length > 0) {
            if (unionResult.length === 1) {
              unionGeometry = {
                type: 'Polygon',
                coordinates: unionResult[0]
              };
            } else {
              unionGeometry = {
                type: 'MultiPolygon',
                coordinates: unionResult
              };
            }
          }
        }
      } catch (unionErr) {
        console.warn(`União direta falhou para o ${distName}, usando fallback:`, unionErr);
      }

      // Fallback caso polyclip não tenha gerado geometria (ex: polígonos auto-intersecionados)
      if (!unionGeometry) {
        if (allPolygons.length === 1) {
          unionGeometry = { type: 'Polygon', coordinates: allPolygons[0] };
        } else {
          unionGeometry = { type: 'MultiPolygon', coordinates: allPolygons };
        }
      }

      dissolvedFeatures.push({
        type: 'Feature',
        properties: {
          id: `distrito-${normalizeKey(distName)}`,
          layer: distName,
          distrito: distName,
          name: distName,
          NM_BAIRRO: distName,
          POPULACAO: totalPop,
          totalPopulacao: totalPop,
          bairrosCount: feats.length,
          bairrosNames
        },
        geometry: unionGeometry
      });
    }

    if (dissolvedFeatures.length > 0) {
      return {
        type: 'FeatureCollection',
        name: 'Distritos Sanitários de São Luís',
        features: dissolvedFeatures
      };
    }
  } catch (err) {
    console.warn('Erro ao processar dissolução de distritos, utilizando turf dissolve como fallback:', err);
    try {
      const preparedCollection: any = {
        type: 'FeatureCollection',
        features: sourceGeoJson.features.map(f => ({
          ...f,
          properties: {
            ...f.properties,
            layer: f.properties?.layer || f.properties?.distrito || 'Distrito'
          }
        }))
      };
      const turfDissolved = dissolve(preparedCollection, { propertyName: 'layer' }) as any;
      if (turfDissolved && Array.isArray(turfDissolved.features)) {
        return turfDissolved as GeoJsonNeighborhoodCollection;
      }
    } catch {}
  }

  return sourceGeoJson;
}

/**
 * Normaliza e padroniza campos de uma FeatureCollection GeoJSON de bairros.
 */
export function normalizeGeoJsonCollection(parsed: any): GeoJsonNeighborhoodCollection {
  if (!parsed || parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
    throw new Error('O arquivo não é um GeoJSON válido do tipo FeatureCollection.');
  }
  if (parsed.features.length === 0) {
    throw new Error('O arquivo GeoJSON não contém feições (features vazias).');
  }

  parsed.features.forEach((feat: any, idx: number) => {
    if (!feat.properties) feat.properties = {};
    const p = feat.properties;
    const detectedName = p.NM_BAIRRO || p.nm_bairro || p.bairro || p.Bairro || p.name || p.NOME || p.Name || `Polígono ${idx + 1}`;
    const detectedPop = Number(p.POPULACAO || p.populacao || p.POP || p.pop || p.POP_ESTIMADA) || 25000;
    const rawLayer = p.layer || p.Layer || p.LAYER || p.NM_DISTRIT || p.distrito || 'Distrito Centro';
    const norm = normalizeKey(String(rawLayer));
    const detectedLayer = (norm === 'sao luis' || norm === 'municipio de sao luis' || norm === 'ilha de sao luis') 
      ? 'Distrito Centro' 
      : rawLayer;

    p.NM_BAIRRO = detectedName;
    p.POPULACAO = detectedPop;
    p.layer = detectedLayer;
    p.distrito = detectedLayer;
    if (!p.name) p.name = detectedName;
    if (!p.id) p.id = p.CD_BAIRRO || p.id || `poly-${idx}`;
  });

  return parsed as GeoJsonNeighborhoodCollection;
}
