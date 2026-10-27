import React from 'react';
import { BairroEpidemiology, DistrictEpidemiology, MapViewLevel } from '../types/dengue';
import { 
  AlertTriangle, 
  Building2, 
  ShieldCheck, 
  X 
} from 'lucide-react';

interface BairroDetailPanelProps {
  bairro: BairroEpidemiology | null;
  districtInfo?: DistrictEpidemiology | null;
  viewLevel?: MapViewLevel;
  onClose: () => void;
  isEmbedMode?: boolean;
}

export const BairroDetailPanel: React.FC<BairroDetailPanelProps> = ({ 
  bairro, 
  districtInfo,
  viewLevel = 'bairro',
  onClose,
  isEmbedMode = false
}) => {
  if (!bairro && !districtInfo) return null;

  // Se estiver no modo distrito ou se tivermos informações do distrito
  const isDistrictMode = viewLevel === 'distrito' && !!districtInfo;

  const totalCasos = isDistrictMode ? districtInfo.totalCasos : (bairro?.casos ?? 0);
  const totalIncidencia = isDistrictMode ? districtInfo.incidencia : (bairro?.incidencia ?? 0);
  const populacao = isDistrictMode ? districtInfo.totalPopulacao : (bairro?.populacao ?? 0);

  const getEpidemiologyStatus = (incid: number, casos: number) => {
    if (incid >= 500 || casos >= 300) {
      return { 
        label: 'MUITO ALTO RISCO (EPIDÊMICO)', 
        style: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        isHigh: true,
        isMed: false
      };
    }
    if (incid >= 300 || casos >= 150) {
      return { 
        label: 'ALTO RISCO DE TRANSMISSÃO', 
        style: 'bg-red-500/20 text-red-300 border-red-500/30',
        isHigh: true,
        isMed: false
      };
    }
    if (incid >= 100 || casos >= 60) {
      return { 
        label: 'MÉDIO RISCO', 
        style: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
        isHigh: false,
        isMed: true
      };
    }
    if (incid >= 25 || casos >= 25) {
      return { 
        label: 'ALERTA EPIDEMIOLÓGICO', 
        style: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        isHigh: false,
        isMed: true
      };
    }
    return { 
      label: 'BAIXO RISCO', 
      style: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      isHigh: false,
      isMed: false
    };
  };

  const status = getEpidemiologyStatus(totalIncidencia, totalCasos);

  return (
    <div className={`absolute ${
      isEmbedMode ? 'top-16 left-3 sm:top-16 sm:left-3 max-h-[calc(100%-5rem)]' : 'top-3 left-3 sm:top-4 sm:left-4 max-h-[calc(100%-2rem)]'
    } z-20 w-80 sm:w-96 flex flex-col bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200`}>
      {/* Cabeçalho */}
      <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 relative">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${status.style}`}>
            {status.label}
          </span>
          {isDistrictMode && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
              Distrito Sanitário
            </span>
          )}
        </div>

        <h2 className="text-lg font-bold text-white tracking-tight">
          {isDistrictMode ? districtInfo.distritoNome : bairro?.bairroNome}
        </h2>
        <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-rose-400" />
            <span>
              {isDistrictMode ? `${districtInfo.bairrosCount} bairros monitorados` : bairro?.distritoSanitario}
            </span>
          </div>
          {populacao > 0 && (
            <span className="text-[11px] text-slate-400 font-mono">
              Pop: <strong className="text-slate-200">{populacao.toLocaleString('pt-BR')}</strong> hab.
            </span>
          )}
        </div>
      </div>

      {/* Métricas Principais: Casos Prováveis e Taxa de Incidência */}
      <div className="p-4 overflow-y-auto space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2.5">
          {/* Card: Casos Prováveis */}
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/70">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-300">Casos</span>
              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-400 border border-amber-500/20">
                Total
              </span>
            </div>
            <div className="text-2xl font-black text-white tracking-tight mt-1">
              {totalCasos.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              notificados
            </span>
          </div>

          {/* Card: Taxa de Incidência */}
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/70">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-300">Incidência</span>
              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-900 text-rose-400 border border-rose-500/20">
                / 100k
              </span>
            </div>
            <div className="text-2xl font-black text-rose-400 tracking-tight mt-1">
              {totalIncidencia.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              população oficial
            </span>
          </div>
        </div>

        {/* Se for modo distrito, listar bairros do distrito com Casos e Incidência */}
        {isDistrictMode && districtInfo.bairros.length > 0 && (
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-200">
                Bairros do Distrito ({districtInfo.bairros.length}):
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Casos | Incidência</span>
            </div>
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
              {districtInfo.bairros.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
                  <span className="text-slate-300 font-medium truncate max-w-[150px]">{b.bairroNome}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="font-bold text-white text-[11px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                      {b.casos}
                    </span>
                    <span className="text-[10px] font-semibold text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/40">
                      {b.incidencia.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ações Recomendadas no Território */}
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs">
            {status.isHigh ? (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            )}
            <span>Classificação & Recomendações:</span>
          </div>
          <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
            {status.isHigh ? (
              <>
                <li className="font-semibold text-rose-300">Região prioritária para bloqueio imediato de transmissão.</li>
                <li>Mobilização de equipes e visitas domiciliares de agentes de endemias.</li>
                <li>Ciclos programados de borrifação / fumacê nas vias públicas.</li>
              </>
            ) : status.isMed ? (
              <>
                <li>Monitoramento semanal de notificações.</li>
                <li>Campanhas para eliminação de criadouros domésticos.</li>
              </>
            ) : (
              <>
                <li>Nível sob controle. Manter ações rotineiras de vigilância.</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};
