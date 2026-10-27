import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  BairroEpidemiology, 
  BasemapTheme, 
  ChoroplethMetric, 
  DistrictEpidemiology, 
  GeoJsonNeighborhoodCollection, 
  GeoJsonNeighborhoodFeature, 
  MapViewLevel 
} from '../types/dengue';
import { findBairroData, findDistrictData, getCanonicalDistrictName, normalizeKey } from '../services/sheetsService';
import { createDissolvedDistrictsGeoJson } from '../utils/districtGeoJson';
import { ChevronDown, ChevronUp, Layers, Maximize2, ShieldAlert } from 'lucide-react';

interface DengueMapProps {
  geoJsonData: GeoJsonNeighborhoodCollection;
  bairrosData: Record<string, BairroEpidemiology>;
  districtsData?: Record<string, DistrictEpidemiology>;
  viewLevel: MapViewLevel;
  selectedBairroId: string | null;
  onSelectBairro: (bairroId: string | null) => void;
  selectedDistrictName?: string | null;
  onSelectDistrict?: (distName: string | null) => void;
  metric: ChoroplethMetric;
  onChangeMetric?: (metric: ChoroplethMetric) => void;
  basemap: BasemapTheme;
  onChangeBasemap: (theme: BasemapTheme) => void;
  highlightSearchBairroId?: string | null;
  filterDistrito?: string;
  isEmbedMode?: boolean;
}

// Estilo de cores epidemiológicas oficiais: Incidência (por 100k hab.) vs Casos Prováveis
export function getMetricColor(value: number, metric?: ChoroplethMetric): string {
  if (metric === 'incidencia') {
    // Parâmetros oficiais do Ministério da Saúde para Taxa de Incidência de Dengue
    if (value >= 500) return '#991b1b'; // Muito Alto (Epidêmico / Emergência)
    if (value >= 300) return '#dc2626'; // Alto Risco
    if (value >= 100) return '#ea580c'; // Médio Risco
    if (value >= 25) return '#f59e0b';  // Alerta
    return '#10b981';                   // Baixo Risco
  }

  // Métrica padrão: Número de Casos Prováveis
  if (value >= 300) return '#991b1b';
  if (value >= 150) return '#dc2626';
  if (value >= 60) return '#ea580c';
  if (value >= 25) return '#f59e0b';
  return '#10b981';
}

export function getMetricLabel(metric?: ChoroplethMetric): string {
  if (metric === 'incidencia') {
    return 'Taxa de Incidência (por 100 mil hab.)';
  }
  return 'Número de Casos Prováveis';
}

// Funções utilitárias seguras para navegação no Leaflet sem NaN
function isSafeBounds(bounds: any): bounds is L.LatLngBounds {
  if (!bounds || typeof bounds.isValid !== 'function') return false;
  try {
    if (!bounds.isValid()) return false;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    if (!sw || !ne) return false;
    if (typeof sw.lat !== 'number' || typeof sw.lng !== 'number' || typeof ne.lat !== 'number' || typeof ne.lng !== 'number') return false;
    if (isNaN(sw.lat) || isNaN(sw.lng) || isNaN(ne.lat) || isNaN(ne.lng)) return false;
    if (!isFinite(sw.lat) || !isFinite(sw.lng) || !isFinite(ne.lat) || !isFinite(ne.lng)) return false;
    return true;
  } catch {
    return false;
  }
}

