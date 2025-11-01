import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, Building2, UserPlus, Phone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const { register, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    company: '',
    phone: '',
    address: ''
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Form doğrulama
    if (!formData.name || !formData.email || !formData.password) {
      setError('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    if (formData.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      return;
    }

    if (!agreedToTerms) {
      setError('Kullanım Koşulları ve Gizlilik Politikasını kabul etmelisiniz');
      return;
    }

    try {
      // Kayıt işlemi
      const userData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        company: formData.company,
        phone: formData.phone,
        address: formData.address
      };
      
      await register(userData);
      setSuccess('Hesabınız başarıyla oluşturuldu! Giriş yapabilirsiniz.');
      
      // 2 saniye sonra giriş sayfasına yönlendir
      setTimeout(() => {
        window.location.href = '#login';
      }, 2000);
      
    } catch (error: any) {
      setError(error.message || 'Kayıt sırasında bir hata oluştu');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center shadow-lg">
              <UserPlus className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Hesap Oluştur
          </h1>
          <p className="text-gray-600">
            Ücretsiz hesabınızı oluşturun ve hemen başlayın
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center space-x-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                <span>{error}</span>
              </div>
            )}
            
            {success && (
              <div className="flex items-center space-x-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-600">
                <span>{success}</span>
              </div>
            )}

            {/* Ad Soyad */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ad Soyad *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200"
                  placeholder="Adınızı ve soyadınızı girin"
                  required
                />
              </div>
            </div>

            {/* E-posta */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                E-posta Adresi *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200"
                  placeholder="ornek@email.com"
                  required
                />
              </div>
            </div>

            {/* Şirket */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Şirket Adı
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200"
                  placeholder="Şirket adınız (opsiyonel)"
                />
              </div>
            </div>

            {/* Telefon */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Telefon
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200"
                  placeholder="0555 123 45 67 (opsiyonel)"
                />
              </div>
            </div>

            {/* Şifre */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Şifre *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200"
                  placeholder="En az 6 karakter"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Şifre Onay */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Şifre Onayı *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200"
                  placeholder="Şifrenizi tekrar girin"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Terms and Privacy Checkbox */}
            <div className="flex items-start space-x-3">
              <input
                id="terms-checkbox"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded"
              />
              <label htmlFor="terms-checkbox" className="text-sm text-gray-600 leading-5">
                <a 
                  href="#legal/terms" 
                  target="_blank"
                  className="text-gray-900 hover:text-gray-700 underline transition-colors"
                >
                  Kullanım Koşulları
                </a>
                {' ve '}
                <a 
                  href="#legal/dpa" 
                  target="_blank"
                  className="text-gray-900 hover:text-gray-700 underline transition-colors"
                >
                  Veri İşleme Sözleşmesi
                </a>
                {'ni kabul ediyor, '}
                <a 
                  href="#legal/privacy" 
                  target="_blank"
                  className="text-gray-900 hover:text-gray-700 underline transition-colors"
                >
                  Gizlilik Politikası
                </a>
                {' ve '}
                <a 
                  href="#legal/cookies" 
                  target="_blank"
                  className="text-gray-900 hover:text-gray-700 underline transition-colors"
                >
                  Çerez Politikası
                </a>
                {'nı okuduğunuzu onaylıyorsunuz.'}
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-900 text-white font-semibold py-3 px-4 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Hesap Oluştur</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-8">
            <p className="text-sm text-gray-600">
              Zaten hesabınız var mı?{' '}
              <button 
                onClick={() => window.location.href = '#login'}
                className="text-gray-900 hover:text-gray-700 font-semibold transition-colors"
              >
                Giriş yapın
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}