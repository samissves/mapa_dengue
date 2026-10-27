import { RiskLevel } from '../types/dengue';

/**
 * Normaliza strings para busca e correspondência robusta entre planilha e GeoJSON
 */
export function normalizeKey(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]/g, '') // remove pontuações, espaços e hífens
    .trim();
}

export function calculateRiskLevel(incidencia: number): RiskLevel {
  if (incidencia >= 500) return 'muito_alto';
  if (incidencia >= 300) return 'alto';
  if (incidencia >= 100) return 'medio';
  return 'baixo';
}

export const CANONICAL_DISTRICTS: Record<string, string> = {
  'distrito1centro': 'DISTRITO 1 - CENTRO',
  'distrito2itaquibacanga': 'DISTRITO 2 - ITAQUI-BACANGA',
  'distrito3coroadinho': 'DISTRITO 3 - COROADINHO',
  'distrito4cohab': 'DISTRITO 4 - COHAB',
  'distrito5bequimao': 'DISTRITO 5 - BEQUIMÃO',
  'distrito6tirirical': 'DISTRITO 6 - TIRIRICAL',
  'distrito7vilaesperanca': 'DISTRITO 7 - VILA ESPERANÇA',
  'distrito8saofrancisco': 'DISTRITO 8 - SÃO FRANCISCO',
  'distrito9cidadeoperaria': 'DISTRITO 9 - CIDADE OPERÁRIA'
};

export function getCanonicalDistrictName(name: string): string {
  if (!name) return 'DISTRITO 1 - CENTRO';
  const norm = normalizeKey(name);
  if (CANONICAL_DISTRICTS[norm]) {
    return CANONICAL_DISTRICTS[norm];
  }
  if (norm === 'saoluis' || norm === 'municipiodesaoluis' || norm === 'cidadedesaoluis' || norm.startsWith('saoluis')) {
    return 'DISTRITO 1 - CENTRO';
  }
  for (const [normKey, canonical] of Object.entries(CANONICAL_DISTRICTS)) {
    if (norm.includes(normKey) || normKey.includes(norm)) {
      return canonical;
    }
  }
  return name.trim();
}