function safeFlyToBounds(
  map: L.Map | null | undefined,
  bounds: any,
  options: L.FitBoundsOptions & { duration?: number } = {}
) {
  if (!map || !isSafeBounds(bounds)) return;
  try {
    const size = map.getSize();
    if (!size || size.x <= 40 || size.y <= 40) {
      const center = bounds.getCenter();
      if (center && isFinite(center.lat) && isFinite(center.lng)) {
        map.setView(center, 12);
      }
      return;
    }

    let rawPadX = 20;
    let rawPadY = 20;
    if (options.padding) {
      if (Array.isArray(options.padding)) {
        rawPadX = Number(options.padding[0]) || 20;
        rawPadY = Number(options.padding[1]) || 20;
      } else if (typeof options.padding === 'object' && 'x' in options.padding && 'y' in options.padding) {
        rawPadX = Number((options.padding as L.Point).x) || 20;
        rawPadY = Number((options.padding as L.Point).y) || 20;
      }
    }
    const paddingX = Math.min(rawPadX, Math.floor(size.x / 4));
    const paddingY = Math.min(rawPadY, Math.floor(size.y / 4));
    const safeOptions = {
      ...options,
      padding: [paddingX, paddingY] as [number, number]
    };

    try {
      map.flyToBounds(bounds, safeOptions);
    } catch {
      map.fitBounds(bounds, { padding: [paddingX, paddingY], maxZoom: safeOptions.maxZoom });
    }
  } catch (err) {
    console.warn('safeFlyToBounds error handled:', err);
  }
}

function safeFlyTo(
  map: L.Map | null | undefined,
  center: { lat: number; lng: number } | [number, number] | null | undefined,
  zoom: number | undefined | null,
  options: L.ZoomPanOptions & { duration?: number } = {}
) {
  if (!map || !center) return;
  try {
    let lat: number | undefined;
    let lng: number | undefined;
    if (Array.isArray(center)) {
      lat = center[0];
      lng = center[1];
    } else if (typeof center === 'object' && 'lat' in center && 'lng' in center) {
      lat = (center as any).lat;
      lng = (center as any).lng;
    }
    if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
      return;
    }
    const safeZoom = (typeof zoom === 'number' && !isNaN(zoom) && isFinite(zoom)) ? zoom : map.getZoom() || 12;

    try {
      map.flyTo([lat, lng], safeZoom, options);
    } catch {
      map.setView([lat, lng], safeZoom);
    }
  } catch (err) {
    console.warn('safeFlyTo error handled:', err);
  }
}

