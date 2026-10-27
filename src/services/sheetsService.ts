import Papa from 'papaparse';
import { SAO_LUIS_BAIRROS_GEOJSON } from '../data/saoLuisGeoJson';
import bairroDistritosData from '../data/bairroDistritosArrumado.json';
import { BairroEpidemiology, DistrictEpidemiology, GeoJsonNeighborhoodCollection, WeeklyDataSummary } from '../types/dengue';
import { 
  normalizeKey, 
  calculateRiskLevel, 
  CANONICAL_DISTRICTS, 
  getCanonicalDistrictName 
} from '../utils/districtNames';

export { 
  normalizeKey, 
  calculateRiskLevel, 
  CANONICAL_DISTRICTS, 
  getCanonicalDistrictName 
};

/**
 * Retorna a população oficial do distrito a partir de dados/bairro_distritos_arrumado.xlsx
 */
export function getOfficialDistrictPopulation(distritoNome: string): number {
  if (!distritoNome) return 0;
  const normTarget = normalizeKey(distritoNome);
  
  for (const [key, val] of Object.entries(bairroDistritosData.distritos)) {
    if (normalizeKey(key) === normTarget || normalizeKey(val.nomeOficial) === normTarget) {
      return val.populacao;
    }
  }
  return 0;
}

/**
 * Retorna os dados oficiais do bairro a partir de dados/bairro_distritos_arrumado.xlsx
 */
export function getOfficialBairroInfo(bairroNome: string) {
  if (!bairroNome) return undefined;
  const normTarget = normalizeKey(bairroNome);
  
  for (const [key, val] of Object.entries(bairroDistritosData.bairros)) {
    if (normalizeKey(key) === normTarget || normalizeKey(val.nome) === normTarget) {
      return val;
    }
  }
  return undefined;
}

/**
 * Busca de alta precisão de dados do bairro por ID, ID de feature ou nome normalizado
 */
export function findBairroData(
  bairros: Record<string, BairroEpidemiology>,
  query: string
): BairroEpidemiology | undefined {
  if (!query || !bairros) return undefined;
  if (bairros[query]) return bairros[query];
  const norm = normalizeKey(query);
  if (!norm) return undefined;
  if (bairros[norm]) return bairros[norm];

  const values = Object.values(bairros);
  
  // 1. Correspondência exata por id ou nome normalizado
  const exact = values.find(b => 
    b.id === query || 
    normalizeKey(b.id) === norm || 
    normalizeKey(b.bairroNome) === norm
  );
  if (exact) return exact;

  // 2. Correspondência por inclusão controlada (mínimo de 3 caracteres)
  if (norm.length >= 3) {
    const contained = values.find(b => {
      const bNorm = normalizeKey(b.bairroNome);
      const idNorm = normalizeKey(b.id);
      return bNorm.includes(norm) || idNorm.includes(norm) || (bNorm.length >= 4 && norm.includes(bNorm));
    });
    if (contained) return contained;
  }

  return undefined;
}



/**
 * Busca de alta precisão de dados do distrito sanitário por nome ou chave normalizada
 */
export function findDistrictData(
  districts: Record<string, DistrictEpidemiology> | undefined,
  query: string | null | undefined
): DistrictEpidemiology | undefined {
  if (!districts || !query) return undefined;
  if (districts[query]) return districts[query];
  const norm = normalizeKey(query);
  if (!norm) return undefined;
  if (districts[norm]) return districts[norm];

  const canonical = getCanonicalDistrictName(query);
  if (districts[canonical]) return districts[canonical];

  for (const [key, val] of Object.entries(districts)) {
    if (normalizeKey(key) === norm || normalizeKey(val.distritoNome) === norm) {
      return val;
    }
  }

  // Busca por inclusão (mínimo de 4 caracteres)
  if (norm.length >= 4) {
    for (const [key, val] of Object.entries(districts)) {
      const kNorm = normalizeKey(key);
      const dNorm = normalizeKey(val.distritoNome);
      if (kNorm.includes(norm) || norm.includes(kNorm) || dNorm.includes(norm) || norm.includes(dNorm)) {
        return val;
      }
    }
  }

  return undefined;
}

