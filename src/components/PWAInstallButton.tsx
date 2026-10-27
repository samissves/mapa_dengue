import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Se já estiver rodando como PWA instalado (standalone), esconde o botão
  if (isInstalled) {
    return null;
  }

  // Navegadores Chromium / Android / Desktop com suporte a prompt de instalação
  if (isInstallable) {
    return (
      <button
        onClick={install}
        title="Instalar aplicativo PWA para uso offline"
        className={`inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-medium shadow-md shadow-rose-950/40 transition-all ${
          compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs'
        }`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar App</span>
      </button>
    );
  }

  // Fluxo iOS Safari
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          title="Instalar no iPhone ou iPad"
          className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs font-medium transition ${
            compact ? 'px-2 py-1' : 'px-3 py-1.5'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-rose-400" />
          <span>Instalar no iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-semibold text-white">Instalar no iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300 mt-4 leading-relaxed">
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-600/30 text-rose-300 flex items-center justify-center font-bold text-[11px]">1</span>
                  <p>Abra este site no navegador <strong>Safari</strong> do iOS.</p>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-600/30 text-rose-300 flex items-center justify-center font-bold text-[11px]">2</span>
                  <p className="flex items-center gap-1.5">
                    Toque no botão <Share2 className="w-3.5 h-3.5 inline text-sky-400" /> <strong>Compartilhar</strong> na barra do Safari.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-600/30 text-rose-300 flex items-center justify-center font-bold text-[11px]">3</span>
                  <p>Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.</p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-semibold text-slate-200 transition"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
