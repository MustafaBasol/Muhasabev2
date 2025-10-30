import React, { useState, useEffect } from 'react';
import { Calendar, Lock, Unlock, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';

interface FiscalPeriod {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface FiscalPeriodsWidgetProps {
  onNavigateToFiscalPeriods: () => void;
}

const FiscalPeriodsWidget: React.FC<FiscalPeriodsWidgetProps> = ({ onNavigateToFiscalPeriods }) => {
  const { t } = useTranslation('common');
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPeriods = async () => {
    try {
      const response = await apiClient.get('/fiscal-periods');
      setPeriods(response.data);
    } catch (error) {
      console.error('Dönemler yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeriods();
  }, []);

  // İstatistikleri hesapla
  const stats = {
    total: periods.length,
    locked: periods.filter(p => p.isLocked).length,
    unlocked: periods.filter(p => !p.isLocked).length,
    current: periods.find(p => {
      const now = new Date();
      const start = new Date(p.periodStart);
      const end = new Date(p.periodEnd);
      return now >= start && now <= end;
    })
  };

  // Aktif dönem kontrolü
  const hasActivePeriod = !!stats.current;
  const hasOverlappingPeriods = periods.some(period1 => 
    periods.some(period2 => 
      period1.id !== period2.id && 
      new Date(period1.periodStart) < new Date(period2.periodEnd) &&
      new Date(period1.periodEnd) > new Date(period2.periodStart)
    )
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">{t('fiscalPeriods.widget.title')}</h3>
          </div>
          <button
            onClick={onNavigateToFiscalPeriods}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
{t('fiscalPeriods.widget.managePeriods')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {periods.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">{t('fiscalPeriods.widget.noActivePeriod')}</p>
            <button
              onClick={onNavigateToFiscalPeriods}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('fiscalPeriods.widget.createActivePeriod')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Özet Bilgiler */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-sm text-gray-500">{t('fiscalPeriods.widget.totalPeriods')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.locked}</div>
                <div className="text-sm text-gray-500">{t('fiscalPeriods.widget.lockedPeriods')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.unlocked}</div>
                <div className="text-sm text-gray-500">{t('fiscalPeriods.active')}</div>
              </div>
            </div>

            {/* Aktif Dönem */}
            {hasActivePeriod && stats.current && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <CheckCircle className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-900">{t('fiscalPeriods.widget.activePeriod')}</span>
                </div>
                <div className="text-lg font-semibold text-blue-900">{stats.current.name}</div>
                <div className="text-sm text-blue-700">
                  {new Date(stats.current.periodStart).toLocaleDateString('tr-TR')} - 
                  {new Date(stats.current.periodEnd).toLocaleDateString('tr-TR')}
                </div>
                {stats.current.isLocked && (
                  <div className="flex items-center mt-2">
                    <Lock className="h-3 w-3 text-red-600 mr-1" />
                    <span className="text-xs text-red-600">{t('fiscalPeriods.locked')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Uyarılar */}
            {(!hasActivePeriod || hasOverlappingPeriods) && (
              <div className="space-y-2">
                {!hasActivePeriod && (
                  <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                    <span className="text-sm text-yellow-800">{t('fiscalPeriods.widget.warnings.noActive')}</span>
                  </div>
                )}
                {hasOverlappingPeriods && (
                  <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                    <span className="text-sm text-red-800">{t('fiscalPeriods.widget.warnings.overlapping')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Son Dönemler */}
            {periods.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">{t('fiscalPeriods.title')}</h4>
                <div className="space-y-2">
                  {periods.slice(0, 3).map(period => (
                    <div key={period.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{period.name}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(period.periodStart).toLocaleDateString('tr-TR')} - 
                          {new Date(period.periodEnd).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                      <div className="flex items-center">
                        {period.isLocked ? (
                          <Lock className="h-3 w-3 text-red-600" />
                        ) : (
                          <Unlock className="h-3 w-3 text-green-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hızlı Eylemler */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={onNavigateToFiscalPeriods}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
{t('fiscalPeriods.widget.managePeriods')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FiscalPeriodsWidget;