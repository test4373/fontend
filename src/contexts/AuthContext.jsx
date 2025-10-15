import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, userAPI } from '../utils/api';
import { toast } from 'sonner';
import { clearSavedCredentials, hasRememberedUser } from '../utils/encryption';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Sayfa yüklendiğinde kullanıcı bilgilerini kontrol et
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');

      if (token && userData) {
        try {
          setUser(JSON.parse(userData));
          setIsAuthenticated(true);
          
          // Token'ın geçerliliğini kontrol et
          const response = await userAPI.getProfile();
          setUser(response.data.data);
          localStorage.setItem('user_data', JSON.stringify(response.data.data));
        } catch (error) {
          // Token geçersiz
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (identifier, password) => {
    try {
      const response = await authAPI.login({ identifier, password });
      const { token, ...userData } = response.data.data;

      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_data', JSON.stringify(userData));
      
      setUser(userData);
      setIsAuthenticated(true);

      toast.success('Giriş başarılı!', {
        description: `Hoş geldin, ${userData.username}!`
      });

      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Giriş başarısız';
      toast.error('Giriş Hatası', {
        description: message
      });
      return { success: false, message };
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await authAPI.register({ username, email, password });
      const { token, ...userData } = response.data.data;

      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_data', JSON.stringify(userData));
      
      setUser(userData);
      setIsAuthenticated(true);

      toast.success('Kayıt başarılı!', {
        description: `Hoş geldin, ${userData.username}!`
      });

      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Kayıt başarısız';
      toast.error('Kayıt Hatası', {
        description: message
      });
      return { success: false, message };
    }
  };

  const logout = async (clearRememberedCredentials = false) => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      
      // Clear remembered credentials only if explicitly requested
      if (clearRememberedCredentials) {
        clearSavedCredentials();
        console.log('🗑️ Cleared remembered credentials');
      } else if (hasRememberedUser()) {
        console.log('💾 Kept remembered credentials for next login');
      }
      
      setUser(null);
      setIsAuthenticated(false);
      toast.success('Çıkış yapıldı');
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user_data', JSON.stringify(userData));
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
