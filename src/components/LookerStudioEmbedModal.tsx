import React, { useState } from 'react';
import { BasemapTheme, ChoroplethMetric, MapViewLevel } from '../types/dengue';
import { 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  LayoutDashboard, 
  Sparkles, 
  X 
} from 'lucide-react';

interface LookerStudioEmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSheetUrl?: string;
  initialBairroColumn?: string;
  initialCasosColumn?: string;
  selectedWeek: string;
  availableWeeks: string[];
  filterDistrito: string;
  distritosList: string[];
  viewLevel: MapViewLevel;
  defaultMetric: ChoroplethMetric;
  defaultBasemap: BasemapTheme;
  isCustomGeoJsonLoaded?: boolean;
  initialGeoJsonUrl?: string;
}

export const LookerStudioEmbedModal: React.FC<LookerStudioEmbedModalProps> = ({
  isOpen,
  onClose,
  currentSheetUrl,
  initialBairroColumn = '',
  initialCasosColumn = '',
  selectedWeek,
  availableWeeks,
  filterDistrito,
  distritosList,
  viewLevel,
  defaultMetric,
  defaultBasemap,
  isCustomGeoJsonLoaded = false,
  initialGeoJsonUrl = ''
}) => {
  const [copied, setCopied] = useState(false);
  const [embedMode, setEmbedMode] = useState(true);
  const [week, setWeek] = useState<string>(selectedWeek);
  const [includeWeek, setIncludeWeek] = useState<boolean>(false);
  const [metric, setMetric] = useState<ChoroplethMetric>(defaultMetric);
  const [theme, setTheme] = useState<BasemapTheme>(defaultBasemap);
  const [view, setView] = useState<MapViewLevel>(viewLevel);
  const [distrito, setDistrito] = useState<string>(filterDistrito || 'all');
  const [refreshInterval, setRefreshInterval] = useState(300);
  const [sheetUrl, setSheetUrl] = useState<string>(currentSheetUrl || '');
  const [bairroCol, setBairroCol] = useState<string>(initialBairroColumn || '');
  const [casosCol, setCasosCol] = useState<string>(initialCasosColumn || '');
  const [geoJsonUrl, setGeoJsonUrl] = useState<string>(initialGeoJsonUrl || '');

  if (!isOpen) return null;

  // Gerar a URL completa com parâmetros de consulta para incorporação
  const baseUrl = window.location.origin + window.location.pathname;
  const params = new URLSearchParams();
  
  if (embedMode) params.set('embed', 'true');
  if (sheetUrl && sheetUrl.trim()) params.set('sheet', sheetUrl.trim());
  if (bairroCol && bairroCol.trim()) params.set('col_bairro', bairroCol.trim());
  if (casosCol && casosCol.trim()) params.set('col_casos', casosCol.trim());
  if (includeWeek && week) params.set('week', week);
  if (view && view !== 'bairro') params.set('view', view);
  if (distrito && distrito !== 'all') params.set('distrito', distrito);
  if (theme && theme !== 'osm') params.set('theme', theme);
  params.set('metric', metric);
  if (refreshInterval > 0 && refreshInterval !== 300) {
    params.set('refresh', String(refreshInterval));
  }
  if (geoJsonUrl && geoJsonUrl.trim()) {
    params.set('geojson', geoJsonUrl.trim());
  }

  const generatedEmbedUrl = `${baseUrl}?${params.toString()}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedEmbedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Incorporação no Google Looker Studio</h2>
              <p className="text-xs text-slate-400">Mapa direto em tela cheia com filtros minimizados</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Instruções Looker Studio */}
          <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-blue-300">
              <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span>Como incorporar no Looker Studio (Google Data Studio):</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
              <li>No Looker Studio, vá em <strong>Inserir &gt; Incorporação por URL</strong>.</li>
              <li>Desenhe o quadro onde deseja que o mapa seja exibido.</li>
              <li>No painel direito <strong>Propriedades de incorporação de URL</strong>, cole o link abaixo.</li>
              <li>O mapa será exibido <strong>sem o cabeçalho superior</strong>, ocupando 100% da área do quadro com os <strong>filtros minimizados</strong> acessíveis.</li>
            </ol>
          </div>

          {/* Configurações dos Casos e Filtros */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Configurações do Mapa e dos Casos Prováveis
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Semana Epidemiológica */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 font-medium text-xs">Semana Epidemiológica</label>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeWeek}
                      onChange={(e) => setIncludeWeek(e.target.checked)}
                      className="rounded text-blue-500 focus:ring-blue-400 bg-slate-950 border-slate-700"
                    />
                    <span>Fixar semana na URL</span>
                  </label>
                </div>
                {includeWeek ? (
                  <select
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                  >
                    {availableWeeks.map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-emerald-400 text-xs flex items-center justify-between">
                    <span>Sem seleção fixa (Sempre a mais recente)</span>
                    <span className="text-[10px] text-slate-400">Dinâmica</span>
                  </div>
                )}
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {includeWeek ? 'A URL abrirá sempre travada nesta semana selecionada.' : 'Sem o parâmetro ?week=, o Looker Studio sempre exibirá a semana epidemiológica mais atualizada.'}
                </span>
              </div>

              {/* Nível de Visualização */}
              <div>
                <label className="block text-slate-400 font-medium mb-1">Visualização Inicial</label>
                <select
                  value={view}
                  onChange={(e) => setView(e.target.value as MapViewLevel)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                >
                  <option value="bairro">Visão por Bairros (Padrão)</option>
                  <option value="distrito">Visão por Distrito Sanitário</option>
                </select>
              </div>

              {/* Filtro de Distrito */}
              <div>
                <label className="block text-slate-400 font-medium mb-1">Filtro de Distrito Sanitário</label>
                <select
                  value={distrito}
                  onChange={(e) => setDistrito(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                >
                  <option value="all">Todos os Distritos</option>
                  {distritosList.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Tema do Mapa Base */}
              <div>
                <label className="block text-slate-400 font-medium mb-1">Tema do Mapa Base</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as BasemapTheme)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                >
                  <option value="osm">OpenStreetMap</option>
                  <option value="satellite">Satélite Híbrido</option>
                </select>
              </div>

              {/* Métrica */}
              <div>
                <label className="block text-slate-400 font-medium mb-1">Métrica Epidemiológica</label>
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as ChoroplethMetric)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                >
                  <option value="incidencia">Taxa de Incidência (por 100 mil hab.)</option>
                  <option value="casos">Número de Casos Prováveis</option>
                </select>
              </div>

              {/* Atualização Automática */}
              <div>
                <label className="block text-slate-400 font-medium mb-1">Atualização Automática</label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                >
                  <option value={300}>A cada 5 minutos (Recomendado)</option>
                  <option value={60}>A cada 1 minuto</option>
                  <option value={900}>A cada 15 minutos</option>
                  <option value={0}>Apenas ao carregar</option>
                </select>
              </div>
            </div>

            {/* URL da Planilha Google */}
            <div>
              <label className="block text-slate-400 font-medium mb-1 text-xs">
                Link da Planilha do Google (Dados dos Casos)
              </label>
              <input
                type="text"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/... (opcional)"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Se preenchido, os casos prováveis serão lidos automaticamente desta planilha no Looker Studio.
              </span>
            </div>

            {/* Colunas Personalizadas da Planilha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1 text-xs">
                  Coluna de Bairro (Opcional)
                </label>
                <input
                  type="text"
                  value={bairroCol}
                  onChange={(e) => setBairroCol(e.target.value)}
                  placeholder="Ex: NM_BAIRRO ou Bairro"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1 text-xs">
                  Coluna de Casos (Opcional)
                </label>
                <input
                  type="text"
                  value={casosCol}
                  onChange={(e) => setCasosCol(e.target.value)}
                  placeholder="Ex: N_CASOS ou Casos"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none"
                />
              </div>
            </div>

            {/* URL do GeoJSON Personalizado */}
            <div>
              <label className="block text-slate-400 font-medium mb-1 text-xs flex items-center justify-between">
                <span>URL do GeoJSON Personalizado dos Bairros (Opcional)</span>
                {isCustomGeoJsonLoaded && (
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    ✓ GeoJSON personalizado ativo nesta sessão
                  </span>
                )}
              </label>
              <input
                type="text"
                value={geoJsonUrl}
                onChange={(e) => setGeoJsonUrl(e.target.value)}
                placeholder="Ex: https://raw.githubusercontent.com/.../bairros.geojson ou ./geojson/bairros_limpos.geojson"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Ao indicar um link público de GeoJSON (ex: GitHub raw, gist ou arquivo na pasta public), o Looker Studio carregará esses bairros mapeados automaticamente.
              </span>
            </div>

            {/* Checkbox Modo Embed */}
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-xs">
                <input
                  type="checkbox"
                  checked={embedMode}
                  onChange={(e) => setEmbedMode(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 bg-slate-950 border-slate-700"
                />
                <span className="font-medium">
                  Modo Somente Mapa (Oculta o cabeçalho e mantém os filtros minimizados flutuantes)
                </span>
              </label>
            </div>
          </div>

          {/* Caixa com a URL Gerada */}
          <div className="pt-2 border-t border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              URL Gerada para Colar no Looker Studio:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatedEmbedUrl}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-mono text-[11px] text-sky-300 focus:outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold text-xs transition shadow-md flex-shrink-0"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar URL</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className="flex items-center justify-between text-xs pt-1">
            <a
              href={generatedEmbedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Testar pré-visualização em nova aba</span>
            </a>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-950/40 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