export const DengueMap: React.FC<DengueMapProps> = ({
  geoJsonData,
  bairrosData,
  districtsData,
  viewLevel,
  selectedBairroId,
  onSelectBairro,
  selectedDistrictName,
  onSelectDistrict,
  metric,
  onChangeMetric,
  basemap,
  onChangeBasemap,
  highlightSearchBairroId,
  filterDistrito,
  isEmbedMode
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const initialFitDoneRef = useRef(false);
  // Guardar posição e zoom anteriores ao clique no bairro para restaurar ao fechar a janela
  const previousViewStateRef = useRef<{ center: L.LatLng; zoom: number } | null>(null);
  const prevTargetDistrictRef = useRef<string | null>(null);
  const prevTargetBairroRef = useRef<string | null>(null);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState<boolean>(Boolean(isEmbedMode));

  useEffect(() => {
    if (isEmbedMode) {
      setIsLegendCollapsed(true);
    }
  }, [isEmbedMode]);

  // Dissolver polígonos dos bairros em contornos externos unificados por distrito
  const dissolvedDistrictsGeoJson = useMemo(() => {
    return createDissolvedDistrictsGeoJson(geoJsonData);
  }, [geoJsonData]);

  // Inicializar o mapa do Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Coordenadas centrais da Ilha de São Luís: -2.53, -44.28
    const map = L.map(mapContainerRef.current, {
      center: [-2.540, -44.250],
      zoom: 12,
      minZoom: 10,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Atualizar Basemap (Somente OpenStreetMap e Satélite Híbrido)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let subdomains = 'abc';
    let maxZoom = 19;

    if (basemap === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      subdomains = '';
    }

    const newTileLayer = L.tileLayer(url, {
      subdomains,
      maxZoom,
      attribution: basemap === 'satellite' ? '&copy; Esri &copy; Maxar' : '&copy; OpenStreetMap contributors'
    });

    newTileLayer.addTo(map);
    tileLayerRef.current = newTileLayer;
  }, [basemap]);

  // Atualizar Camada GeoJSON quando mudar dados, métrica, nível de visualização ou filtro
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
    }

    // Na visualização de distritos, utilizar a camada unificada (dissolvida sem linhas internas)
    const activeGeoData = viewLevel === 'distrito' ? dissolvedDistrictsGeoJson : geoJsonData;

    const getBairroInfo = (feature: GeoJsonNeighborhoodFeature): BairroEpidemiology | undefined => {
      const p = feature.properties;
      return (
        findBairroData(bairrosData, p.id || '') ||
        findBairroData(bairrosData, p.NM_BAIRRO || '') ||
        findBairroData(bairrosData, p.name || '')
      );
    };

    const getFeatureStyle = (feature: any) => {
      const info = getBairroInfo(feature);
      const featureId = feature.properties.id || normalizeKey(feature.properties.NM_BAIRRO || feature.properties.name || '');
      const distName = feature.properties.layer || feature.properties.Layer || feature.properties.LAYER || feature.properties.distrito || info?.distritoSanitario || 'Distrito Central';
      
      const isDistrictSelected = viewLevel === 'distrito' && normalizeKey(selectedDistrictName || '') === normalizeKey(distName);
      const isBairroSelected = viewLevel === 'bairro' && (selectedBairroId === featureId || (info && info.id === selectedBairroId));
      const isSearchTarget = highlightSearchBairroId === featureId;

      // Filtro por distrito
      if (filterDistrito && filterDistrito !== 'all') {
        if (normalizeKey(distName) !== normalizeKey(filterDistrito)) {
          return {
            fillColor: '#64748b',
            fillOpacity: 0.08,
            color: '#475569',
            weight: 0.5,
            dashArray: '2, 4'
          };
        }
      }

      let metricVal = 0;
      const dist = findDistrictData(districtsData, distName);
      if (viewLevel === 'distrito' && dist) {
        // Agrupado por distrito (Incidência com população oficial do arquivo arrumado)
        metricVal = metric === 'incidencia' ? dist.incidencia : dist.totalCasos;
      } else if (info) {
        // Por bairro (Incidência calculada com população oficial do bairro)
        metricVal = metric === 'incidencia' ? info.incidencia : info.casos;
      }

      const color = (info || (viewLevel === 'distrito' && dist))
        ? getMetricColor(metricVal, metric)
        : '#64748b';

      const isSelected = isDistrictSelected || isBairroSelected;

      if (viewLevel === 'distrito') {
        // Estilo unificado para distritos: sem linhas internas de bairros, apenas contorno externo nítido
        const anyDistrictActive = Boolean(selectedDistrictName || (filterDistrito && filterDistrito !== 'all'));
        const isThisDistrictFocused = 
          (selectedDistrictName && normalizeKey(distName) === normalizeKey(selectedDistrictName)) ||
          (filterDistrito && filterDistrito !== 'all' && normalizeKey(distName) === normalizeKey(filterDistrito));

        if (anyDistrictActive) {
          if (isThisDistrictFocused) {
            return {
              fillColor: color,
              fillOpacity: 0.94,
              color: '#38bdf8', // Contorno ciano iluminado em destaque
              weight: 4.5,
              opacity: 1,
              className: 'transition-all duration-300 cursor-pointer drop-shadow-2xl'
            };
          } else {
            // Outros distritos ficam sutilmente atenuados para destacar o distrito selecionado
            return {
              fillColor: color,
              fillOpacity: 0.28,
              color: 'rgba(255, 255, 255, 0.3)',
              weight: 1.2,
              opacity: 0.45,
              className: 'transition-all duration-300 cursor-pointer opacity-60'
            };
          }
        }

        return {
          fillColor: color,
          fillOpacity: 0.72,
          color: '#ffffff',
          weight: 2.2,
          opacity: 0.95,
          className: 'transition-all duration-200 cursor-pointer drop-shadow-md'
        };
      }

      // Estilo por bairros
      return {
        fillColor: color,
        fillOpacity: isSelected ? 0.85 : isSearchTarget ? 0.9 : 0.65,
        color: isSelected ? '#ffffff' : isSearchTarget ? '#38bdf8' : '#0f172a',
        weight: isSelected ? 3.5 : isSearchTarget ? 3 : 1.2,
        opacity: 0.95,
        className: 'transition-all duration-200 cursor-pointer'
      };
    };

    const geoJsonLayer = L.geoJSON(activeGeoData as any, {
      style: getFeatureStyle,
      onEachFeature: (feature, layer) => {
        const info = getBairroInfo(feature as GeoJsonNeighborhoodFeature);
        const name = feature.properties.NM_BAIRRO || feature.properties.name || 'Bairro';
        const distName = feature.properties.layer || feature.properties.Layer || feature.properties.LAYER || feature.properties.distrito || info?.distritoSanitario || 'Distrito Central';
        const popGeoJson = feature.properties.POPULACAO || info?.populacao || 0;
        const distInfo = findDistrictData(districtsData, distName);

        let tooltipContent = '';

        if (viewLevel === 'distrito') {
          // Tooltip de Visualização por Distrito com Casos e Incidência Oficial
          const distCases = distInfo ? distInfo.totalCasos : 0;
          const distIncid = distInfo ? distInfo.incidencia : 0;
          const distPop = distInfo ? distInfo.totalPopulacao : 0;
          const distCount = distInfo ? distInfo.bairrosCount : 0;
          const officialDisplayName = distInfo ? distInfo.distritoNome : getCanonicalDistrictName(distName);

          tooltipContent = `
            <div class="px-2.5 py-1.5 text-xs font-sans leading-tight">
              <span class="text-rose-400 text-[10px] font-bold uppercase tracking-wider block">Distrito Sanitário</span>
              <strong class="text-white block text-sm font-semibold">${officialDisplayName}</strong>
              <div class="mt-1.5 pt-1.5 border-t border-slate-700/60 text-[11px] space-y-1">
                <div class="flex justify-between gap-3 ${metric === 'casos' ? 'bg-amber-500/20 px-1 py-0.5 rounded text-amber-200 font-bold' : ''}">
                  <span class="text-slate-400">Casos Prováveis:</span>
                  <span class="text-right ${metric === 'casos' ? 'text-amber-200' : 'text-white font-bold'}">${distCases.toLocaleString('pt-BR')}</span>
                </div>
                <div class="flex justify-between gap-3 ${metric === 'incidencia' ? 'bg-rose-500/20 px-1 py-0.5 rounded text-rose-200 font-bold' : ''}">
                  <span class="text-slate-400">Taxa de Incidência:</span>
                  <span class="text-right ${metric === 'incidencia' ? 'text-rose-200 font-bold' : 'text-rose-400 font-semibold'}">${distIncid.toLocaleString('pt-BR')} <span class="text-[9px] text-slate-400">/ 100k hab.</span></span>
                </div>
                <div class="flex justify-between gap-3 text-[10px]">
                  <span class="text-slate-400">População Oficial:</span>
                  <span class="text-slate-300 text-right font-medium">${distPop.toLocaleString('pt-BR')} hab.</span>
                </div>
                <div class="flex justify-between gap-3 text-[10px]">
                  <span class="text-slate-400">Bairros Monitorados:</span>
                  <span class="font-semibold text-slate-300 text-right">${distCount}</span>
                </div>
              </div>
            </div>
          `;
        } else {
          // Tooltip de Visualização por Bairro com Casos e Incidência (calculada com população oficial)
          const bCasos = info ? info.casos : 0;
          const bIncid = info ? info.incidencia : 0;
          const bPop = info?.populacao || popGeoJson || 0;

          tooltipContent = `
            <div class="px-2.5 py-1.5 text-xs font-sans leading-tight">
              <strong class="text-white block text-sm font-semibold">${name}</strong>
              <span class="text-slate-300 text-[11px] block mb-1">${distName}</span>
              <div class="mt-1.5 pt-1.5 border-t border-slate-700/60 text-[11px] space-y-1">
                <div class="flex justify-between gap-3 ${metric === 'casos' ? 'bg-amber-500/20 px-1 py-0.5 rounded text-amber-200 font-bold' : ''}">
                  <span class="text-slate-400">Casos Prováveis:</span>
                  <span class="text-right ${metric === 'casos' ? 'text-amber-200' : 'text-white font-bold'}">${bCasos.toLocaleString('pt-BR')}</span>
                </div>
                <div class="flex justify-between gap-3 ${metric === 'incidencia' ? 'bg-rose-500/20 px-1 py-0.5 rounded text-rose-200 font-bold' : ''}">
                  <span class="text-slate-400">Taxa de Incidência:</span>
                  <span class="text-right ${metric === 'incidencia' ? 'text-rose-200 font-bold' : 'text-rose-400 font-semibold'}">${bIncid.toLocaleString('pt-BR')} <span class="text-[9px] text-slate-400">/ 100k hab.</span></span>
                </div>
                ${bPop > 0 ? `
                  <div class="flex justify-between gap-3 text-[10px]">
                    <span class="text-slate-400">População Oficial:</span>
                    <span class="text-slate-300 text-right font-medium">${bPop.toLocaleString('pt-BR')} hab.</span>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }

        layer.bindTooltip(tooltipContent, {
          sticky: true,
          direction: 'top',
          className: 'leaflet-custom-tooltip bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white rounded-xl shadow-2xl p-0'
        });

        layer.on({
          mouseover: (e) => {
            const l = e.target;
            l.setStyle({
              weight: viewLevel === 'distrito' ? 4.5 : 3,
              color: '#f8fafc',
              fillOpacity: 0.88
            });
            l.bringToFront();
          },
          mouseout: (e) => {
            geoJsonLayer.resetStyle(e.target);
          },
          click: (e) => {
            if (viewLevel === 'distrito') {
              // No modo distrito: selecionar distrito e dar zoom no contorno do distrito inteiro
              const chosenDistrict = distInfo ? distInfo.distritoNome : getCanonicalDistrictName(distName);
              if (onSelectDistrict) {
                onSelectDistrict(chosenDistrict);
              }
              onSelectBairro(null); // Limpar seleção de bairro para destacar o distrito
              try {
                const bounds = e.target.getBounds();
                if (isSafeBounds(bounds)) {
                  safeFlyToBounds(mapInstanceRef.current, bounds, {
                    padding: [50, 50],
                    maxZoom: 13,
                    duration: 1.2
                  });
                }
              } catch {}
            } else {
              // No modo bairro: selecionar bairro e dar zoom no bairro (ou desselecionar se já ativo)
              const bId = info?.id || feature.properties.id || feature.properties.NM_BAIRRO || feature.properties.name || '';
              const currentActive = selectedBairroId || highlightSearchBairroId;
              if (currentActive && (currentActive === bId || normalizeKey(currentActive) === normalizeKey(bId))) {
                onSelectBairro(null);
              } else {
                onSelectBairro(bId);
              }
            }
          }
        });
      }
    });

    geoJsonLayer.addTo(map);
    geoJsonLayerRef.current = geoJsonLayer;

    try {
      const bounds = geoJsonLayer.getBounds();
      if (isSafeBounds(bounds) && !initialFitDoneRef.current) {
        map.invalidateSize();
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 14 });
        initialFitDoneRef.current = true;
      }
    } catch {}
  }, [
    geoJsonData, 
    dissolvedDistrictsGeoJson, 
    bairrosData, 
    districtsData, 
    viewLevel, 
    metric, 
    selectedBairroId, 
    selectedDistrictName, 
    highlightSearchBairroId, 
    filterDistrito
  ]);

  // Foco com zoom quando um distrito é selecionado pelo painel, filtro ou cabeçalho
  useEffect(() => {
    const targetDistrict = (filterDistrito && filterDistrito !== 'all') ? filterDistrito : selectedDistrictName;
    const prevDistrict = prevTargetDistrictRef.current;

    // Se o distrito selecionado não sofreu alteração, não sobrepor a visão/zoom atual do usuário
    if (targetDistrict === prevDistrict) {
      return;
    }
    prevTargetDistrictRef.current = targetDistrict || null;

    if (!targetDistrict) {
      // Somente reseta a visão caso houvesse um distrito ativo previamente
      if (prevDistrict && geoJsonLayerRef.current && mapInstanceRef.current && initialFitDoneRef.current) {
        const bounds = geoJsonLayerRef.current.getBounds();
        if (isSafeBounds(bounds)) {
          safeFlyToBounds(mapInstanceRef.current, bounds, { padding: [20, 20], duration: 1 });
        }
      }
      return;
    }

    if (!geoJsonLayerRef.current || !mapInstanceRef.current) return;

    if (viewLevel === 'distrito') {
      geoJsonLayerRef.current.eachLayer((layer: any) => {
        const feat = layer.feature;
        if (!feat) return;
        const p = feat.properties;
        const dName = p.layer || p.distrito || '';
        if (normalizeKey(dName) === normalizeKey(targetDistrict)) {
          try {
            const bounds = layer.getBounds();
            if (isSafeBounds(bounds)) {
              safeFlyToBounds(mapInstanceRef.current, bounds, {
                padding: [50, 50],
                maxZoom: 13,
                duration: 1.2
              });
            }
          } catch {}
        }
      });
    } else {
      // No modo bairro, calcular envelope unificado de todos os bairros daquele distrito
      let hasMatchedLayers = false;
      let groupBounds: L.LatLngBounds | null = null;
      geoJsonLayerRef.current.eachLayer((layer: any) => {
        const feat = layer.feature;
        if (!feat) return;
        const p = feat.properties;
        const dName = p.layer || p.distrito || '';
        if (normalizeKey(dName) === normalizeKey(targetDistrict)) {
          try {
            const bounds = layer.getBounds();
            if (isSafeBounds(bounds)) {
              if (!groupBounds) {
                groupBounds = L.latLngBounds(bounds.getSouthWest(), bounds.getNorthEast());
              } else {
                groupBounds.extend(bounds);
              }
              hasMatchedLayers = true;
            }
          } catch {}
        }
      });
      if (hasMatchedLayers && groupBounds && isSafeBounds(groupBounds)) {
        safeFlyToBounds(mapInstanceRef.current, groupBounds, {
          padding: [50, 50],
          maxZoom: 13,
          duration: 1.2
        });
      }
    }
  }, [selectedDistrictName, filterDistrito, viewLevel]);

  // Foco com zoom quando um bairro é pesquisado ou selecionado, e restauração ao fechar seleção
  useEffect(() => {
    if (viewLevel === 'distrito') return;
    const targetId = highlightSearchBairroId || selectedBairroId || null;
    const prevTargetId = prevTargetBairroRef.current;

    // Se o bairro selecionado não mudou, não reiniciar nem voar novamente
    if (targetId === prevTargetId) {
      return;
    }
    prevTargetBairroRef.current = targetId;

    const map = mapInstanceRef.current;
    if (!map) return;

    if (targetId) {
      // Salvar estado prévio de visão geral antes de focar no bairro selecionado
      if (!previousViewStateRef.current) {
        const c = map.getCenter();
        const z = map.getZoom();
        if (c && isFinite(c.lat) && isFinite(c.lng) && isFinite(z) && z <= 12.5) {
          previousViewStateRef.current = {
            center: c,
            zoom: z
          };
        }
      }

      if (!geoJsonLayerRef.current) return;
      geoJsonLayerRef.current.eachLayer((layer: any) => {
        const feat = layer.feature;
        if (!feat) return;
        const p = feat.properties;
        const matches = 
          p.id === targetId ||
          normalizeKey(p.id || '') === normalizeKey(targetId) ||
          normalizeKey(p.NM_BAIRRO || p.name || '') === normalizeKey(targetId);

        if (matches) {
          try {
            const bounds = layer.getBounds();
            if (isSafeBounds(bounds)) {
              safeFlyToBounds(map, bounds, {
                padding: [40, 40],
                maxZoom: 14,
                duration: 1.2
              });
            }
          } catch {}
        }
      });
    } else if (prevTargetId) {
      // Quando fechar a seleção do bairro (targetId é null após ter um selecionado), retornar à visão adequada
      const activeDistrict = (filterDistrito && filterDistrito !== 'all') ? filterDistrito : selectedDistrictName;
      let restoredToDistrict = false;

      // 1. Se houver um distrito ativo filtrado, enquadrar no distrito
      if (activeDistrict && geoJsonLayerRef.current) {
        const distNorm = normalizeKey(activeDistrict);
        let distBounds: L.LatLngBounds | null = null;
        geoJsonLayerRef.current.eachLayer((layer: any) => {
          const feat = layer.feature;
          if (!feat) return;
          const p = feat.properties;
          const dName = p.layer || p.Layer || p.distrito || p.distritoSanitario || '';
          if (normalizeKey(dName) === distNorm) {
            try {
              const b = layer.getBounds();
              if (isSafeBounds(b)) {
                if (!distBounds) {
                  distBounds = L.latLngBounds(b.getSouthWest(), b.getNorthEast());
                } else {
                  distBounds.extend(b);
                }
              }
            } catch {}
          }
        });

        if (distBounds && isSafeBounds(distBounds)) {
          previousViewStateRef.current = null;
          safeFlyToBounds(map, distBounds, {
            padding: [50, 50],
            maxZoom: 13,
            duration: 1.0
          });
          restoredToDistrict = true;
        }
      }

      // 2. Se não restaurou para distrito, restaurar para o estado anterior salvo ou visão geral de São Luís
      if (!restoredToDistrict) {
        if (previousViewStateRef.current && previousViewStateRef.current.zoom <= 12.5) {
          const { center, zoom } = previousViewStateRef.current;
          previousViewStateRef.current = null;
          if (center && isFinite(center.lat) && isFinite(center.lng) && isFinite(zoom)) {
            safeFlyTo(map, center, zoom, {
              duration: 1.0
            });
          } else if (geoJsonLayerRef.current) {
            const bounds = geoJsonLayerRef.current.getBounds();
            if (isSafeBounds(bounds)) {
              safeFlyToBounds(map, bounds, { padding: [20, 20], duration: 1.0 });
            }
          }
        } else if (geoJsonLayerRef.current) {
          previousViewStateRef.current = null;
          const bounds = geoJsonLayerRef.current.getBounds();
          if (isSafeBounds(bounds)) {
            safeFlyToBounds(map, bounds, { padding: [20, 20], duration: 1.0 });
          }
        }
      }
    }
  }, [highlightSearchBairroId, selectedBairroId, viewLevel, filterDistrito, selectedDistrictName]);

  const handleResetBounds = () => {
    if (geoJsonLayerRef.current && mapInstanceRef.current) {
      const bounds = geoJsonLayerRef.current.getBounds();
      if (isSafeBounds(bounds)) {
        safeFlyToBounds(mapInstanceRef.current, bounds, { padding: [20, 20], duration: 1 });
      }
    }
  };

  return (
    <div className="relative w-full h-full min-h-[380px] bg-slate-950 overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Botões Flutuantes Superiores: Basemap switcher, Metric switcher & Reset zoom */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        {/* Alternância Rápida de Métrica Direto no Mapa */}
        {onChangeMetric && (
          <div className="flex items-center rounded-xl bg-slate-900/90 border border-slate-700/80 p-0.5 text-xs backdrop-blur-md shadow-lg">
            <button
              type="button"
              onClick={() => onChangeMetric('incidencia')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                metric === 'incidencia' 
                  ? 'bg-rose-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Exibir Taxa de Incidência (por 100 mil hab.)"
            >
              Incidência
            </button>
            <button
              type="button"
              onClick={() => onChangeMetric('casos')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                metric === 'casos' 
                  ? 'bg-amber-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Exibir Casos Prováveis"
            >
              Casos
            </button>
          </div>
        )}

        <button
          onClick={handleResetBounds}
          title="Ver toda a Ilha de São Luís"
          className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 shadow-lg backdrop-blur-md transition-all active:scale-95"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            title="Alterar Camada do Mapa Base"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700/80 shadow-lg backdrop-blur-md transition-all"
          >
            <Layers className="w-4 h-4 text-rose-400" />
            <span className="hidden sm:inline">
              {basemap === 'satellite' ? 'Satélite' : 'OpenStreetMap'}
            </span>
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-lg p-1.5 text-xs text-slate-200 z-50">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                Camadas Disponíveis
              </div>
              <button
                onClick={() => { onChangeBasemap('osm'); setShowLayerMenu(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                  basemap === 'osm' ? 'bg-rose-500/20 text-rose-300 font-semibold' : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <span>OpenStreetMap</span>
                {basemap === 'osm' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
              </button>
              <button
                onClick={() => { onChangeBasemap('satellite'); setShowLayerMenu(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                  basemap === 'satellite' ? 'bg-rose-500/20 text-rose-300 font-semibold' : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <span>Satélite Híbrido</span>
                {basemap === 'satellite' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Legenda Epidemiológica Flutuante (Inferior Esquerda) com tamanho compacto e minimização */}
      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-10 transition-all">
        {isLegendCollapsed ? (
          <button
            onClick={() => setIsLegendCollapsed(false)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-slate-200 border border-slate-700/80 shadow-2xl backdrop-blur-md text-[11px] font-semibold transition active:scale-95 group"
            title="Expandir legenda de cores epidemiológicas"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
            <span>Legenda: {metric === 'incidencia' ? 'Incidência' : 'Casos'}</span>
            <div className="flex items-center gap-0.5 ml-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#991b1b]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#ea580c]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
            </div>
            <ChevronUp className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
          </button>
        ) : (
          <div className="max-w-[200px] sm:max-w-[220px] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-2 sm:p-2.5 shadow-2xl text-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-white mb-1.5 pb-1 border-b border-slate-800">
              <div className="flex items-center gap-1.5 min-w-0">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                <span className="truncate">
                  {metric === 'incidencia' ? 'Incidência / 100k' : 'Casos Prováveis'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsLegendCollapsed(true)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Minimizar legenda"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {metric === 'incidencia' ? (
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#991b1b] flex-shrink-0" />
                  <span className="text-slate-200 font-medium">≥ 500 (Muito Alto)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#dc2626] flex-shrink-0" />
                  <span className="text-slate-300 font-medium">300 a 499 (Alto)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#ea580c] flex-shrink-0" />
                  <span className="text-slate-300">100 a 299 (Médio)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b] flex-shrink-0" />
                  <span className="text-slate-300">25 a 99 (Alerta)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#10b981] flex-shrink-0" />
                  <span className="text-slate-300">&lt; 25 (Baixo)</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#991b1b] flex-shrink-0" />
                  <span className="text-slate-200 font-medium">≥ 300 casos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#dc2626] flex-shrink-0" />
                  <span className="text-slate-300 font-medium">150 a 299 casos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#ea580c] flex-shrink-0" />
                  <span className="text-slate-300">60 a 149 casos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b] flex-shrink-0" />
                  <span className="text-slate-300">25 a 59 casos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#10b981] flex-shrink-0" />
                  <span className="text-slate-300">&lt; 25 casos</span>
                </div>
              </div>
            )}

            <div className="mt-1.5 pt-1 border-t border-slate-800/80 text-[9px] text-slate-400 flex items-center justify-between">
              <span>{viewLevel === 'distrito' ? 'Distritos' : 'Bairros'}</span>
              <span>{metric === 'incidencia' ? 'Taxa p/ 100k' : 'Casos prováveis'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
