import React, { useState, useRef, useEffect, useMemo } from 'react';
import { BairroSearchItem } from '../types/dengue';
import { normalizeKey } from '../utils/districtNames';
import { 
  Check, 
  ChevronDown, 
  MapPin, 
  Search, 
  X, 
  Building2 
} from 'lucide-react';

interface BairroSearchDropdownProps {
  bairrosList: BairroSearchItem[];
  selectedBairroId: string | null;
  onSelectBairro: (bairroId: string | null) => void;
  filterDistrito?: string;
  compact?: boolean;
}

export const BairroSearchDropdown: React.FC<BairroSearchDropdownProps> = ({
  bairrosList,
  selectedBairroId,
  onSelectBairro,
  filterDistrito = 'all',
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBySelectedDistrictOnly, setFilterBySelectedDistrictOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Auto-foco no campo de busca ao abrir
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fecha no Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Bairro atualmente selecionado
  const selectedBairro = useMemo(() => {
    if (!selectedBairroId) return null;
    return bairrosList.find(b => 
      b.id === selectedBairroId || 
      normalizeKey(b.id) === normalizeKey(selectedBairroId) ||
      normalizeKey(b.name) === normalizeKey(selectedBairroId)
    ) || null;
  }, [selectedBairroId, bairrosList]);

  // Se o usuário selecionou um distrito específico e mudou o filtro
  const isDistrictFilterActive = filterDistrito && filterDistrito !== 'all';

  // Filtragem da lista por texto e opcionalmente por distrito
  const filteredBairros = useMemo(() => {
    const term = normalizeKey(searchTerm);
    const distNorm = isDistrictFilterActive ? normalizeKey(filterDistrito) : '';

    return bairrosList.filter(b => {
      // Filtro de distrito se a opção estiver ativa
      if (isDistrictFilterActive && filterBySelectedDistrictOnly) {
        if (!b.distrito || normalizeKey(b.distrito) !== distNorm) {
          return false;
        }
      }

      // Filtro de busca textual
      if (!term) return true;
      const nameNorm = normalizeKey(b.name);
      const distItemNorm = b.distrito ? normalizeKey(b.distrito) : '';
      return nameNorm.includes(term) || distItemNorm.includes(term);
    });
  }, [bairrosList, searchTerm, isDistrictFilterActive, filterDistrito, filterBySelectedDistrictOnly]);

  const handleSelect = (bId: string | null) => {
    onSelectBairro(bId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectBairro(null);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* Botão de Disparo do Dropdown (Filtro por Bairro) */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex items-center gap-1.5 rounded-xl border transition cursor-pointer select-none ${
          compact
            ? 'px-2 py-1 text-xs bg-slate-950/80 border-slate-800 hover:border-slate-700'
            : 'px-2.5 py-1 text-xs bg-slate-900 border-slate-700/80 hover:border-slate-600'
        } ${
          selectedBairro 
            ? 'border-rose-500/60 bg-rose-950/20 text-white font-medium shadow-sm shadow-rose-950/40' 
            : 'text-slate-200'
        }`}
        title={selectedBairro ? `Bairro selecionado: ${selectedBairro.name}` : 'Filtrar por Bairro'}
      >
        <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${selectedBairro ? 'text-rose-400' : 'text-slate-400'}`} />
        
        <span className="truncate max-w-[120px] sm:max-w-[160px] text-left">
          {selectedBairro ? selectedBairro.name : 'Todos os Bairros'}
        </span>

        {selectedBairro ? (
          <span
            onClick={handleClear}
            className="p-0.5 rounded-full hover:bg-rose-500/30 text-rose-300 hover:text-white transition flex-shrink-0"
            title="Limpar seleção de bairro"
            role="button"
          >
            <X className="w-3 h-3" />
          </span>
        ) : (
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-rose-400' : ''
          }`} />
        )}
      </button>

      {/* Menu Dropdown com Busca Textual e Lista */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 rounded-2xl bg-slate-900/98 backdrop-blur-2xl border border-slate-700 shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
          {/* Cabeçalho de Busca */}
          <div className="p-2.5 border-b border-slate-800/80 bg-slate-950/60 space-y-2">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Digitar nome do bairro..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-xs text-white placeholder:text-slate-500 focus:outline-none transition font-sans"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 p-0.5 rounded-full text-slate-400 hover:text-white"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Se houver filtro de distrito ativo, permitir limitar ou mostrar todos */}
            {isDistrictFilterActive && (
              <div className="flex items-center justify-between text-[11px] px-1 text-slate-400">
                <span className="truncate pr-1">
                  Distrito ativo: <strong className="text-slate-300">{filterDistrito}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setFilterBySelectedDistrictOnly(prev => !prev)}
                  className={`px-2 py-0.5 rounded-md font-semibold text-[10px] transition flex-shrink-0 ${
                    filterBySelectedDistrictOnly
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {filterBySelectedDistrictOnly ? 'Apenas deste distrito ✓' : 'Filtrar por este distrito'}
                </button>
              </div>
            )}
          </div>

          {/* Opção Padrão: Todos os Bairros (Visão Geral) */}
          <div className="p-1 border-b border-slate-800/60">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                !selectedBairro 
                  ? 'bg-rose-600/15 text-rose-300 font-semibold border border-rose-500/20' 
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                <span>Todos os Bairros (Visão Geral)</span>
              </div>
              {!selectedBairro && (
                <Check className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
              )}
            </button>
          </div>

          {/* Lista de Bairros Rolável */}
          <div className="max-h-60 sm:max-h-72 overflow-y-auto p-1 space-y-0.5">
            {filteredBairros.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 px-4">
                <p>Nenhum bairro encontrado para</p>
                <p className="font-semibold text-rose-400 truncate mt-0.5">"{searchTerm}"</p>
                {isDistrictFilterActive && filterBySelectedDistrictOnly && (
                  <button
                    type="button"
                    onClick={() => setFilterBySelectedDistrictOnly(false)}
                    className="mt-2 text-[11px] text-sky-400 hover:underline block mx-auto"
                  >
                    Buscar em todos os distritos
                  </button>
                )}
              </div>
            ) : (
              filteredBairros.map((b) => {
                const isSelected = selectedBairro?.id === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSelect(b.id)}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                      isSelected
                        ? 'bg-rose-600/20 text-white font-semibold border border-rose-500/30'
                        : 'text-slate-200 hover:bg-slate-800/90 hover:text-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{b.name}</span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                        )}
                      </div>
                      {b.distrito && (
                        <span className="text-[10px] text-slate-400 truncate block">
                          {b.distrito}
                        </span>
                      )}
                    </div>

                    {/* Badge de Casos / Incidência */}
                    {b.casos !== undefined && (
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-[11px] font-bold text-amber-300">
                          {b.casos.toLocaleString('pt-BR')} <span className="text-[9px] font-normal text-slate-400">casos</span>
                        </span>
                        {b.incidencia !== undefined && b.incidencia > 0 && (
                          <span className="text-[10px] text-rose-400">
                            {b.incidencia.toLocaleString('pt-BR')} <span className="text-[9px] text-slate-500">/100k</span>
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Rodapé Informativo */}
          <div className="px-3 py-1.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
            <span>
              {filteredBairros.length} {filteredBairros.length === 1 ? 'bairro exibido' : 'bairros listados'}
            </span>
            {selectedBairro && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="text-rose-400 hover:text-rose-300 hover:underline"
              >
                Limpar filtro
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