/**
 * Agrega os dados epidemiológicos agrupando por Distrito Sanitário.
 * O cálculo da incidência do distrito utiliza rigorosamente a população oficial
 * extraída de dados/bairro_distritos_arrumado.xlsx.
 */
export function aggregateDistrictsData(
  bairrosData: Record<string, BairroEpidemiology>
): Record<string, DistrictEpidemiology> {
  const districts: Record<string, DistrictEpidemiology> = {};
  const seenBairros = new Set<string>();

  // 1. Inicializar todos os 9 distritos sanitários oficiais com seus nomes canônicos e população do Excel
  Object.values(bairroDistritosData.distritos).forEach((d) => {
    const canonicalName = getCanonicalDistrictName(d.nomeOficial);
    districts[canonicalName] = {
      distritoNome: canonicalName,
      totalCasos: 0,
      totalPopulacao: d.populacao,
      incidencia: 0,
      nivelRisco: 'baixo',
      bairrosCount: 0,
      bairros: []
    };
  });

  // 2. Distribuir os casos e bairros em seus respectivos distritos
  Object.values(bairrosData).forEach((b) => {
    // Evita duplicar bairros registrados sob chaves redundantes
    if (seenBairros.has(b.id)) return;
    seenBairros.add(b.id);

    const distRaw = b.distritoSanitario || 'DISTRITO 1 - CENTRO';
    const canonicalDistName = getCanonicalDistrictName(distRaw);
    
    // Localizar o distrito correspondente no mapa
    let target = districts[canonicalDistName];
    if (!target) {
      const normDist = normalizeKey(distRaw);
      const matchedKey = Object.keys(districts).find(k => normalizeKey(k) === normDist);
      if (matchedKey) {
        target = districts[matchedKey];
      } else {
        const offPop = getOfficialDistrictPopulation(canonicalDistName);
        target = {
          distritoNome: canonicalDistName,
          totalCasos: 0,
          totalPopulacao: offPop > 0 ? offPop : b.populacao,
          incidencia: 0,
          nivelRisco: 'baixo',
          bairrosCount: 0,
          bairros: []
        };
        districts[canonicalDistName] = target;
      }
    }

    target.totalCasos += b.casos;
    target.bairrosCount += 1;
    target.bairros.push(b);
  });

  // 3. Calcular a incidência rigorosa por 100.000 habitantes baseada na população oficial do Excel
  // e indexar aliases (com/sem acento e normalizado) para compatibilidade 100% de lookup
  const result: Record<string, DistrictEpidemiology> = {};

  Object.values(districts).forEach((d) => {
    // Garante que a população venha do arquivo bairro_distritos_arrumado.xlsx
    const officialPop = getOfficialDistrictPopulation(d.distritoNome);
    if (officialPop > 0) {
      d.totalPopulacao = officialPop;
    }

    d.incidencia = d.totalPopulacao > 0
      ? Math.round(((d.totalCasos / d.totalPopulacao) * 100000) * 10) / 10
      : 0;
    d.nivelRisco = calculateRiskLevel(d.incidencia);
    d.bairros.sort((a, b) => b.casos - a.casos);

    // 1. Chave Canônica (ex: "DISTRITO 5 - BEQUIMÃO")
    result[d.distritoNome] = d;

    // 2. Chave Normalizada (ex: "distrito5bequimao")
    const normKey = normalizeKey(d.distritoNome);
    if (normKey) result[normKey] = d;

    // 3. Chave Desacentuada com hífens (ex: "DISTRITO 5 - BEQUIMAO")
    const unaccented = d.distritoNome.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (unaccented !== d.distritoNome) {
      result[unaccented] = d;
    }
  });

  return result;
}

/**
 * Converte qualquer formato comum de link do Google Planilhas em um endpoint CSV direto
 */
