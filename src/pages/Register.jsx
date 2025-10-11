import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@radix-ui/themes';
import { saveCredentials } from '../utils/encryption';

export default function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (formData.username.length < 3 || formData.username.length > 20) {
      newErrors.username = 'Kullanıcı adı 3-20 karakter arası olmalı';
    }

    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Geçerli bir email adresi girin';
    }

    if (formData.password.length < 8) {
      newErrors.password = 'Şifre en az 8 karakter olmalı';
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Şifre büyük harf, küçük harf ve rakam içermeli';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Şifreler eşleşmiyor';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);

    const result = await register(formData.username, formData.email, formData.password);

    setLoading(false);
    if (result.success) {
      // Save credentials if "Remember Me" is checked
      if (rememberMe) {
        saveCredentials(formData.username, formData.password);
      }
      navigate('/');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[#0d0d0f]">
      <div className="w-full max-w-md p-8 bg-[#1d1d20] border border-gray-700 rounded-lg">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">{t('auth.register')}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">
              {t('auth.username')}
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              className="w-full p-3 bg-[#2d2d30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
            {errors.username && <p className="mt-1 text-sm text-red-500">{errors.username}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">
              {t('auth.email')}
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full p-3 bg-[#2d2d30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full p-3 bg-[#2d2d30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
            {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">
              {t('auth.confirmPassword')}
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              className="w-full p-3 bg-[#2d2d30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
            {errors.confirmPassword && <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-[#2d2d30] text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="rememberMe" className="text-sm text-gray-300">
              {t('auth.rememberMe')}
            </label>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            size="3"
          >
            {loading ? t('common.loading') : t('auth.register')}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-400">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="text-blue-500 hover:underline">
            {t('auth.login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
