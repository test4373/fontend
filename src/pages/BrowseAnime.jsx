import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Select } from '@radix-ui/themes';
import { toast } from 'sonner';
import CenteredLoader from '../ui/CenteredLoader';
import AnimeCard from '../components/AnimeCard';
import { BASE_URL_ANILIST } from '../utils/api';
import ScrollToTop from '../components/ScrollToTop';

const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 
  'Horror', 'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological',
  'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
  'Hentai', 'Historical', 'Isekai', 'Josei', 'Kids', 'Martial Arts',
  'Military', 'Parody', 'Police', 'School', 'Seinen', 'Shoujo',
  'Shoujo Ai', 'Shounen', 'Shounen Ai', 'Space', 'Super Power', 'Vampire',
  'Yaoi', 'Yuri'
];

const YEARS = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);

const getSeasons = (t) => [
  { value: 'WINTER', label: t('browse.seasons.winter') },
  { value: 'SPRING', label: t('browse.seasons.spring') },
  { value: 'SUMMER', label: t('browse.seasons.summer') },
  { value: 'FALL', label: t('browse.seasons.fall') }
];

const getFormats = (t) => [
  { value: 'TV', label: t('browse.formats.tv') },
  { value: 'TV_SHORT', label: t('browse.formats.tvShort') },
  { value: 'MOVIE', label: t('browse.formats.movie') },
  { value: 'SPECIAL', label: t('browse.formats.special') },
  { value: 'OVA', label: t('browse.formats.ova') },
  { value: 'ONA', label: t('browse.formats.ona') },
  { value: 'MUSIC', label: t('browse.formats.music') }
];

const getStatuses = (t) => [
  { value: 'RELEASING', label: t('browse.statuses.airing') },
  { value: 'FINISHED', label: t('browse.statuses.finished') },
  { value: 'NOT_YET_RELEASED', label: t('browse.statuses.notYetAired') },
  { value: 'CANCELLED', label: t('browse.statuses.cancelled') }
];

const getSortOptions = (t) => [
  { value: 'POPULARITY_DESC', label: t('browse.sortOptions.popularity') },
  { value: 'SCORE_DESC', label: t('browse.sortOptions.score') },
  { value: 'TRENDING_DESC', label: t('browse.sortOptions.trending') },
  { value: 'FAVOURITES_DESC', label: t('browse.sortOptions.favorites') },
  { value: 'START_DATE_DESC', label: t('browse.sortOptions.recentlyAdded') },
  { value: 'TITLE_ROMAJI', label: t('browse.sortOptions.titleAZ') }
];