export function convertGoogleSheetsUrlToCsvUrl(url: string, sheetName?: string): string {
  const trimmed = url.trim();

  if (trimmed.endsWith('.csv') || trimmed.includes('output=csv') || trimmed.includes('format=csv')) {
    let finalUrl = trimmed;
    if (sheetName && !trimmed.includes('sheet=') && !trimmed.includes('gid=')) {
      const sep = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${sep}sheet=${encodeURIComponent(sheetName)}`;
    }
    const separator = finalUrl.includes('?') ? '&' : '?';
    return `${finalUrl}${separator}_cacheBuster=${Date.now()}`;
  }

  if (trimmed.includes('/pubhtml')) {
    let csvUrl = trimmed.replace('/pubhtml', '/pub?output=csv');
    if (sheetName && !trimmed.includes('sheet=')) {
      csvUrl = `${csvUrl}&sheet=${encodeURIComponent(sheetName)}`;
    }
    return `${csvUrl}&_cacheBuster=${Date.now()}`;
  }

  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    const sheetId = match[1];
    const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : '0';

    if (sheetName) {
      return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&_cacheBuster=${Date.now()}`;
    }

    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}&_cacheBuster=${Date.now()}`;
  }

  return `${trimmed}${trimmed.includes('?') ? '&' : '?'}t=${Date.now()}`;
}

function parseBrazilianNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim();
  const clean = str.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function extractPopulationMap(geoJson?: GeoJsonNeighborhoodCollection): Map<string, { populacao: number; distrito: string; officialName: string; featId: string }> {
  const map = new Map<string, { populacao: number; distrito: string; officialName: string; featId: string }>();
  const dataset = geoJson || SAO_LUIS_BAIRROS_GEOJSON;

  dataset.features.forEach((feat) => {
    const p = feat.properties;
    const officialName = p.NM_BAIRRO || p.name || 'Bairro';
    const officialInfo = getOfficialBairroInfo(officialName);
    const populacao = officialInfo?.populacao ?? (Number(p.POPULACAO || p.populacao || p.POP) || 25000);
    const rawDist = officialInfo?.distrito ?? (p.layer || p.Layer || p.LAYER || p.distrito || p.NM_DISTRIT || 'DISTRITO 1 - CENTRO');
    const distrito = getCanonicalDistrictName(rawDist);
    const featId = p.id || normalizeKey(officialName);

    const keyName = normalizeKey(officialName);
    const keyId = normalizeKey(featId);

    const data = { populacao, distrito, officialName, featId };
    if (keyName) map.set(keyName, data);
    if (keyId) map.set(keyId, data);
  });

  return map;
}

/**
 * Conecta à planilha do Google / CSV e carrega a lista de nomes das colunas da página selecionada
 */
export async function fetchSheetColumns(
  rawUrl: string,
  sheetName?: string
): Promise<string[]> {
  if (!rawUrl || !rawUrl.trim()) {
    throw new Error('Por favor, insira o link do Google Planilhas primeiro.');
  }

  const csvUrl = convertGoogleSheetsUrlToCsvUrl(rawUrl, sheetName);

  const response = await fetch(csvUrl, {
    headers: {
      'Accept': 'text/csv,text/plain,*/*'
    }
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao conectar à planilha (HTTP ${response.status}: ${response.statusText}). Verifique se a planilha está com acesso público ("Qualquer pessoa com o link" ou "Publicar na Web") e se o nome da aba está correto.`
    );
  }

  const csvText = await response.text();
  if (!csvText || !csvText.trim()) {
    throw new Error('A planilha retornou vazia.');
  }

  const parsed = Papa.parse<Record<string, any>>(csvText, {
    header: true,
    preview: 3,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim()
  });

  let fields: string[] = [];
  if (parsed.meta && Array.isArray(parsed.meta.fields) && parsed.meta.fields.length > 0) {
    fields = parsed.meta.fields;
  } else if (parsed.data && parsed.data.length > 0) {
    fields = Object.keys(parsed.data[0]);
  }

  const cleaned = fields.filter(f => typeof f === 'string' && f.trim() !== '');
  if (cleaned.length === 0) {
    throw new Error('Não foi possível identificar o cabeçalho das colunas nesta página da planilha.');
  }

  return cleaned;
}

