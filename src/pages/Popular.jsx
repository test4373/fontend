import { useState, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Spinner } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import AnimeCard from '../components/AnimeCard';
import SkeletonAnimeCard from '../skeletons/SkeletonAnimeCard';
import { getTopAnime } from '../utils/helper';

export default function Popular() {
  const { t } = useTranslation();
  const [topAnime, setTopAnime] = useState([]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    error: infiniteQueryError
  } = useInfiniteQuery({
    queryKey: ['popular_animes'],
    queryFn: ({ pageParam = 1 }) => getTopAnime(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      return allPages.length + 1;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 // 1 hour
  });

  useEffect(() => {
    if (infiniteQueryError) {
      toast.error(t('home.failedTopAnime') || 'Popüler anime listesi yüklenemedi', {
        icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
        description: infiniteQueryError?.message,
        classNames: {
          title: 'text-rose-500'
        }
      });
    }
  }, [infiniteQueryError, t]);

  useEffect(() => {
    if (data) {
      const newTopAnime = data.pages
        .map((page) => page)
        .flat()
        .filter(Boolean);
      setTopAnime(newTopAnime);
    }
  }, [data]);

  return (
    <div className="select-none font-space-mono tracking-tight min-h-screen">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-violet-900/30 to-purple-900/30 py-16 px-8 mb-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
            🔥 Popüler Animeler
          </h1>
          <p className="text-gray-300 text-lg">
            En popüler ve en çok izlenen anime serileri
          </p>
          <div className="mt-4 flex gap-4 text-sm text-gray-400">
            <span>📊 {topAnime.length}+ Anime</span>
            <span>⭐ En Yüksek Puanlılar</span>
            <span>👥 En Çok İzlenenler</span>
          </div>
        </div>
      </div>

      {/* Error State */}
      {infiniteQueryError && (
        <div className="text-center py-12 mx-8">
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-red-400 mb-2">❌ Hata</h3>
            <p className="text-gray-300">{infiniteQueryError.message}</p>
          </div>
        </div>
      )}

      {/* Anime Grid */}
      {!infiniteQueryError && (
        <div className="mx-5">
          <InfiniteScroll
            style={{ all: 'unset' }}
            dataLength={topAnime.length}
            next={() => fetchNextPage()}
            hasMore={topAnime?.length < 500}
            loader={
              <div className="flex items-center justify-center gap-x-2 overflow-hidden py-8">
                <h4>{t('common.loading') || 'Yükleniyor...'}</h4>
                <Spinner />
              </div>
            }
            endMessage={
              <div className="text-center py-12 text-gray-400">
                <p className="text-xl mb-2">🎉 Tüm animeleri gördünüz!</p>
                <p className="text-sm">Toplam {topAnime.length} anime listelendi</p>
              </div>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg2:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-9 gap-4">
              {topAnime?.map((anime, index) => (
                <div key={anime.id + 'popularAnime' + index} className="transform transition-transform hover:scale-105">
                  <AnimeCard data={anime} />
                </div>
              ))}
              {isFetching && (
                <>
                  <SkeletonAnimeCard />
                  <SkeletonAnimeCard />
                  <SkeletonAnimeCard />
                  <SkeletonAnimeCard />
                  <SkeletonAnimeCard />
                  <SkeletonAnimeCard />
                  <SkeletonAnimeCard />
                </>
              )}
            </div>
          </InfiniteScroll>
        </div>
      )}
    </div>
  );
}
