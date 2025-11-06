import React, { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  List as BulletedList, ListOrdered as NumberedList,
  Quote, Code, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, Image as ImageIcon, Undo2, Redo2, Eraser, Minus,
  Heading1, Heading2, Heading3, Heading4, Heading5, Heading6
} from 'lucide-react';

interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  height?: number | string;
  readOnly?: boolean;
  className?: string;
}

// Hafif RTE: contentEditable + execCommand tabanlı toolbar
// Not: execCommand modern değil; ancak bağımlılık eklemeden temel düzenleme ihtiyaçlarını karşılar.
const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, height = 220, readOnly, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const showedPlaceholder = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const savedRangeRef = useRef<Range | null>(null);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableHover, setTableHover] = useState<{ r: number; c: number }>({ r: 3, c: 3 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof value === 'string' && value !== el.innerHTML) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const focusAndRestore = () => {
    const el = ref.current;
    if (!el) return;
    // Editöre odaklan ve son seçimi geri yükle
    if (document.activeElement !== el) el.focus();
    const sel = window.getSelection?.();
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
  };

  const apply = (cmd: string, val?: string) => {
    try {
      focusAndRestore();
      document.execCommand(cmd, false, val);
      // Değişiklikleri bildir
      const el = ref.current;
      if (el && onChange) onChange(el.innerHTML);
    } catch {}
  };

  const insertHtml = (html: string) => {
    try {
      focusAndRestore();
      document.execCommand('insertHTML', false, html);
      const el = ref.current;
      if (el && onChange) onChange(el.innerHTML);
    } catch {}
  };

  const onInput = () => {
    if (!ref.current) return;
    if (onChange) onChange(ref.current.innerHTML);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); apply('bold'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') { e.preventDefault(); apply('underline'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); apply('italic'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); apply('undo'); }
    if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); apply('redo'); }
  };

  const Btn: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }>
    = ({ title, onClick, children }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {children}
    </button>
  );

  const Divider = () => <span className="w-px h-6 bg-slate-200" aria-hidden="true" />;

  const h = typeof height === 'number' ? `${height}px` : height;

  // Son seçimi kaydet (tek tıkla butonlar için)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const isOrContains = (parent: Node, child: Node | null): boolean => {
      if (!child) return false;
      return parent === child || parent.contains(child);
    };
    const handleSelectionChange = () => {
      const sel = window.getSelection?.();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (isOrContains(el, range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  return (
    <div className={className}>
      {!readOnly && (
  <div className="flex flex-wrap items-center gap-1 border border-slate-200 rounded-t-md bg-white px-2 py-1.5 shadow-sm relative">
          {/* Temel stiller */}
          <Btn title="Kalın (Ctrl+B)" onClick={() => apply('bold')}><Bold className="w-4 h-4" /></Btn>
          <Btn title="İtalik (Ctrl+I)" onClick={() => apply('italic')}><Italic className="w-4 h-4" /></Btn>
          <Btn title="Altı Çizili (Ctrl+U)" onClick={() => apply('underline')}><Underline className="w-4 h-4" /></Btn>
          <Btn title="Üstü Çizili" onClick={() => apply('strikeThrough')}><Strikethrough className="w-4 h-4" /></Btn>
          <Divider />
          {/* Başlıklar (ikonlu dropdown) */}
          <div className="relative">
            <Btn title="Başlık (H1–H6)" onClick={() => setShowHeadingMenu(v => !v)}>
              <Heading1 className="w-4 h-4" />
            </Btn>
            {showHeadingMenu && (
              <div className="absolute z-50 mt-1 w-44 bg-white border border-slate-200 rounded-md shadow-lg p-1">
                {([
                  { tag: 'P', label: 'Paragraf', Icon: Minus },
                  { tag: 'H1', label: 'Başlık 1', Icon: Heading1 },
                  { tag: 'H2', label: 'Başlık 2', Icon: Heading2 },
                  { tag: 'H3', label: 'Başlık 3', Icon: Heading3 },
                  { tag: 'H4', label: 'Başlık 4', Icon: Heading4 },
                  { tag: 'H5', label: 'Başlık 5', Icon: Heading5 },
                  { tag: 'H6', label: 'Başlık 6', Icon: Heading6 },
                ] as const).map(({ tag, label, Icon }) => (
                  <button
                    key={tag}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); apply('formatBlock', tag); setShowHeadingMenu(false); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 rounded hover:bg-slate-100"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Divider />
          {/* Listeler */}
          <Btn title="Madde İşaretli Liste" onClick={() => apply('insertUnorderedList')}><BulletedList className="w-4 h-4" /></Btn>
          <Btn title="Numaralı Liste" onClick={() => apply('insertOrderedList')}><NumberedList className="w-4 h-4" /></Btn>
          <Divider />
          {/* Hizalama */}
          <Btn title="Sola Hizala" onClick={() => apply('justifyLeft')}><AlignLeft className="w-4 h-4" /></Btn>
          <Btn title="Ortala" onClick={() => apply('justifyCenter')}><AlignCenter className="w-4 h-4" /></Btn>
          <Btn title="Sağa Hizala" onClick={() => apply('justifyRight')}><AlignRight className="w-4 h-4" /></Btn>
          <Btn title="İki Yana Yasla" onClick={() => apply('justifyFull')}><AlignJustify className="w-4 h-4" /></Btn>
          <Divider />
          {/* Alıntı, Kod */}
          <Btn title="Alıntı" onClick={() => apply('formatBlock', 'BLOCKQUOTE')}><Quote className="w-4 h-4" /></Btn>
          <Btn title="Kod Bloğu" onClick={() => apply('formatBlock', 'PRE')}><Code className="w-4 h-4" /></Btn>
          <Btn title="Yatay Çizgi" onClick={() => apply('insertHorizontalRule')}><Minus className="w-4 h-4" /></Btn>
          <Divider />
          {/* Alt/Üst indis */}
          <Btn title="Alt indis" onClick={() => apply('subscript')}><span className="text-[10px] font-semibold">x<sub>2</sub></span></Btn>
          <Btn title="Üst indis" onClick={() => apply('superscript')}><span className="text-[10px] font-semibold">x<sup>2</sup></span></Btn>
          <Divider />
          {/* Link ve Görsel */}
          <Btn
            title="Bağlantı Ekle"
            onClick={() => {
              const url = window.prompt('Bağlantı URL’si:');
              if (url) apply('createLink', url);
            }}
          >
            <LinkIcon className="w-4 h-4" />
          </Btn>
          <Btn
            title="Görsel Ekle"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="w-4 h-4" />
          </Btn>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const src = String(reader.result || '');
                  if (src) apply('insertImage', src);
                } catch {}
              };
              reader.readAsDataURL(file);
              e.currentTarget.value = '';
            }}
          />
          <Divider />
          {/* Tablo */}
          <div className="relative">
            <Btn
              title="Tablo Ekle"
              onClick={() => setShowTablePicker(v => !v)}
            >
              <span className="grid grid-cols-3 grid-rows-3 gap-[1px] w-4 h-4">
                {Array.from({length:9}).map((_,i)=>(<span key={i} className="bg-slate-500/50" />))}
              </span>
            </Btn>
            {showTablePicker && (
              <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-md shadow-lg p-2">
                <div className="grid grid-cols-6 gap-1">
                  {Array.from({ length: 36 }).map((_, idx) => {
                    const r = Math.floor(idx / 6) + 1;
                    const c = (idx % 6) + 1;
                    const active = r <= tableHover.r && c <= tableHover.c;
                    return (
                      <div
                        key={idx}
                        onMouseEnter={() => setTableHover({ r, c })}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const cells = Array.from({ length: r }).map(() => `<tr>${Array.from({ length: c }).map(() => '<td>&nbsp;</td>').join('')}</tr>`).join('');
                          insertHtml(`<table><tbody>${cells}</tbody></table>`);
                          setShowTablePicker(false);
                        }}
                        className={`w-5 h-5 border ${active ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-slate-200'} cursor-pointer`}
                      />
                    );
                  })}
                </div>
                <div className="text-xs text-slate-600 mt-2 text-center">{tableHover.r} × {tableHover.c}</div>
              </div>
            )}
          </div>
          <Divider />
          {/* Geri al / Yinele ve temizle */}
          <Btn title="Geri Al (Ctrl+Z)" onClick={() => apply('undo')}><Undo2 className="w-4 h-4" /></Btn>
          <Btn title="Yinele (Shift+Ctrl+Z)" onClick={() => apply('redo')}><Redo2 className="w-4 h-4" /></Btn>
          <Btn title="Biçimlendirmeyi Temizle" onClick={() => apply('removeFormat')}><Eraser className="w-4 h-4" /></Btn>
        </div>
      )}
      <div
        ref={ref}
        className={`border border-slate-200 ${readOnly ? 'rounded-md' : 'rounded-b-md'} p-3 focus:outline-none min-h-[140px] prose prose-sm max-w-none bg-white ${isFocused ? 'ring-2 ring-indigo-500' : ''}`}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={onInput}
        onKeyDown={onKeyDown}
        style={{ height: h, overflowY: 'auto' }}
        data-placeholder={placeholder || ''}
        onFocus={(e) => {
          setIsFocused(true);
          setShowHeadingMenu(false); setShowTablePicker(false);
          if (!value && !showedPlaceholder.current) { e.currentTarget.innerHTML = ''; showedPlaceholder.current = true; }
        }}
        onBlur={() => setIsFocused(false)}
      />
      <style>{`
        .prose h1 { font-size: 1.25rem; font-weight: 700; margin: 0.5rem 0; }
        .prose h2 { font-size: 1.1rem; font-weight: 700; margin: 0.5rem 0; }
        .prose p { margin: 0.25rem 0; }
        .prose ul { list-style: disc; padding-left: 1.25rem; margin: 0.25rem 0; }
        .prose ol { list-style: decimal; padding-left: 1.25rem; margin: 0.25rem 0; }
        .prose blockquote { border-left: 3px solid #e5e7eb; color: #374151; padding-left: 0.75rem; margin: 0.5rem 0; }
        .prose pre { background: #0f172a; color: #e5e7eb; padding: 0.5rem 0.75rem; border-radius: 0.375rem; overflow-x: auto; }
        .prose code { background: #f1f5f9; padding: 0.1rem 0.3rem; border-radius: 0.25rem; }
        .prose img { max-width: 100%; height: auto; border-radius: 0.25rem; }
        .prose table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; }
        .prose th, .prose td { border: 1px solid #e5e7eb; padding: 6px; }
        .prose thead th { background: #f9fafb; }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
