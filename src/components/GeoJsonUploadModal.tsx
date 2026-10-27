import React, { useState } from 'react';
import { GeoJsonNeighborhoodCollection } from '../types/dengue';
import { normalizeGeoJsonCollection } from '../utils/districtGeoJson';
import { 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  FileCode, 
  Globe, 
  MapPin, 
  RotateCcw, 
  UploadCloud, 
  X 
} from 'lucide-react';

interface GeoJsonUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGeoJson: GeoJsonNeighborhoodCollection;
  onUpdateGeoJson: (newGeoJson: GeoJsonNeighborhoodCollection, sourceUrl?: string) => void;
  onResetGeoJson: () => void;
  currentGeoJsonUrl?: string;
}

export const GeoJsonUploadModal: React.FC<GeoJsonUploadModalProps> = ({
  isOpen,
  onClose,
  currentGeoJson,
  onUpdateGeoJson,
  onResetGeoJson,
  currentGeoJsonUrl = ''
}) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [urlInput, setUrlInput] = useState(currentGeoJsonUrl);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const normalized = normalizeGeoJsonCollection(parsed);

        onUpdateGeoJson(normalized, '');
        setSuccess(`GeoJSON carregado com sucesso! ${normalized.features.length} bairros mapeados.`);
      } catch (err: any) {
        setError(err.message || 'Erro ao processar arquivo GeoJSON.');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setError('Erro ao ler arquivo.');
      setIsProcessing(false);
    };

    reader.readAsText(file);
  };

  const handleLoadFromUrl = async () => {
    if (!urlInput || !urlInput.trim()) {
      setError('Informe a URL do arquivo GeoJSON.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsProcessing(true);

    try {
      const trimmed = urlInput.trim();
      const response = await fetch(trimmed);
      if (!response.ok) {
        throw new Error(`Falha ao obter GeoJSON via URL (HTTP ${response.status}).`);
      }
      const data = await response.json();
      const normalized = normalizeGeoJsonCollection(data);

      onUpdateGeoJson(normalized, trimmed);
      setSuccess(`GeoJSON carregado via URL com sucesso! ${normalized.features.length} bairros mapeados.`);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar GeoJSON da URL informada.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadGeoJson = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(currentGeoJson, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', 'bairros_limpos_dengue.geojson');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Camada GeoJSON dos Bairros</h2>
              <p className="text-xs text-slate-400">Shapefile convertido em GeoJSON de São Luís (MA)</p>
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
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Status dos Polígonos */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-300 font-medium">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-400" />
                Bairros e Polígonos Ativos:
              </span>
              <span className="text-sm font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded-lg">
                {currentGeoJson.features?.length || 0} regiões
              </span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              O mapa base oficial embutido contém os principais bairros e distritos sanitários de São Luís (Centro, Bequimão, Cohab, Coroadinho, Tirirical, Itaqui-Bacanga e Zona Rural).
            </p>
          </div>

          {/* Carregar via URL Web (Ideal para Looker Studio) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Carregar por Link / URL pública (.geojson):
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Ex: https://raw.githubusercontent.com/.../bairros.geojson"
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-600 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleLoadFromUrl}
                disabled={isProcessing || !urlInput.trim()}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold text-xs transition active:scale-95 flex-shrink-0"
              >
                {isProcessing ? 'Carregando...' : 'Carregar'}
              </button>
            </div>
            <span className="text-[10px] text-slate-500 block">
              Arquivos GeoJSON hospedados online são carregados diretamente no Google Looker Studio.
            </span>
          </div>

          {/* Upload de Arquivo Local */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Ou faça upload de arquivo local (.geojson ou .json):
            </label>
            <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-700 hover:border-rose-500/60 rounded-xl bg-slate-950/40 cursor-pointer transition group">
              <UploadCloud className="w-7 h-7 text-slate-400 group-hover:text-rose-400 transition" />
              <span className="text-xs font-medium text-slate-200 mt-2">
                Clique para selecionar arquivo local
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">
                Suporta campos NM_BAIRRO, bairro, name ou CD_BAIRRO
              </span>
              <input
                type="file"
                accept=".geojson,.json"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="hidden"
              />
            </label>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleDownloadGeoJson}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              <Download className="w-4 h-4 text-rose-400" />
              <span>Baixar GeoJSON Atual</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onResetGeoJson();
                setUrlInput('');
                setSuccess('GeoJSON padrão de São Luís restaurado!');
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrão</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
