import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { userAPI, watchAPI } from '../utils/api';
import { Button, Card, Tabs } from '@radix-ui/themes';
import { Link } from 'react-router-dom';
import CompletedAnimeGrid from '../components/CompletedAnimeGrid';
import LastWatchedCard from '../components/LastWatchedCard';
import ScrollToTop from '../components/ScrollToTop';

export default function Profile() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [watchHistory, setWatchHistory] = useState([]);
  const [completedAnime, setCompletedAnime] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const [profileResponse, historyResponse, completedResponse] = await Promise.all([
          userAPI.getProfile(),
          watchAPI.getHistory(),
          watchAPI.getCompleted()
        ]);

        setProfile(profileResponse.data.data);
        setWatchHistory(historyResponse.data.data || []);
        setCompletedAnime(completedResponse.data.data || []);
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  if (loading) {
    return <div className="flex justify-center p-8">{t('common.loading')}</div>;
  }

  if (!profile) {
    return <div className="flex justify-center p-8">{t('profile.profileNotFound')}</div>;
  }

  const avgProgress = watchHistory.length > 0 
    ? Math.round(watchHistory.reduce((total, item) => total + (item.progress || 0), 0) / watchHistory.length)
    : 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Banner */}
      <div className="relative mb-8">
        {profile.banner ? (
          <div className="h-64 rounded-lg overflow-hidden">
            <img
              src={profile.banner}
              alt="Banner"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div class="h-64 bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg"></div>';
              }}
            />
          </div>
        ) : (
          <div className="h-64 bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg" />
        )}
        
        {/* Avatar - Overlapping banner */}
        <div className="absolute -bottom-16 left-8">
          <img
            src={profile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`}
            alt="Profile"
            className="w-32 h-32 rounded-full border-4 border-[#0d0d0f] object-cover bg-gray-800"
            onError={(e) => e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`}
          />
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-8 pt-20 pb-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-2">{profile.username}</h1>
            <p className="text-gray-400 mb-3">{profile.email}</p>
            {profile.bio && (
              <p className="text-gray-300 max-w-2xl mb-4 leading-relaxed">{profile.bio}</p>
            )}
            <div className="flex gap-4 text-sm text-gray-500">
              <span>
                📅 {t('profile.memberSince')} {new Date(profile.created_at).toLocaleDateString()}
              </span>
              {profile.last_login && (
                <span>• 🕑 {t('profile.lastLogin')}: {new Date(profile.last_login).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          <Link to="/edit-profile">
            <Button size="3">{t('profile.editProfile')}</Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6 text-center bg-[#1d1d20] border border-gray-700">
            <div className="text-3xl font-bold text-blue-500 mb-2">{watchHistory.length}</div>
            <div className="text-sm text-gray-400">{t('profile.totalWatched')}</div>
          </Card>
          <Card className="p-6 text-center bg-[#1d1d20] border border-gray-700">
            <div className="text-3xl font-bold text-green-500 mb-2">{completedAnime.length}</div>
            <div className="text-sm text-gray-400">{t('profile.completed')}</div>
          </Card>
          <Card className="p-6 text-center bg-[#1d1d20] border border-gray-700">
            <div className="text-3xl font-bold text-purple-500 mb-2">{avgProgress}%</div>
            <div className="text-sm text-gray-400">{t('profile.avgProgress')}</div>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8">
        <Tabs.Root defaultValue="watching">
          <Tabs.List>
            <Tabs.Trigger value="watching">{t('profile.continueWatching')}</Tabs.Trigger>
            <Tabs.Trigger value="completed">{t('profile.completed')}</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="watching" className="mt-6">
            <div className="space-y-4">
              {watchHistory.length > 0 ? (
                watchHistory.map((anime) => (
                  <LastWatchedCard key={anime.id} anime={anime} />
                ))
              ) : (
                <div className="text-center py-12 text-gray-400 border border-gray-700 rounded-lg bg-[#1d1d20]">
                  {t('profile.noWatchHistory')}
                </div>
              )}
            </div>
          </Tabs.Content>

          <Tabs.Content value="completed" className="mt-6">
            {completedAnime.length > 0 ? (
              <CompletedAnimeGrid animes={completedAnime} />
            ) : (
              <div className="text-center py-12 text-gray-400 border border-gray-700 rounded-lg bg-[#1d1d20]">
                {t('profile.noAnime')}
              </div>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </div>

      {/* Scroll to Top Button */}
      <ScrollToTop />
    </div>
  );
}