export default function BrowseAnime() {
  const { t } = useTranslation();
  
  const SORT_OPTIONS = getSortOptions(t);
  const SEASONS = getSeasons(t);
  const FORMATS = getFormats(t);
  const STATUSES = getStatuses(t);
  const [animeList, setAnimeList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);

  // Filters
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [sortBy, setSortBy] = useState('POPULARITY_DESC');

  const fetchAnime = async (resetPage = false, pageNum = null) => {
    setLoading(true);
    const currentPage = resetPage ? 1 : (pageNum || page);
    
    console.log('🔍 Fetching anime with filters:', {
      page: currentPage,
      genres: selectedGenres,
      year: selectedYear,
      season: selectedSeason,
      format: selectedFormat,
      status: selectedStatus,
      sort: sortBy
    });

    const query = `
      query ($page: Int, $perPage: Int, $genre_in: [String], $year: Int, $season: MediaSeason, $format: MediaFormat, $status: MediaStatus, $sort: [MediaSort]) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            hasNextPage
            total
            currentPage
          }
          media(
            type: ANIME
            genre_in: $genre_in
            seasonYear: $year
            season: $season
            format: $format
            status: $status
            sort: $sort
            isAdult: false
          ) {
            id
            idMal
            title {
              romaji
              english
              native
            }
            coverImage {
              extraLarge
              large
            }
            bannerImage
            startDate {
              year
              month
              day
            }
            format
            status
            episodes
            season
            seasonYear
            averageScore
            popularity
            genres
            description
            relations {
              edges {
                relationType
                node {
                  id
                  format
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      page: currentPage,
      perPage: 100,
      sort: [sortBy]
    };
    
    // Sadece dolu filtreleri ekle
    if (selectedGenres.length > 0) {
      variables.genre_in = selectedGenres;
    }
    if (selectedYear) {
      variables.year = selectedYear;
    }
    if (selectedSeason) {
      variables.season = selectedSeason;
    }
    if (selectedFormat) {
      variables.format = selectedFormat;
    }
    if (selectedStatus) {
      variables.status = selectedStatus;
    }
    
    console.log('📦 Final variables:', variables);

    try {
      const response = await fetch(BASE_URL_ANILIST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });

      const result = await response.json();
      
      if (result.errors) {
        console.error('❌ GraphQL errors:', result.errors);
        throw new Error(result.errors[0].message);
      }
      
      const { data } = result;
      
      // Filter out sequels
      const results = data.Page.media;
      const filtered = results.filter(anime => {
        const isSequel = anime.relations?.edges?.some(edge => 
          edge.relationType === 'PREQUEL' && edge.node.format === 'TV'
        );
        return !isSequel;
      });
      
      console.log(`✅ Browse: ${results.length} -> ${filtered.length} (removed sequels)`);
      console.log('📄 Page info:', data.Page.pageInfo);
      
      if (resetPage) {
        setAnimeList(filtered);
        setPage(1);
      } else {
        setAnimeList(prev => [...prev, ...filtered]);
      }
      
      setHasNextPage(data.Page.pageInfo.hasNextPage);
    } catch (error) {
      console.error('❌ Error fetching anime:', error);
      toast.error('Error loading anime: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchAnime(true);
  }, [selectedGenres, selectedYear, selectedSeason, selectedFormat, selectedStatus, sortBy]);

  const handleGenreToggle = (genre) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchAnime(false, nextPage);
  };

  const handleClearFilters = () => {
    setSelectedGenres([]);
    setSelectedYear(null);
    setSelectedSeason(null);
    setSelectedFormat(null);
    setSelectedStatus(null);
    setSortBy('POPULARITY_DESC');
  };

  return (
    <div className="p-12">
      <div className="border-b border-gray-700 pb-3 mb-6">
        <h1 className="font-space-mono text-2xl tracking-wider">{t('browse.title')}</h1>
      </div>

      {/* Filters Section */}
      <div className="mb-8 p-6 bg-[#1d1d20] border border-gray-700 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{t('browse.filters')}</h2>
          <Button variant="soft" onClick={handleClearFilters}>{t('browse.clearAll')}</Button>
        </div>

        {/* Sort */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">{t('browse.sortBy')}</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full p-3 bg-[#0d0d0f] border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
          >
            {SORT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Year */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('browse.year')}</label>
            <select
              value={selectedYear || ''}
              onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full p-3 bg-[#0d0d0f] border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="">{t('browse.allYears')}</option>
              {YEARS.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Season */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('browse.season')}</label>
            <select
              value={selectedSeason || ''}
              onChange={(e) => setSelectedSeason(e.target.value || null)}
              className="w-full p-3 bg-[#0d0d0f] border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="">{t('browse.allSeasons')}</option>
              {SEASONS.map(season => (
                <option key={season.value} value={season.value}>{season.label}</option>
              ))}
            </select>
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('browse.format')}</label>
            <select
              value={selectedFormat || ''}
              onChange={(e) => setSelectedFormat(e.target.value || null)}
              className="w-full p-3 bg-[#0d0d0f] border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="">{t('browse.allFormats')}</option>
              {FORMATS.map(format => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('browse.status')}</label>
            <select
              value={selectedStatus || ''}
              onChange={(e) => setSelectedStatus(e.target.value || null)}
              className="w-full p-3 bg-[#0d0d0f] border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="">{t('browse.allStatus')}</option>
              {STATUSES.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Genres */}
        <div>
          <label className="block text-sm font-medium mb-3">{t('browse.genres')}</label>
          <div className="flex flex-wrap gap-2">
            {GENRES.map(genre => (
              <Button
                key={genre}
                variant={selectedGenres.includes(genre) ? "solid" : "soft"}
                color={selectedGenres.includes(genre) ? "blue" : "gray"}
                onClick={() => handleGenreToggle(genre)}
                size="2"
              >
                {genre}
              </Button>
            ))}
          </div>
          {selectedGenres.length > 0 && (
            <p className="text-sm text-gray-400 mt-2">
              {t('browse.selected')}: {selectedGenres.join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      {loading && page === 1 ? (
        <CenteredLoader />
      ) : (
        <>
          <div className="mb-4 text-gray-400">
            {t('browse.showing')} {animeList.length} {t('browse.anime')}
          </div>

          <div className="grid animate-fade grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {animeList.map((anime) => (
              <AnimeCard key={anime.id} data={anime} />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center mt-8">
              <Button 
                size="3" 
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? t('common.loading') : t('browse.loadMore')}
              </Button>
            </div>
          )}

          {animeList.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-400">
              {t('browse.noResults')}
            </div>
          )}
        </>
      )}

      {/* Scroll to Top Button */}
      <ScrollToTop />
    </div>
  );
}
