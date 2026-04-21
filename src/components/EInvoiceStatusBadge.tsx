import { EInvoiceStatus } from '../api/integrations';

interface EInvoiceStatusBadgeProps {
  status: EInvoiceStatus | string | null | undefined;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  [EInvoiceStatus.NOT_APPLICABLE]: {
    label: '—',
    color: 'bg-gray-100 text-gray-500',
  },
  [EInvoiceStatus.PENDING]: {
    label: 'En attente',
    color: 'bg-yellow-100 text-yellow-700',
  },
  [EInvoiceStatus.SUBMITTED]: {
    label: 'Soumis',
    color: 'bg-blue-100 text-blue-700',
  },
  [EInvoiceStatus.SENT]: {
    label: 'Envoyé',
    color: 'bg-blue-200 text-blue-800',
  },
  [EInvoiceStatus.APPROVED]: {
    label: 'Approuvé',
    color: 'bg-indigo-100 text-indigo-700',
  },
  [EInvoiceStatus.ACCEPTED]: {
    label: 'Accepté',
    color: 'bg-green-100 text-green-700',
  },
  [EInvoiceStatus.REJECTED]: {
    label: 'Rejeté',
    color: 'bg-red-100 text-red-700',
  },
  [EInvoiceStatus.REFUSED]: {
    label: 'Refusé',
    color: 'bg-red-200 text-red-800',
  },
  [EInvoiceStatus.IN_DISPUTE]: {
    label: 'Litige',
    color: 'bg-orange-100 text-orange-700',
  },
  [EInvoiceStatus.COLLECTED]: {
    label: 'Encaissé',
    color: 'bg-emerald-100 text-emerald-700',
  },
  [EInvoiceStatus.PARTIALLY_COLLECTED]: {
    label: 'Part. encaissé',
    color: 'bg-emerald-50 text-emerald-600',
  },
};

export default function EInvoiceStatusBadge({
  status,
  className = '',
}: EInvoiceStatusBadgeProps) {
  if (!status || status === EInvoiceStatus.NOT_APPLICABLE) return null;

  const config = STATUS_CONFIG[status] ?? {
    label: status,
    color: 'bg-gray-100 text-gray-600',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color} ${className}`}
      title={`E-Facture: ${config.label}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {config.label}
    </span>
  );
}