export async function fetchEpidemiologyFromGoogleSheets(
  rawUrl: string,
  sheetName?: string,
  geoJson?: GeoJsonNeighborhoodCollection,
  customColumns?: { bairroColumn?: string; casosColumn?: string }
): Promise<{
  weeks: Record<string, WeeklyDataSummary>;
  activeWeek: string;
  rowCount: number;
}> {
  const csvUrl = convertGoogleSheetsUrlToCsvUrl(rawUrl, sheetName);

  const response = await fetch(csvUrl, {
    headers: {
      'Accept': 'text/csv,text/plain,*/*'
    }
  });

  if (!response.ok) {
    throw new Error(`Falha ao acessar planilha (HTTP ${response.status}: ${response.statusText}). Verifique se a planilha está com acesso público ("Qualquer pessoa com o link pode ver" ou "Publicada na Web").`);
  }

  const csvText = await response.text();

  return parseEpidemiologyCsv(csvText, geoJson, customColumns);
}

export function parseEpidemiologyCsv(
  csvText: string,
  geoJson?: GeoJsonNeighborhoodCollection,
  customColumns?: { bairroColumn?: string; casosColumn?: string }
): {
  weeks: Record<string, WeeklyDataSummary>;
  activeWeek: string;
  rowCount: number;
} {
  const parsed = Papa.parse<Record<string, any>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim()
  });

  if (!parsed.data || parsed.data.length === 0) {
    throw new Error('A planilha está vazia ou os cabeçalhos não foram identificados.');
  }

  const popMap = extractPopulationMap(geoJson);
  const weeks: Record<string, WeeklyDataSummary> = {};
  let latestWeek = 'SE Atual';

  const sample = parsed.data[0];
  const keys = Object.keys(sample);

  const findKey = (candidates: string[]) => {
    return keys.find(k => {
      const norm = normalizeKey(k);
      return candidates.some(c => norm === normalizeKey(c) || norm.includes(normalizeKey(c)));
    });
  };

  const customColBairro = customColumns?.bairroColumn?.trim();
  const customColCasos = customColumns?.casosColumn?.trim();

  // Seleção por coluna informada pelo usuário ou detecção automática
  const colBairro = (customColBairro && keys.find(k => k === customColBairro || normalizeKey(k) === normalizeKey(customColBairro)))
    || findKey(['nm_bairro_prox', 'nmbairroprox', 'nm_bairro_corrigido', 'nmbairrocorrigido', 'nm_bairro', 'nmbairro', 'bairro', 'nome_do_bairro', 'nome']) 
    || keys[0] 
    || 'NM_BAIRRO_PROX';

  const colCasos = (customColCasos && keys.find(k => k === customColCasos || normalizeKey(k) === normalizeKey(customColCasos)))
    || findKey(['n_casos', 'ncasos', 'numero_de_casos', 'casos', 'casos_provaveis', 'total_casos']) 
    || keys[1] 
    || 'N_CASOS';

  const colSemana = findKey(['semana', 'semana_epidemiologica', 'se', 'periodo']);

  let validRowCount = 0;

  parsed.data.forEach((row) => {
    const rawBairro = row[colBairro];
    if (!rawBairro || String(rawBairro).trim() === '') return;

    validRowCount++;
    const bairroNomeInput = String(rawBairro).trim();
    const id = normalizeKey(bairroNomeInput);

    const semana = colSemana && row[colSemana] ? String(row[colSemana]).trim() : 'SE Atual';
    latestWeek = semana;

    const casos = parseBrazilianNumber(row[colCasos]);

    let geoInfo = popMap.get(id);
    if (!geoInfo && bairroNomeInput.includes('/')) {
      const parts = bairroNomeInput.split('/');
      for (const part of parts) {
        const pNorm = normalizeKey(part.trim());
        if (pNorm && popMap.get(pNorm)) {
          geoInfo = popMap.get(pNorm);
          break;
        }
      }
    }

    const officialBairro = getOfficialBairroInfo(bairroNomeInput) || (geoInfo?.officialName ? getOfficialBairroInfo(geoInfo.officialName) : undefined);
    const finalId = geoInfo?.featId || id;
    const populacao = officialBairro?.populacao ?? (geoInfo?.populacao ?? 25000);
    const rawDistSanitario = officialBairro?.distrito ?? (geoInfo?.distrito ?? 'DISTRITO 1 - CENTRO');
    const distritoSanitario = getCanonicalDistrictName(normalizeKey(rawDistSanitario) === 'sao luis' ? 'DISTRITO 1 - CENTRO' : rawDistSanitario);
    const bairroNome = officialBairro?.nome ?? (geoInfo?.officialName ?? bairroNomeInput);

    if (!weeks[semana]) {
      weeks[semana] = {
        semana,
        dataReferencia: new Date().toLocaleDateString('pt-BR'),
        totalCasos: 0,
        totalPopulacao: 0,
        incidenciaMedia: 0,
        bairrosEmRiscoAlto: 0,
        bairrosTotal: 0,
        bairros: {}
      };
    }

    const currentWeekObj = weeks[semana];
    const existing = currentWeekObj.bairros[finalId];
    const totalCasosBairro = (existing ? existing.casos : 0) + casos;

    // Incidência calculada rigorosamente por 100.000 habitantes baseada na população oficial do bairro do arquivo Excel
    const incidencia = populacao > 0 ? Math.round(((totalCasosBairro / populacao) * 100000) * 10) / 10 : 0;
    const nivelRisco = calculateRiskLevel(incidencia);

    const item: BairroEpidemiology = {
      id: finalId,
      bairroNome,
      distritoSanitario,
      populacao,
      casos: totalCasosBairro,
      incidencia,
      nivelRisco,
      dataAtualizacao: new Date().toLocaleDateString('pt-BR')
    };

    if (!existing) {
      currentWeekObj.totalPopulacao += populacao;
      currentWeekObj.bairrosTotal += 1;
    }
    currentWeekObj.totalCasos += casos;

    currentWeekObj.bairros[finalId] = item;
    currentWeekObj.bairros[id] = item;
  });

  // Atualizar métricas globais e contagem de risco alto
  Object.keys(weeks).forEach(sem => {
    const w = weeks[sem];
    const seenUniqueBairros = new Set<string>();
    let highRiskCount = 0;
    Object.values(w.bairros).forEach(b => {
      if (!seenUniqueBairros.has(b.id)) {
        seenUniqueBairros.add(b.id);
        if (b.nivelRisco === 'alto' || b.nivelRisco === 'muito_alto') {
          highRiskCount++;
        }
      }
    });
    w.bairrosEmRiscoAlto = highRiskCount;
    w.bairrosTotal = seenUniqueBairros.size;
    if (w.totalPopulacao > 0) {
      w.incidenciaMedia = Math.round(((w.totalCasos / w.totalPopulacao) * 100000) * 10) / 10;
    }
  });

  return {
    weeks,
    activeWeek: latestWeek,
    rowCount: validRowCount
  };
}

export function generateGoogleSheetsCsvTemplate(): string {
  const headers = ['NM_BAIRRO', 'N_CASOS'];

  const sampleRows = [
    ['Cidade Operária', '478'],
    ['Turu', '395'],
    ['Cohatrac', '320'],
    ['Cidade Olímpica', '228'],
    ['Coroadinho', '215'],
    ['Anjo da Guarda', '198'],
    ['Cohab Anil', '142'],
    ['Parque Vitória', '122'],
    ['Vila Embratel', '118'],
    ['São Cristóvão', '110'],
    ['Centro Histórico', '68'],
    ['Calhau', '22'],
    ['Renascença', '19']
  ];

  return [
    headers.join(','),
    ...sampleRows.map(r => r.join(','))
  ].join('\n');
}
