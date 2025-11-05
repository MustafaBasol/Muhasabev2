import React, { useEffect, useRef } from 'react';

interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  height?: number | string;
  readOnly?: boolean;
  className?: string;
}

// Basit ve hafif bir RTE: contentEditable + execCommand tabanlı toolbar
// Not: execCommand modern değil ama temel kullanım için yeterli ve bağımlılık gerektirmez
const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, height = 220, readOnly, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const showedPlaceholder = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof value === 'string' && value !== el.innerHTML) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const apply = (cmd: string, val?: string) => {
    try {
      document.execCommand(cmd, false, val);
      // Değişiklikleri bildir
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
  };

  const toolbarButton = (label: string, title: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="px-2 py-1 text-sm rounded hover:bg-gray-100" title={title}>
      {label}
    </button>
  );

  const h = typeof height === 'number' ? `${height}px` : height;

  return (
    <div className={className}>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 border border-gray-200 rounded-t bg-gray-50 px-2 py-1">
          {toolbarButton('B', 'Kalın', () => apply('bold'))}
          {toolbarButton('U', 'Altı çizili', () => apply('underline'))}
          {toolbarButton('•', 'Madde işaretli liste', () => apply('insertUnorderedList'))}
          {toolbarButton('1.', 'Numaralı liste', () => apply('insertOrderedList'))}
          {toolbarButton('H1', 'Başlık 1', () => apply('formatBlock', 'H1'))}
          {toolbarButton('H2', 'Başlık 2', () => apply('formatBlock', 'H2'))}
          {toolbarButton('P', 'Paragraf', () => apply('formatBlock', 'P'))}
        </div>
      )}
      <div
        ref={ref}
        className={`border border-gray-200 ${readOnly ? 'rounded' : 'rounded-b'} p-3 focus:outline-none min-h-[120px] prose prose-sm max-w-none`}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={onInput}
        onKeyDown={onKeyDown}
        style={{ height: h, overflowY: 'auto' }}
        data-placeholder={placeholder || ''}
        onFocus={(e) => { if (!value && !showedPlaceholder.current) { e.currentTarget.innerHTML = ''; showedPlaceholder.current = true; } }}
      />
      <style>{`
        .prose h1 { font-size: 1.25rem; font-weight: 700; margin: 0.5rem 0; }
        .prose h2 { font-size: 1.1rem; font-weight: 700; margin: 0.5rem 0; }
        .prose p { margin: 0.25rem 0; }
        .prose ul { list-style: disc; padding-left: 1.25rem; margin: 0.25rem 0; }
        .prose ol { list-style: decimal; padding-left: 1.25rem; margin: 0.25rem 0; }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
