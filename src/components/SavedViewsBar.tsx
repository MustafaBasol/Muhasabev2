import React from 'react';
import { BookmarkPlus, Bookmark, Star, Trash2, ChevronDown, Layers } from 'lucide-react';
import { useSavedListViews, type ListType } from '../hooks/useSavedListViews';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export interface SavedViewsBarProps<State = any> {
  listType: ListType;
  title?: string;
  getState: () => State; // mevcut filtre/sıralama/pageSize durumu
  applyState: (state: State) => void; // seçilen görünümü uygula
  presets?: Array<{ id: string; label: string; apply: () => void }>; // hazır filtreler
}

export default function SavedViewsBar<State = any>({ listType, title, getState, applyState, presets = [] }: SavedViewsBarProps<State>) {
  const { t, i18n } = useTranslation('common');
  const { tenant } = useAuth();
  const planRaw = String((tenant as any)?.subscriptionPlan || '').toLowerCase();
  const canSave = ['business','enterprise'].some(p => planRaw.includes(p));

  const {
    views,
    activeViewId,
    setActiveViewId,
    saveCurrent,
    deleteView,
    setDefault,
    renameView,
    getDefault,
  } = useSavedListViews<State>({ listType });

  const defaultView = getDefault();
  const [isSaving, setIsSaving] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [presetsOpen, setPresetsOpen] = React.useState(false);
  const presetsRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [didAutoApply, setDidAutoApply] = React.useState(false);

  const lang = (i18n.language || 'tr').split('-')[0] as 'tr' | 'en' | 'fr' | 'de';
  const L = {
    presetsBtn: { tr: 'Hazır Filtreler', en: 'Preset Filters', fr: 'Filtres prêts', de: 'Vordefinierte Filter' },
    noPresets: { tr: 'Ön tanımlı filtre yok', en: 'No preset filters', fr: 'Aucun filtre prédéfini', de: 'Keine vordefinierten Filter' },
    viewsBtn:   { tr: 'Görünümler', en: 'Views', fr: 'Vues', de: 'Ansichten' },
    noViews:    { tr: 'Henüz kaydedilmiş görünüm yok.', en: 'No saved views yet.', fr: 'Aucune vue enregistrée.', de: 'Noch keine gespeicherten Ansichten.' },
    defaultV:   { tr: 'Varsayılan görünüm', en: 'Default view', fr: 'Vue par défaut', de: 'Standardansicht' },
    makeDefault:{ tr: 'Varsayılan yap', en: 'Set default', fr: 'Définir par défaut', de: 'Als Standard festlegen' },
    rename:     { tr: 'Yeniden adlandır', en: 'Rename', fr: 'Renommer', de: 'Umbenennen' },
    del:        { tr: 'Sil', en: 'Delete', fr: 'Supprimer', de: 'Löschen' },
    namePh:     { tr: 'Görünüm adı', en: 'View name', fr: 'Nom de la vue', de: 'Name der Ansicht' },
    save:       { tr: 'Kaydet', en: 'Save', fr: 'Enregistrer', de: 'Speichern' },
    saveTitle:  { tr: 'Mevcut filtreleri adla kaydet', en: 'Save current filters with name', fr: 'Enregistrer les filtres actuels avec un nom', de: 'Aktuelle Filter mit Namen speichern' },
    planReq:    { tr: 'Bu özellik Business planda', en: 'This feature requires Business plan', fr: 'Fonction disponible avec le plan Business', de: 'Funktion erfordert den Business-Tarif' },
    planNote:   { tr: 'Görünüm kaydetme Business plan ile aktif.', en: 'Saving views is available on Business plan.', fr: 'L’enregistrement des vues est disponible avec le plan Business.', de: 'Ansichten speichern ist im Business-Tarif verfügbar.' },
  } as const;

  // Close on outside click or Esc
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (presetsOpen && presetsRef.current && !presetsRef.current.contains(t)) {
        setPresetsOpen(false);
      }
      if (menuOpen && menuRef.current && !menuRef.current.contains(t)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setPresetsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, presetsOpen]);

  // Uygulama açıldığında varsayılan görünümü bir kez uygula
  React.useEffect(() => {
    if (didAutoApply) return;
    const def = getDefault();
    if (def && def.state) {
      try {
        applyState(def.state as State);
      } catch {}
    }
    setDidAutoApply(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views]);

  const handleSave = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const state = getState();
    const created = saveCurrent(trimmed, state);
    setNewName('');
    setIsSaving(false);
    // Hemen uygula
    applyState(created.state);
  };

  const handleSelectView = (id: string) => {
    const v = views.find(x => x.id === id);
    if (!v) return;
    setActiveViewId(id);
    applyState(v.state);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Hazır Filtreler */}
      <div className="relative" ref={presetsRef}>
        <button
          type="button"
          onClick={() => { setPresetsOpen(o => !o); setMenuOpen(false); }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          title={L.presetsBtn[lang]}
        >
          <Layers className="h-4 w-4" />
          <span>{L.presetsBtn[lang]}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {presetsOpen && (
          <div className="absolute z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
            {presets.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">{L.noPresets[lang]}</div>
            ) : presets.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setPresetsOpen(false); p.apply(); }}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Kaydedilmiş Görünümler */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => { setMenuOpen(o => !o); setPresetsOpen(false); }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          title={L.viewsBtn[lang]}
        >
          <Bookmark className="h-4 w-4" />
          <span>{L.viewsBtn[lang]}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
            <div className="max-h-64 overflow-auto">
              {views.length === 0 ? (
                <div className="px-2 py-3 text-sm text-gray-500">{L.noViews[lang]}</div>
              ) : (
                views.map(v => (
                  <div key={v.id} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-gray-50">
                    <button
                      type="button"
                      onClick={() => handleSelectView(v.id)}
                      className={`truncate text-left text-sm ${activeViewId === v.id ? 'text-indigo-700 font-medium' : 'text-gray-700'}`}
                      title={v.name}
                    >
                      {v.name}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDefault(v.id);
                          try { applyState(v.state as State); } catch {}
                        }}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${v.isDefault ? 'text-yellow-600 bg-yellow-50' : 'text-gray-400 hover:bg-gray-100'}`}
                        title={v.isDefault ? L.defaultV[lang] : L.makeDefault[lang]}
                      >
                        <Star className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = prompt('Yeni ad', v.name);
                          if (next && next.trim()) renameView(v.id, next.trim());
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100"
                        title={L.rename[lang]}
                      >
                        Aa
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteView(v.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50"
                        title={L.del[lang]}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-2 border-t pt-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <BookmarkPlus className="h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={L.namePh[lang]}
                    className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={!canSave}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave || !newName.trim()}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${canSave ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                  title={canSave ? L.saveTitle[lang] : L.planReq[lang]}
                >
                  {L.save[lang]}
                </button>
              </div>
              {!canSave && (
                <div className="mt-1 text-[11px] text-gray-500">{L.planNote[lang]}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
