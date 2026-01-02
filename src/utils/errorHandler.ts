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
      return i18n.t('common.networkError');
    }
  }
  
  // Default error
  return i18n.t('common.unexpectedError');
};

// Error mesajlarını çevir
const translateErrorMessage = (message: string): string => {
  // Mali dönem hataları için i18n kullan
  const fiscalPeriodErrors: Record<string, string> = {
    'Fiscal period overlaps with existing period': i18n.t('fiscalPeriods.validation.periodOverlap'),
    'Period is already locked': i18n.t('fiscalPeriods.errors.periodLocked'),
    'Period is not locked': i18n.t('fiscalPeriods.errors.unlockFailed'),
    'Cannot delete a locked period': i18n.t('fiscalPeriods.errors.operationNotAllowed'),
  };

  const errorTranslations: Record<string, string> = {
    
    // Validation Errors
    'Name already exists': i18n.t('common.apiErrors.nameAlreadyExists'),
    'Invalid date range': i18n.t('common.apiErrors.invalidDateRange'),
    'Start date cannot be in the past': i18n.t('common.apiErrors.startDatePast'),
    'End date must be after start date': i18n.t('common.apiErrors.endDateAfterStart'),
    
    // Authentication Errors
    'Unauthorized': i18n.t('common.apiErrors.unauthorized'),
    'Forbidden': i18n.t('common.apiErrors.forbidden'),
    'Invalid credentials': i18n.t('common.apiErrors.invalidCredentials'),
    'Token expired': i18n.t('common.apiErrors.tokenExpired'),
    
    // Network Errors
    'Network Error': i18n.t('common.networkError'),
    'Request timeout': i18n.t('common.apiErrors.requestTimeout'),
    'Server error': i18n.t('common.apiErrors.serverError'),
    
    // Generic Errors
    'Not found': i18n.t('common.apiErrors.notFound'),
    'Bad request': i18n.t('common.apiErrors.badRequest'),
    'Internal server error': i18n.t('common.apiErrors.internalServerError'),
    'Service unavailable': i18n.t('common.apiErrors.serviceUnavailable')
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
    const periodName = periodMatch ? periodMatch[1] : i18n.t('fiscalPeriods.lockedPeriodFallbackName');
    return i18n.t('fiscalPeriods.errors.operationNotAllowedWithPeriod', { periodName });
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