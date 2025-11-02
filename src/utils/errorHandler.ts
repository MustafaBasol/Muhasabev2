import i18n from '../i18n/config';

// API Error Handler - Kullanıcı dostu error mesajları
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

export const getErrorMessage = (error: unknown): string => {
  // API response error
  if (error && typeof error === 'object') {
    const maybe = error as { response?: { data?: { message?: string } }; message?: string; code?: string };
    if (maybe.response?.data?.message) {
      return translateErrorMessage(maybe.response.data.message);
    }
    
    // Simple error message
    if (maybe.message) {
      return translateErrorMessage(maybe.message);
    }
    
    // Network error
    if (maybe.code === 'NETWORK_ERROR') {
      return i18n.t('common.networkError', { defaultValue: 'Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.' });
    }
  }
  
  // Default error
  return i18n.t('common.unexpectedError', { defaultValue: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' });
};

// Error mesajlarını çevir
const translateErrorMessage = (message: string): string => {
  // Mali dönem hataları için i18n kullan
  const fiscalPeriodErrors: Record<string, string> = {
    'Fiscal period overlaps with existing period': i18n.t('fiscalPeriods.validation.periodOverlap', { defaultValue: 'Bu tarih aralığında zaten başka bir mali dönem tanımlı.' }),
    'Period is already locked': i18n.t('fiscalPeriods.errors.periodLocked', { defaultValue: 'Bu dönem zaten kilitli durumda.' }),
    'Period is not locked': i18n.t('fiscalPeriods.errors.unlockFailed', { defaultValue: 'Bu dönem zaten açık durumda.' }),
    'Cannot delete a locked period': i18n.t('fiscalPeriods.errors.operationNotAllowed', { defaultValue: 'Kilitli dönem silinemez. Önce dönem kilidini açın.' }),
  };

  const errorTranslations: Record<string, string> = {
    
    // Validation Errors
    'Name already exists': 'Bu isim zaten kullanılıyor. Lütfen farklı bir isim seçin.',
    'Invalid date range': 'Geçersiz tarih aralığı. Bitiş tarihi başlangıç tarihinden sonra olmalıdır.',
    'Start date cannot be in the past': 'Başlangıç tarihi geçmişte olamaz.',
    'End date must be after start date': 'Bitiş tarihi başlangıç tarihinden sonra olmalıdır.',
    
    // Authentication Errors
    'Unauthorized': 'Bu işlem için yetkiniz bulunmuyor. Lütfen giriş yapın.',
    'Forbidden': 'Bu işlemi gerçekleştirme yetkiniz yok.',
    'Invalid credentials': 'Kullanıcı adı veya şifre hatalı.',
    'Token expired': 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.',
    
    // Network Errors
    'Network Error': 'Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.',
    'Request timeout': 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.',
    'Server error': 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.',
    
    // Generic Errors
    'Not found': 'Aradığınız kayıt bulunamadı.',
    'Bad request': 'Geçersiz istek. Lütfen girdiğiniz bilgileri kontrol edin.',
    'Internal server error': 'Sunucu hatası. Lütfen tekrar deneyin.',
    'Service unavailable': 'Servis şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.'
  };

  // Check for fiscal period errors first
  for (const [key, translation] of Object.entries(fiscalPeriodErrors)) {
    if (message.includes(key)) {
      return translation;
    }
  }

  // Check for other exact matches
  for (const [key, translation] of Object.entries(errorTranslations)) {
    if (message.includes(key)) {
      return translation;
    }
  }

  // Check for period lock error pattern
  if (message.includes('Cannot modify records in locked period')) {
    const periodMatch = message.match(/"([^"]+)"/);
    const periodName = periodMatch ? periodMatch[1] : 'kilitli dönem';
    return i18n.t('fiscalPeriods.errors.operationNotAllowed', { 
      defaultValue: `${periodName} kilitli olduğu için işlem yapılamaz. Önce dönem kilidini açınız.` 
    });
  }

  // Return original message if no translation found
  return message;
};

// Toast notification için error handler
export const handleApiError = (error: unknown, showToast?: (message: string, type: 'error' | 'success' | 'info') => void) => {
  const message = getErrorMessage(error);
  
  if (showToast) {
    showToast(message, 'error');
  }
  
  console.error('API Error:', error);
  return message;
};

// Form validation için error handler
export const getFieldError = (error: unknown, fieldName: string): string | undefined => {
  if (error && typeof error === 'object') {
    const maybe = error as { response?: { data?: { errors?: Record<string, string> } } };
    const val = maybe.response?.data?.errors?.[fieldName];
    if (typeof val === 'string') {
      return translateErrorMessage(val);
    }
  }
  
  return undefined;
};

export default {
  getErrorMessage,
  handleApiError,
  getFieldError
};