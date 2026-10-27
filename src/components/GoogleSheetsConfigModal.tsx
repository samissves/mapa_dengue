import React, { useState, useEffect } from 'react';
import { SheetsConfig } from '../types/dengue';
import { 
  generateGoogleSheetsCsvTemplate,
  fetchSheetColumns,
  normalizeKey
} from '../services/sheetsService';
import { 
  CheckCircle2, 
  Copy, 
  Download, 
  FileSpreadsheet, 
  HelpCircle, 
  Loader2, 
  RefreshCw, 
  Sparkles, 
  X, 
  AlertCircle,
  Columns
} from 'lucide-react';

interface GoogleSheetsConfigModalProps {
  config: SheetsConfig;
  isOpen: boolean;
  onClose: () => void;
  onSaveConfig: (newConfig: SheetsConfig) => Promise<void>;
  onResetToDemo: () => void;
  isLoading: boolean;
  error: string | null;
}

export const GoogleSheetsConfigModal: React.FC<GoogleSheetsConfigModalProps> = ({
  config,
  isOpen,
  onClose,
  onSaveConfig,
  onResetToDemo,
  isLoading,
  error
}) => {
  const [url, setUrl] = useState(config.url || '');
  const [sheetName, setSheetName] = useState(config.sheetName || '');
  const [bairroColumn, setBairroColumn] = useState(config.bairroColumn || '');
  const [casosColumn, setCasosColumn] = useState(config.casosColumn || '');
  const [refreshInterval, setRefreshInterval] = useState(config.autoRefreshIntervalSeconds);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'guide'>('config');

  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);
  const [columnsMessage, setColumnsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl(config.url || '');
      setSheetName(config.sheetName || '');
      setBairroColumn(config.bairroColumn || '');
      setCasosColumn(config.casosColumn || '');
      setRefreshInterval(config.autoRefreshIntervalSeconds ?? 300);
      setColumnsMessage(null);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleLoadColumns = async () => {
    if (!url.trim()) {
      setColumnsMessage({
        type: 'error',
        text: 'Insira o link da planilha antes de carregar as colunas.'
      });
      return;
    }

    setIsLoadingColumns(true);
    setColumnsMessage(null);

    try {
      const cols = await fetchSheetColumns(url.trim(), sheetName.trim() || undefined);
      setAvailableColumns(cols);

      // Auto-preenchimento inteligente se os campos estiverem em branco
      if (!bairroColumn.trim()) {
        const foundBairro = cols.find(c => {
          const norm = normalizeKey(c);
          return norm === 'nmbairroprox' || norm === 'nmbairro' || norm === 'bairro' || norm === 'nomedobairro' || norm === 'nome';
        });
        if (foundBairro) setBairroColumn(foundBairro);
      }

      if (!casosColumn.trim()) {
        const foundCasos = cols.find(c => {
          const norm = normalizeKey(c);
          return norm === 'ncasos' || norm === 'numerodecasos' || norm === 'casos' || norm === 'totalcasos' || norm === 'casosprovaveis';
        });
        if (foundCasos) setCasosColumn(foundCasos);
      }

      setColumnsMessage({
        type: 'success',
        text: `${cols.length} coluna(s) carregada(s) com sucesso da página selecionada!`
      });
    } catch (err: any) {
      setColumnsMessage({
        type: 'error',
        text: err.message || 'Erro ao ler colunas da planilha.'
      });
    } finally {
      setIsLoadingColumns(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveConfig({
      url: url.trim(),
      sheetName: sheetName.trim() || undefined,
      bairroColumn: bairroColumn.trim() || undefined,
      casosColumn: casosColumn.trim() || undefined,
      autoRefreshIntervalSeconds: Number(refreshInterval),
      sourceType: url.trim() ? 'google_sheets' : 'local_demo',
      lastFetchedAt: new Date().toISOString()
    });
  };

  const handleReset = () => {
    setUrl('');
    setSheetName('');
    setBairroColumn('');
    setCasosColumn('');
    setAvailableColumns([]);
    setColumnsMessage(null);
    onResetToDemo();
  };

  const handleDownloadTemplate = () => {
    const csvContent = generateGoogleSheetsCsvTemplate();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'modelo_dengue_sao_luis.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyCsvStructure = () => {
    const csvContent = generateGoogleSheetsCsvTemplate();
    navigator.clipboard.writeText(csvContent);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Conexão com Google Planilhas</h2>
              <p className="text-xs text-slate-400">Atualização semanal dinâmica para GitHub Pages e Looker Studio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/20">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'config'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Configuração da Planilha
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'guide'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Como Publicar sua Planilha (Passo a Passo)
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Erro ao carregar planilha:</p>
                <p className="text-rose-200/90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {activeTab === 'config' ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Link Compartilhado ou Link Publicado do Google Planilhas
                </label>
                <input
                  type="text"
                  placeholder="Cole aqui o link da planilha (/edit ou /pub?output=csv)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-xs text-white placeholder:text-slate-500 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Certifique-se de que a planilha está marcada como pública ("Qualquer pessoa com o link pode ver" ou "Publicar na Web"). Você também pode definir o link, aba e colunas padrão editando o arquivo <code className="text-rose-300 font-mono">config.json</code> no repositório.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Nome da Aba (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Dados, Resumo ou Folha1"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-xs text-white placeholder:text-slate-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Atualização Automática (Polling)
                  </label>
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-xs text-white transition"
                  >
                    <option value={0}>Apenas ao recarregar a página</option>
                    <option value={60}>A cada 1 minuto (Tempo real)</option>
                    <option value={300}>A cada 5 minutos (Recomendado)</option>
                    <option value={900}>A cada 15 minutos</option>
                    <option value={3600}>A cada 1 hora</option>
                  </select>
                </div>
              </div>

              {/* Mapeamento de Colunas (Texto ou Carregamento da Planilha) */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Columns className="w-3.5 h-3.5 text-rose-400" />
                      Mapeamento das Colunas da Planilha
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Informe os nomes das colunas ou carregue automaticamente da página selecionada
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleLoadColumns}
                    disabled={isLoadingColumns || !url.trim()}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs text-rose-300 border border-slate-700/80 hover:border-rose-500/50 disabled:opacity-50 transition cursor-pointer"
                  >
                    {isLoadingColumns ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Carregando colunas...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                        <span>Carregar Colunas da Página</span>
                      </>
                    )}
                  </button>
                </div>

                {columnsMessage && (
                  <div
                    className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 border ${
                      columnsMessage.type === 'success'
                        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {columnsMessage.type === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
                    )}
                    <span>{columnsMessage.text}</span>
                  </div>
                )}

                {availableColumns.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                      Colunas detectadas ({availableColumns.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-slate-900/80 rounded-lg border border-slate-800">
                      {availableColumns.map((col) => (
                        <span
                          key={col}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 border border-slate-700 text-slate-200"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Coluna do Nome do Bairro */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-300">
                        Coluna do Nome do Bairro
                      </label>
                      {bairroColumn && (
                        <button
                          type="button"
                          onClick={() => setBairroColumn('')}
                          className="text-[10px] text-slate-400 hover:text-rose-400"
                        >
                          Limpar (automático)
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        list="bairro-columns-list"
                        placeholder="Padrão: NM_BAIRRO"
                        value={bairroColumn}
                        onChange={(e) => setBairroColumn(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-xs text-white placeholder:text-slate-500 transition font-mono"
                      />
                      <datalist id="bairro-columns-list">
                        {availableColumns.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>

                    {availableColumns.length > 0 && (
                      <div className="mt-1.5">
                        <select
                          value={bairroColumn}
                          onChange={(e) => setBairroColumn(e.target.value)}
                          className="w-full text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 focus:border-rose-500 focus:outline-none"
                        >
                          <option value="">-- Selecione das colunas da página --</option>
                          {availableColumns.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-500 mt-1">
                      Ex: <code className="text-slate-400">NM_BAIRRO</code>, <code className="text-slate-400">Bairro</code> ou <code className="text-slate-400">Nome</code>
                    </p>
                  </div>

                  {/* Coluna de Número de Casos */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-300">
                        Coluna de Casos (Prováveis)
                      </label>
                      {casosColumn && (
                        <button
                          type="button"
                          onClick={() => setCasosColumn('')}
                          className="text-[10px] text-slate-400 hover:text-rose-400"
                        >
                          Limpar (automático)
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        list="casos-columns-list"
                        placeholder="Padrão: N_CASOS"
                        value={casosColumn}
                        onChange={(e) => setCasosColumn(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-xs text-white placeholder:text-slate-500 transition font-mono"
                      />
                      <datalist id="casos-columns-list">
                        {availableColumns.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>

                    {availableColumns.length > 0 && (
                      <div className="mt-1.5">
                        <select
                          value={casosColumn}
                          onChange={(e) => setCasosColumn(e.target.value)}
                          className="w-full text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 focus:border-rose-500 focus:outline-none"
                        >
                          <option value="">-- Selecione das colunas da página --</option>
                          {availableColumns.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-500 mt-1">
                      Ex: <code className="text-slate-400">N_CASOS</code>, <code className="text-slate-400">Casos</code> ou <code className="text-slate-400">Total</code>
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Atual */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Origem dos Dados Atual:</span>
                  <span className="font-semibold text-white">
                    {config.sourceType === 'google_sheets' ? 'Planilha Ativa' : 'Dados Modelo São Luís (Demonstração)'}
                  </span>
                </div>
                {(config.bairroColumn || config.casosColumn) && (
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Colunas Configuradas:</span>
                    <span className="text-rose-400 font-mono">
                      Bairro: {config.bairroColumn || 'Auto'} | Casos: {config.casosColumn || 'Auto'}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Cálculo de Incidência:</span>
                  <span className="text-emerald-400 font-medium">
                    Automático (População Oficial do Bairro)
                  </span>
                </div>
                {config.lastFetchedAt && (
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Última Sincronização:</span>
                    <span className="text-slate-300 font-mono text-[11px]">
                      {new Date(config.lastFetchedAt).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-rose-950/50 transition cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Conectando e Processando...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Salvar e Sincronizar Dados</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isLoading}
                  className="py-2.5 px-3.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                >
                  Restaurar Demonstração
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                    1
                  </span>
                  <div>
                    <h4 className="font-semibold text-white">Estrutura e Nomes das Colunas</h4>
                    <p className="text-slate-400 mt-0.5 text-[11px]">
                      Sua planilha do Google precisa apenas de colunas identificando o bairro e a quantidade de casos:
                    </p>
                    <div className="mt-2 p-2 rounded-lg bg-slate-950 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                      NM_BAIRRO | N_CASOS
                    </div>
                    <p className="text-slate-400 mt-1.5 text-[10px]">
                      💡 <strong>Colunas flexíveis:</strong> Se suas colunas tiverem outros nomes (ex: <em>Bairro</em>, <em>Casos Confirmados</em>, <em>Total</em>), você pode digitá-las ou clicar em <strong>"Carregar Colunas da Página"</strong> na aba de configuração para selecioná-las diretamente!
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                    2
                  </span>
                  <div>
                    <h4 className="font-semibold text-white">Como Compartilhar</h4>
                    <p className="text-slate-400 mt-0.5 text-[11px]">
                      No Google Planilhas, acerte o acesso:
                    </p>
                    <p className="mt-1 text-[11px] text-slate-300">
                      <strong>Opção A (Mais fácil):</strong> Clique no botão azul <strong>Compartilhar</strong> &gt; em "Acesso geral", mude para <strong>Qualquer pessoa com o link</strong> (Leitor).
                    </p>
                    <p className="mt-1 text-[11px] text-slate-300">
                      <strong>Opção B (Mais rápida):</strong> Clique no menu <strong>Arquivo &gt; Compartilhar &gt; Publicar na Web</strong> &gt; Escolha "Valores separados por vírgula (.csv)" e clique em <strong>Publicar</strong>.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                    3
                  </span>
                  <div>
                    <h4 className="font-semibold text-white">Cole o Link neste App</h4>
                    <p className="text-slate-400 mt-0.5 text-[11px]">
                      Cole o link copiado na aba "Configuração da Planilha". Toda vez que sua equipe epidemiológica adicionar novas semanas ou números na planilha, os gráficos e o mapa se atualizarão automaticamente!
                    </p>
                  </div>
                </div>
              </div>

              {/* Botões do modelo */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs border border-slate-700 transition"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Baixar Modelo CSV de São Luís</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyCsvStructure}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-200 text-xs transition"
                >
                  {copiedTemplate ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-400" />
                      <span>Copiar Cabeçalhos</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
