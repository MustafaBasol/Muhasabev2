import React, { useState, useEffect } from 'react';
import { Calendar, Lock, Unlock, Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';
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

const FiscalPeriodsPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<FiscalPeriod | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Dönemleri yükle
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

  // Validation fonksiyonları
  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Ad kontrolü
    if (!formData.name.trim()) {
      errors.name = t('fiscalPeriods.validation.nameRequired');
    }

    // Tarih kontrolleri
    if (!formData.startDate) {
      errors.startDate = t('fiscalPeriods.validation.startDateRequired');
    }
    if (!formData.endDate) {
      errors.endDate = t('fiscalPeriods.validation.endDateRequired');
    }

    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      
      // Bitiş tarihi başlangıçtan sonra olmalı
      if (endDate <= startDate) {
        errors.endDate = t('fiscalPeriods.validation.endDateAfterStart');
      }

      // Minimum süre kontrolü
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 1) {
        errors.endDate = t('fiscalPeriods.validation.minimumDuration');
      }

      // Tarih çakışması kontrolü
      const overlappingPeriod = periods.find(p => {
        if (editingPeriod && p.id === editingPeriod.id) return false;
        
        const pStart = new Date(p.periodStart);
        const pEnd = new Date(p.periodEnd);
        
        return (startDate <= pEnd && endDate >= pStart);
      });

      if (overlappingPeriod) {
        errors.startDate = t('fiscalPeriods.validation.periodOverlap');
        errors.endDate = t('fiscalPeriods.validation.periodOverlap');
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Yeni dönem oluştur
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await apiClient.post('/fiscal-periods', formData);
      setShowCreateModal(false);
      setFormData({ name: '', startDate: '', endDate: '' });
      setFormErrors({});
      loadPeriods();
    } catch (error: any) {
      alert(`${t('fiscalPeriods.errors.createFailed')}: ${error.response?.data?.message || error.message}`);
    }
  };

  // Dönem güncelle
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPeriod) return;

    if (!validateForm()) {
      return;
    }

    try {
      await apiClient.patch(`/fiscal-periods/${editingPeriod.id}`, formData);
      setEditingPeriod(null);
      setFormData({ name: '', startDate: '', endDate: '' });
      setFormErrors({});
      loadPeriods();
    } catch (error: any) {
      alert(`${t('fiscalPeriods.errors.updateFailed')}: ${error.response?.data?.message || error.message}`);
    }
  };

  // Dönem kilitle
  const handleLock = async (periodId: string) => {
    if (!confirm(t('fiscalPeriods.lockConfirm'))) {
      return;
    }

    try {
      await apiClient.patch(`/fiscal-periods/${periodId}/lock`, {
        lockReason: 'Locked by user'
      });
      loadPeriods();
    } catch (error: any) {
      alert(`${t('fiscalPeriods.errors.lockFailed')}: ${error.response?.data?.message || error.message}`);
    }
  };

  // Dönem kilidini aç
  const handleUnlock = async (periodId: string) => {
    if (!confirm(t('fiscalPeriods.unlockConfirm'))) {
      return;
    }

    try {
      await apiClient.patch(`/fiscal-periods/${periodId}/unlock`);
      loadPeriods();
    } catch (error: any) {
      alert(`${t('fiscalPeriods.errors.unlockFailed')}: ${error.response?.data?.message || error.message}`);
    }
  };

  // Dönem sil
  const handleDelete = async (periodId: string) => {
    if (!confirm(t('fiscalPeriods.deleteConfirm'))) {
      return;
    }

    try {
      await apiClient.delete(`/fiscal-periods/${periodId}`);
      loadPeriods();
    } catch (error: any) {
      alert(`${t('fiscalPeriods.errors.deleteFailed')}: ${error.response?.data?.message || error.message}`);
    }
  };

  // Düzenleme için formu doldur
  const startEdit = (period: FiscalPeriod) => {
    setEditingPeriod(period);
    setFormData({
      name: period.name || '',
      startDate: period.periodStart || '',
      endDate: period.periodEnd || ''
    });
    setFormErrors({});
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Calendar className="h-8 w-8 text-blue-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">{t('fiscalPeriods.title')}</h1>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '', startDate: '', endDate: '' });
            setFormErrors({});
            setEditingPeriod(null);
            setShowCreateModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('fiscalPeriods.newPeriod')}
        </button>
      </div>

      {/* Dönem Listesi */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('fiscalPeriods.periodName')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('fiscalPeriods.startDate')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('fiscalPeriods.endDate')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('fiscalPeriods.status')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('fiscalPeriods.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {periods.map((period) => (
              <tr key={period.id} className={period.isLocked ? 'bg-red-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{period.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{formatDate(period.periodStart)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{formatDate(period.periodEnd)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    period.isLocked 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {period.isLocked ? (
                      <>
                        <Lock className="h-3 w-3 mr-1" />
                        {t('fiscalPeriods.locked')}
                      </>
                    ) : (
                      <>
                        <Unlock className="h-3 w-3 mr-1" />
                        {t('fiscalPeriods.active')}
                      </>
                    )}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    {!period.isLocked && (
                      <>
                        <button
                          onClick={() => startEdit(period)}
                          className="text-blue-600 hover:text-blue-900"
                          title={t('fiscalPeriods.edit')}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleLock(period.id)}
                          className="text-orange-600 hover:text-orange-900"
                          title={t('fiscalPeriods.lock')}
                        >
                          <Lock className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {period.isLocked && (
                      <button
                        onClick={() => handleUnlock(period.id)}
                        className="text-green-600 hover:text-green-900"
                        title={t('fiscalPeriods.unlock')}
                      >
                        <Unlock className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(period.id)}
                      className="text-red-600 hover:text-red-900"
                      title={t('fiscalPeriods.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {periods.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">{t('fiscalPeriods.noPeriods')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('fiscalPeriods.noPeriodsDesc')}
            </p>
          </div>
        )}
      </div>

      {/* Dönem Oluşturma/Düzenleme Modalı */}
      {(showCreateModal || editingPeriod) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingPeriod ? t('fiscalPeriods.editPeriod') : t('fiscalPeriods.addPeriod')}
            </h3>
            
            <form onSubmit={editingPeriod ? handleUpdate : handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('fiscalPeriods.periodName')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 ${
                    formErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  required
                  placeholder={t('fiscalPeriods.periodNamePlaceholder')}
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('fiscalPeriods.startDate')}
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 ${
                    formErrors.startDate ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  required
                />
                {formErrors.startDate && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.startDate}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('fiscalPeriods.endDate')}
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 ${
                    formErrors.endDate ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  required
                />
                {formErrors.endDate && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.endDate}</p>
                )}
              </div>

              {editingPeriod?.isLocked && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        {t('fiscalPeriods.errors.periodLocked')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingPeriod(null);
                    setFormData({ name: '', startDate: '', endDate: '' });
                    setFormErrors({});
                    setFormData({ name: '', startDate: '', endDate: '' });
                    setFormErrors({});
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={editingPeriod?.isLocked}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingPeriod ? t('common.update') : t('common.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FiscalPeriodsPage;