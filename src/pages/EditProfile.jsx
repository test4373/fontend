import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../utils/api';
import { Button, Tabs } from '@radix-ui/themes';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { validateUsername, suggestUsername, getUsernameSuggestions } from '../utils/profanityFilter';

// Backend URL from environment variable  
const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://zens23.onrender.com/api';

const EditProfile = () => {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  
  // Profile data
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    avatar: '',
    banner: '',
    email: ''
  });
  const [usernameErrors, setUsernameErrors] = useState([]);
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);
  
  // Password change
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // File uploads
  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [bannerPreview, setBannerPreview] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        bio: user.bio || '',
        avatar: user.avatar || '',
        banner: user.banner || '',
        email: user.email || ''
      });
      setAvatarPreview(user.avatar || '');
      setBannerPreview(user.banner || '');
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Validate username in real-time
    if (name === 'username') {
      const validation = validateUsername(value);
      setUsernameErrors(validation.errors);
      
      if (!validation.isValid) {
        const suggestions = getUsernameSuggestions(value);
        setUsernameSuggestions(suggestions.slice(0, 3));
      } else {
        setUsernameSuggestions([]);
      }
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('profile.avatarTypeError'));
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleBannerChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('profile.avatarTypeError'));
        return;
      }
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  };

  const uploadImage = async (file, type) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', type);

    try {
      // Imgur API kullanarak upload (veya kendi backend'inize)
      // Şimdilik base64'e çevirip göndereceğiz
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch (error) {
      throw new Error('Resim yüklenemedi');
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData = {};
      
      // Bio - always send if exists
      if (formData.bio !== undefined) {
        updateData.bio = formData.bio.trim();
      }
      
      // Upload avatar if file selected
      if (avatarFile) {
        console.log('💼 Uploading avatar file...');
        const avatarUrl = await uploadImage(avatarFile, 'avatar');
        updateData.avatar = avatarUrl;
      } else if (formData.avatar && formData.avatar.trim()) {
        updateData.avatar = formData.avatar.trim();
      }
      
      // Upload banner if file selected
      if (bannerFile) {
        console.log('🇫 Uploading banner file...');
        const bannerUrl = await uploadImage(bannerFile, 'banner');
        updateData.banner = bannerUrl;
      } else if (formData.banner && formData.banner.trim()) {
        updateData.banner = formData.banner.trim();
      }

      console.log('📤 Sending update data:', JSON.stringify(updateData, null, 2));
      console.log('🔑 Keys:', Object.keys(updateData));
      console.log('📊 Count:', Object.keys(updateData).length);
      
      await userAPI.updateProfile(updateData);
      
      // Profil bilgilerini yeniden çek
      const profileResponse = await userAPI.getProfile();
      updateUser(profileResponse.data.data);
      
      toast.success(t('profile.updated'));
      
      setTimeout(() => navigate('/profile'), 1000);
    } catch (error) {
      console.error('❌ Update error:', error);
      const errorMessage = error.response?.data?.message || t('profile.updateError');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailUpdate = async () => {
    try {
      if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
        toast.error(t('profile.emailError'));
        throw new Error('Invalid email');
      }

      await axios.put(`${BACKEND_URL}/users/change-email`, {
        newEmail: formData.email
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const profileResponse = await userAPI.getProfile();
      updateUser(profileResponse.data.data);
      
      toast.success(t('profile.emailUpdated'));
    } catch (error) {
      console.error('Email update error:', error);
      toast.error(error.response?.data?.message || t('profile.emailUpdateError'));
      throw error;
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(t('profile.passwordMismatchError'));
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error(t('profile.passwordLengthError'));
      return;
    }

    setLoading(true);

    try {
      await axios.put(`${BACKEND_URL}/users/change-password`, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      toast.success(t('profile.passwordUpdated'));
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Password update error:', error);
      toast.error(error.response?.data?.message || t('profile.passwordUpdateError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{t('profile.editProfile')}</h1>

      <Tabs.Root defaultValue="profile">
        <Tabs.List>
          <Tabs.Trigger value="profile">{t('profile.profileInfo')}</Tabs.Trigger>
          <Tabs.Trigger value="account">{t('profile.accountSettings')}</Tabs.Trigger>
          <Tabs.Trigger value="security">{t('profile.security')}</Tabs.Trigger>
        </Tabs.List>

        {/* Profil Bilgileri Tab */}
        <Tabs.Content value="profile" className="mt-6">
          <form onSubmit={handleProfileUpdate} className="space-y-6">
            {/* Bio */}
            <div>
              <label className="block text-sm font-medium mb-2">{t('profile.bio')}</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                placeholder={t('profile.bioPlaceholder') || 'Tell us about yourself...'}
                className="w-full p-3 bg-[#1d1d20] border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                rows={4}
                maxLength={500}
              />
              <p className="text-sm text-gray-400 mt-1">{formData.bio.length}/500</p>
            </div>

            {/* Avatar Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">{t('profile.avatar')}</label>
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="w-full p-3 bg-[#1d1d20] border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('profile.orEnterUrl')}</p>
                  <input
                    type="url"
                    name="avatar"
                    value={formData.avatar}
                    onChange={handleInputChange}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full p-3 bg-[#1d1d20] border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 mt-2"
                  />
                </div>
                {avatarPreview && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">{t('profile.preview')}:</p>
                    <img 
                      src={avatarPreview} 
                      alt="Avatar preview" 
                      className="w-24 h-24 rounded-full object-cover border-2 border-gray-600" 
                      onError={(e) => e.target.style.display = 'none'} 
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Banner Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">{t('profile.banner')}</label>
              <div className="space-y-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBannerChange}
                  className="w-full p-3 bg-[#1d1d20] border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
                <p className="text-xs text-gray-500">{t('profile.orEnterUrl')}</p>
                <input
                  type="url"
                  name="banner"
                  value={formData.banner}
                  onChange={handleInputChange}
                  placeholder="https://example.com/banner.jpg"
                  className="w-full p-3 bg-[#1d1d20] border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                />
                {bannerPreview && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">{t('profile.preview')}:</p>
                    <img 
                      src={bannerPreview} 
                      alt="Banner preview" 
                      className="w-full h-40 object-cover rounded-lg border-2 border-gray-600" 
                      onError={(e) => e.target.style.display = 'none'} 
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="soft" 
                onClick={() => navigate('/profile')} 
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? t('common.loading') : t('profile.saveChanges')}
              </Button>
            </div>
          </form>
        </Tabs.Content>

        {/* Hesap Ayarları Tab */}
        <Tabs.Content value="account" className="mt-6">
          <form onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            
            try {
              // Update username if changed
              if (formData.username !== user?.username) {
                const validation = validateUsername(formData.username);
                if (!validation.isValid) {
                  toast.error('Kullanıcı adı geçersiz', {
                    description: validation.errors[0]
                  });
                  setLoading(false);
                  return;
                }
                
                await axios.put(`${BACKEND_URL}/users/change-username`, {
                  newUsername: formData.username
                }, {
                  headers: {
                    Authorization: `Bearer ${localStorage.getItem('auth_token')}`
                  }
                });
                
                toast.success('Kullanıcı adı değiştirildi');
              }
              
              // Update email if changed
              if (formData.email !== user?.email) {
                await handleEmailUpdate(e);
              } else {
                // Refresh profile
                const profileResponse = await userAPI.getProfile();
                updateUser(profileResponse.data.data);
                
                setTimeout(() => navigate('/profile'), 500);
              }
            } catch (error) {
              console.error('Account update error:', error);
              toast.error(error.response?.data?.message || 'Güncelleme başarısız');
            } finally {
              setLoading(false);
            }
          }} className="space-y-6">
            {/* Username Change */}
            <div>
              <label className="block text-sm font-medium mb-2">{t('profile.username')}</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className={`w-full p-3 bg-[#1d1d20] border ${
                  usernameErrors.length > 0 ? 'border-red-500' : 'border-gray-700'
                } rounded-lg focus:outline-none focus:border-blue-500`}
                required
                minLength={3}
                maxLength={20}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('profile.currentUsername')}: {user?.username}
              </p>
              
              {/* Username Errors */}
              {usernameErrors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {usernameErrors.map((error, i) => (
                    <p key={i} className="text-xs text-red-400">❌ {error}</p>
                  ))}
                </div>
              )}
              
              {/* Username Suggestions */}
              {usernameSuggestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-2">💡 Öneriler:</p>
                  <div className="flex gap-2 flex-wrap">
                    {usernameSuggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, username: suggestion }));
                          setUsernameErrors([]);
                          setUsernameSuggestions([]);
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('profile.email')}</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full p-3 bg-[#1d1d20] border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">{t('profile.currentEmail')}: {user?.email}</p>
            </div>

            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="soft" 
                onClick={() => navigate('/profile')} 
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? t('common.loading') : t('profile.updateEmail')}
              </Button>
            </div>
          </form>
        </Tabs.Content>

        {/* Güvenlik Tab */}
        <Tabs.Content value="security" className="mt-6">
          <form onSubmit={handlePasswordUpdate} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">{t('profile.currentPassword')}</label>
              <input
                type="password"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                className="w-full p-3 bg-[#1d1d20] border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('profile.newPassword')}</label>
              <input
                type="password"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                className="w-full p-3 bg-[#1d1d20] border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                required
                minLength={8}
              />
              <p className="text-xs text-gray-500 mt-1">{t('profile.passwordRequirements')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('profile.confirmPassword')}</label>
              <input
                type="password"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                className="w-full p-3 bg-[#1d1d20] border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="soft" 
                onClick={() => navigate('/profile')} 
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={loading} className="flex-1" color="red">
                {loading ? t('common.loading') : t('profile.updatePassword')}
              </Button>
            </div>
          </form>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
};

export default EditProfile;
