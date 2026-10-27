import { SAO_LUIS_BAIRROS_GEOJSON } from './saoLuisGeoJson';
import bairroDistritosData from './bairroDistritosArrumado.json';
import { BairroEpidemiology, RiskLevel, WeeklyDataSummary } from '../types/dengue';
import { getCanonicalDistrictName, normalizeKey } from '../utils/districtNames';

export function calculateRiskLevel(incidencia: number): RiskLevel {
  if (incidencia >= 500) return 'muito_alto';
  if (incidencia >= 300) return 'alto';
  if (incidencia >= 100) return 'medio';
  return 'baixo';
}

// Casos de exemplo representativos (N_CASOS) para cada bairro de São Luís
const CASOS_EXEMPLO: Record<string, number> = {
  'cidade-operaria': 478,
  'turu': 395,
  'cohatrac': 320,
  'cidade-olimpica': 228,
  'coroadinho': 215,
  'anjo-da-guarda': 198,
  'cohab-anil': 142,
  'parque-vitoria': 122,
  'vila-embratel': 118,
  'sao-cristovao': 110,
  'vila-palmeira': 94,
  'liberdade': 89,
  'sacavem': 82,
  'maracana': 70,
  'centro-historico': 68,
  'tirirical': 64,
  'bequimao': 61,
  'vinhais': 59,
  'forquilha': 58,
  'monte-castelo': 55,
  'planalto-anil': 55,
  'joao-paulo': 52,
  'anil': 52,
  'sao-francisco': 48,
  'bom-jesus': 48,
  'alemanha': 47,
  'cohama': 46,
  'vila-nova': 44,
  'sa-viana': 43,
  'bairro-de-fatima': 42,
  'angelim': 41,
  'tibiri': 41,
  'fumace-tamancao': 38,
  'vila-esperanca': 37,
  'caratatiua': 36,
  'madre-deus': 36,
  'maranhao-novo': 32,
  'camboa': 28,
  'quebra-pote': 26,
  'ipase': 25,
  'calhau': 22,
  'renascenca': 19,
  'distrito-industrial': 15,
  'olho-dagua': 14,
  'ponta-dareia': 12,
  'porto-do-itaqui': 8
};

function generateInitialSummary(semana: string, dataReferencia: string): WeeklyDataSummary {
  const bairros: Record<string, BairroEpidemiology> = {};
  let totalCasos = 0;
  let totalPopulacao = 0;
  let bairrosEmRiscoAlto = 0;

  SAO_LUIS_BAIRROS_GEOJSON.features.forEach((feature) => {
    const p = feature.properties;
    const id = p.id || normalizeKey(p.NM_BAIRRO || p.name || '');
    const bairroNome = p.NM_BAIRRO || p.name || 'Bairro';
    const normTarget = normalizeKey(bairroNome);
    const officialBairro = (bairroDistritosData.bairros as Record<string, any>)[bairroNome.toUpperCase()] ||
      Object.values(bairroDistritosData.bairros).find((b: any) => normalizeKey(b.nome) === normTarget);

    const populacao = officialBairro?.populacao ?? (Number(p.POPULACAO) || 25000);
    const casos = CASOS_EXEMPLO[id] ?? Math.round(populacao * 0.002);
    
    // Incidência calculada rigorosamente usando a população oficial do bairro
    const incidencia = populacao > 0 ? Math.round(((casos / populacao) * 100000) * 10) / 10 : 0;
    const nivelRisco = calculateRiskLevel(incidencia);

    const rawDist = officialBairro?.distrito ?? (p.layer || p.Layer || p.distrito || 'DISTRITO 1 - CENTRO');
    const distritoSanitario = getCanonicalDistrictName(rawDist);

    const item: BairroEpidemiology = {
      id,
      bairroNome,
      distritoSanitario,
      populacao,
      casos,
      incidencia,
      nivelRisco,
      dataAtualizacao: new Date().toLocaleDateString('pt-BR')
    };

    bairros[id] = item;
    const normKey = normalizeKey(bairroNome);
    if (normKey) {
      bairros[normKey] = item;
    }
    if (p.NM_BAIRRO && normalizeKey(p.NM_BAIRRO)) {
      bairros[normalizeKey(p.NM_BAIRRO)] = item;
    }
    if (p.name && normalizeKey(p.name)) {
      bairros[normalizeKey(p.name)] = item;
    }

    totalCasos += casos;
    totalPopulacao += populacao;
    if (nivelRisco === 'alto' || nivelRisco === 'muito_alto') {
      bairrosEmRiscoAlto += 1;
    }
  });

  const incidenciaMedia = totalPopulacao > 0 
    ? Math.round(((totalCasos / totalPopulacao) * 100000) * 10) / 10 
    : 0;

  return {
    semana,
    dataReferencia,
    totalCasos,
    totalPopulacao,
    incidenciaMedia,
    bairrosEmRiscoAlto,
    bairrosTotal: Object.keys(bairros).length,
    bairros
  };
}

export const INITIAL_EPIDEMIOLOGY_DATA: Record<string, WeeklyDataSummary> = {
  'SE 14': generateInitialSummary('SE 14', '01/04/2026 a 07/04/2026'),
  'SE 13': generateInitialSummary('SE 13', '25/03/2026 a 31/03/2026'),
  'SE 12': generateInitialSummary('SE 12', '18/03/2026 a 24/03/2026')
};
