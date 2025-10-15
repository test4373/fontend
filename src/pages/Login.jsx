import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@radix-ui/themes';
import { getSavedCredentials, saveCredentials, clearSavedCredentials } from '../utils/encryption';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Auto-fill from saved credentials
  useEffect(() => {
    const savedCreds = getSavedCredentials();
    if (savedCreds) {
      setFormData({
        identifier: savedCreds.username,
        password: savedCreds.password
      });
      setRememberMe(true);
      console.log('✅ Auto-filled credentials for:', savedCreds.username);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await login(formData.identifier, formData.password);

    setLoading(false);

    if (result.success) {
      // Save credentials if "Remember Me" is checked
      if (rememberMe) {
        saveCredentials(formData.identifier, formData.password);
      } else {
        clearSavedCredentials();
      }
      navigate('/');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[#0d0d0f]">
      <div className="w-full max-w-md p-8 bg-[#1d1d20] border border-gray-700 rounded-lg">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">{t('auth.login')}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">
              {t('auth.usernameOrEmail')}
            </label>
            <input
              type="text"
              value={formData.identifier}
              onChange={(e) => setFormData({...formData, identifier: e.target.value})}
              className="w-full p-3 bg-[#2d2d30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
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

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            size="3"
          >
            {loading ? t('common.loading') : t('auth.login')}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-400">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-blue-500 hover:underline">
            {t('auth.register')}
          </Link>
        </p>
      </div>
    </div>
  );
}
