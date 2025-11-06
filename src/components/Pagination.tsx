import React from 'react';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
  page: number; // 1-based
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
  className = ''
}) => {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  const goPrev = () => onPageChange(Math.max(1, page - 1));
  const goNext = () => onPageChange(Math.min(totalPages, page + 1));

  // Show a compact range of page numbers
  const pages: number[] = [];
  const maxButtons = 5;
  let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }
  for (let p = startPage; p <= endPage; p++) pages.push(p);

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span>{t('pagination.itemsPerPage', { defaultValue: 'Sayfa başına' })}:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          {pageSizeOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <span className="ml-2 text-gray-500">{t('pagination.range', { start, end, total, defaultValue: `${start}-${end} / ${total}` })}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={goPrev}
          disabled={page <= 1}
          className={`px-3 py-1.5 text-sm rounded-lg border ${page <= 1 ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
        >
          {t('pagination.previous', { defaultValue: 'Önceki' })}
        </button>
        {startPage > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className={`px-3 py-1.5 text-sm rounded-lg border text-gray-700 border-gray-300 hover:bg-gray-50`}
            >1</button>
            {startPage > 2 && <span className="px-2 text-gray-400">…</span>}
          </>
        )}
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${p === page ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            {p}
          </button>
        ))}
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-2 text-gray-400">…</span>}
            <button
              onClick={() => onPageChange(totalPages)}
              className={`px-3 py-1.5 text-sm rounded-lg border text-gray-700 border-gray-300 hover:bg-gray-50`}
            >{totalPages}</button>
          </>
        )}
        <button
          onClick={goNext}
          disabled={page >= totalPages}
          className={`px-3 py-1.5 text-sm rounded-lg border ${page >= totalPages ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
        >
          {t('pagination.next', { defaultValue: 'Sonraki' })}
        </button>
      </div>
    </div>
  );
};

export default Pagination;
