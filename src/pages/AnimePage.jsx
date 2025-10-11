import { Link, useParams, useNavigate } from 'react-router-dom'
import useGetAnimeById from '../hooks/useGetAnimeById'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useState, useEffect, useRef } from 'react'
import CenteredLoader from '../ui/CenteredLoader'
import Episode from '../components/Episode'
import CommentSection from '../components/CommentSection'
import ScrollToTop from '../components/ScrollToTop'
import { Button, DropdownMenu, Skeleton } from '@radix-ui/themes'
import { toast } from 'sonner'
import { ExclamationTriangleIcon, PersonIcon, StarIcon, ChatBubbleIcon } from '@radix-ui/react-icons'
import useGetAniZipMappings from '../hooks/useGetAniZipMappings'
import useGetAnimeByMalId from '../hooks/useGetAnimeByMalId'
import { autop } from '@wordpress/autop'
import parse from 'html-react-parser'
import { useZenshinContext } from '../utils/ContextProvider'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'

export default function AnimePage() {
  const { t } = useTranslation()
  const zenshinContext = useZenshinContext()
  const { glow } = zenshinContext
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const commentSectionRef = useRef(null)

  const animeId = useParams().animeId
  const { isLoading, animeData, error, status } = useGetAnimeById(animeId)
  const [relatedSeasons, setRelatedSeasons] = useState([])
  const malId = animeData?.idMal
  const episodesWatched = animeData?.mediaListEntry?.progress || 0
  const [quality, setQuality] = useState('All')
  const {
    isLoading: isLoadingMappings,
    data: mappingsData,
    error: errorMappings,
    status: statusMappings
  } = useGetAniZipMappings(animeId)

  const {
    isLoading: isLoadingMalId,
    data: malIdData,
    error: errorMalId,
    status: statusMalId
  } = useGetAnimeByMalId(malId || null)

  let episodesAnizip = mappingsData?.episodes
  let aniZip_titles = {
    en: '',
    ja: '',
    xJat: '',
    malTitleRomaji: '',
    malTitleEnglish: ''
  }
  if (mappingsData?.titles) {
    aniZip_titles.en = mappingsData?.titles?.en || ''
    aniZip_titles.ja = mappingsData?.titles?.ja || ''
    aniZip_titles.xJat = mappingsData?.titles['x-jat'] || ''
    aniZip_titles.malTitleRomaji = malIdData?.data?.titles[0]?.title || ''
    aniZip_titles.malTitleEnglish = malIdData?.data?.titles[4]?.title || ''
  }

  if (episodesAnizip) {
    episodesAnizip = Object.keys(episodesAnizip)?.map((key) => episodesAnizip[key])
    let tempEps = episodesAnizip.map((ep) => {
      if (isNaN(ep.episode)) return null
      return {
        epNum: ep.episode,
        title: ep.title.en || ep.title['x-jat'] || ep.title.jp || `${t('newReleaseCard.episode')} ${ep.episode}`,
        thumbnail: ep.image,
        airdate: ep.airdate,
        overview: ep.overview,
        aids: mappingsData?.mappings?.anidb_id,
        eids: ep.anidbEid
      }
    })

    // remove null values
    tempEps = tempEps.filter((ep) => ep !== null)
    episodesAnizip = tempEps
  }

  const [dualAudio, setDualAudio] = useState(false)
  const [hideWatchedEpisodes, setHideWatchedEpisodes] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState('all')
  const [availableSeasons, setAvailableSeasons] = useState(['all'])

  const scrollToComments = () => {
    commentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => {
      const textarea = commentSectionRef.current?.querySelector('textarea')
      textarea?.focus()
    }, 800)
  }

  // Extract related seasons (sequels/prequels)
  useEffect(() => {
    if (animeData?.relations) {
      const seasons = [];
      const relations = animeData.relations.edges || [];
      
      // Find prequels
      const prequels = relations
        .filter(edge => edge.relationType === 'PREQUEL' && edge.node.format === 'TV')
        .map(edge => ({
          id: edge.node.id,
          title: edge.node.title.romaji || edge.node.title.english,
          type: 'prequel',
          episodes: edge.node.episodes,
          status: edge.node.status,
          coverImage: edge.node.coverImage?.large
        }));
      
      // Find sequels
      const sequels = relations
        .filter(edge => edge.relationType === 'SEQUEL' && edge.node.format === 'TV')
        .map(edge => ({
          id: edge.node.id,
          title: edge.node.title.romaji || edge.node.title.english,
          type: 'sequel',
          episodes: edge.node.episodes,
          status: edge.node.status,
          coverImage: edge.node.coverImage?.large
        }));
      
      // Current season
      const current = {
        id: animeData.id,
        title: animeData.title.romaji || animeData.title.english,
        type: 'current',
        episodes: animeData.episodes,
        status: animeData.status,
        coverImage: animeData.coverImage?.large
      };
      
      // Combine: prequels -> current -> sequels
      const allSeasons = [...prequels, current, ...sequels];
      setRelatedSeasons(allSeasons);
      
      console.log('📺 Found seasons:', allSeasons.map(s => s.title));
    }
  }, [animeData]);

  if (isLoading) return <CenteredLoader />

  if (errorMappings || errorMalId) {
    toast.error(t('errorFetchingAnime'), {
      icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
      description: `${t('couldntFetchAnime')}: ${errorMappings?.message || errorMalId?.message}`,
      classNames: {
        title: 'text-rose-500'
      }
    })
  }

  if (error) {
    throw new Error(error)
  }

  if (status !== 'success') return <CenteredLoader />

  const data = animeData

  // Only create fallback episodes if we have a valid episode count from AniList
  if ((!episodesAnizip || episodesAnizip.length === 0) && data?.episodes) {
    // Fallback: Generate placeholder episodes based on AniList episode count
    episodesAnizip = Array.from({ length: data.episodes }, (_, i) => ({
      epNum: i + 1,
      title: `${t('newReleaseCard.episode')} ${i + 1}`,
      thumbnail: null,
      airdate: null,
      overview: null,
      aids: mappingsData?.mappings?.anidb_id || null,
      eids: null
    }));
  } else if (!episodesAnizip || episodesAnizip.length === 0) {
    // If no episode count from AniList either, show empty state
    episodesAnizip = [];
  }

  const startDate = data?.startDate
    ? new Date(data.startDate.year, data.startDate.month - 1, data.startDate.day)
    : null

  const endDate = data?.endDate
    ? new Date(data.endDate.year, data.endDate.month - 1, data.endDate.day)
    : null

  let animeEpisodes = data?.streamingEpisodes
  animeEpisodes?.sort((a, b) => {
    const aNum = parseInt(a.title.split(' ')[1])
    const bNum = parseInt(b.title.split(' ')[1])
    return aNum - bNum
  })

  // if (!animeEpisodes) {
  // animeEpisodes = episodesAnizip;
  // } else if (episodesAnizip.length >= animeEpisodes.length) {
  animeEpisodes = episodesAnizip
  // }

  return (
    <div>
      {/* {false && ( */}
      {data?.bannerImage && (
        // <div className="p-4 px-8">
        <div className="relative">
          {glow && (
            <div className="animate-fade-down">
              <img
                src={data?.bannerImage}
                className="absolute top-0 z-0 h-72 w-full object-cover opacity-70 blur-3xl brightness-75 saturate-150"
                alt=""
              />
            </div>
          )}
          <img
            src={data?.bannerImage}
            className="z-10 h-72 w-full animate-fade-down object-cover brightness-75"
            alt=""
          />
        </div>
      )}
      <div className="z-10 mx-auto animate-fade px-6 py-4 lg:container">
        <div className="flex justify-between gap-x-7">
          <img
            src={data?.coverImage.extraLarge}
            alt=""
            className={`duration-400 relative ${data?.bannerImage ? 'bottom-[4rem]' : ''} shadow-xl drop-shadow-2xl h-[25rem] w-72 animate-fade-up rounded-md object-cover transition-all ease-in-out`}
            // className={`duration-400 relative h-96 w-72 animate-fade rounded-md object-cover transition-all ease-in-out`}
          />
          <div className="flex-1 justify-start gap-y-0">
            <p className="font-space-mono text-xl font-medium opacity-90">{data?.title.romaji}</p>
            <p className="text font-space-mono font-medium opacity-60">{data?.title.english}</p>
            <div className="my-3 h-[1px] w-full bg-[#333]"></div> {/* Divider */}
            <div className="flex w-fit gap-x-2 pr-4 text-xs opacity-60">
              <p className="">{data?.format}</p>
              <div className="h-5 w-[1px] bg-[#333]"></div> {/* Divider */}
              <p>{`${data?.episodes ? data?.episodes : '?'} ${t('animePage.episodesLabel')}`}</p>
              <div className="h-5 w-[1px] bg-[#333]"></div> {/* Divider */}
              <p>({t(`animePage.status_${data?.status?.toLowerCase()}`)})</p>
              <div className="h-5 w-[1px] bg-[#333]"></div> {/* Divider */}
              <p className="text-xs opacity-60">
                {startDate && format(startDate, 'MMMM yyyy', { locale: tr })}
              </p>
              <div className="h-5 w-[1px] bg-[#333]"></div> {/* Divider */}
              <p className="opacity-60">{t(`animePage.season_${data?.season?.toLowerCase()}`)}</p>
              <div className="h-5 w-[1px] bg-[#333]"></div> {/* Divider */}
              {data.averageScore && (
                <>
                  <div className="flex gap-x-1 tracking-wide opacity-90">
                    <StarIcon /> {data.averageScore} / 100
                  </div>
                  <div className="h-5 w-[1px] bg-[#333]"></div> {/* Divider */}
                </>
              )}
              <div className="flex gap-x-1 tracking-wide opacity-90">
                <PersonIcon />
                {data.popularity.toLocaleString()}
              </div>
            </div>
            <div className="my-3 h-[1px] w-1/2 bg-[#333]"></div> {/* Divider */}
            <div className="animate-fade animate-duration-1000">
              <div className="flex flex-col gap-y-2 font-space-mono text-sm opacity-55">
                {parse(autop(malIdData?.data?.synopsis || data?.description || t('noDescription')))}
              </div>
            </div>
            <div className="mt-6 flex gap-x-5">
              <Link target="_blank" to={data?.siteUrl}>
                <Button size={'1'} variant="">
                  AniList
                </Button>
              </Link>
              {malIdData?.data?.url && (
                <Link target="_blank" to={malIdData?.data?.url}>
                  <Button size={'1'} variant="">
                    MyAnimeList
                  </Button>
                </Link>
              )}
              {data?.trailer?.site === 'youtube' && (
                <Link target="_blank" to={`https://www.youtube.com/watch?v=${data?.trailer.id}`}>
                  <Button size={'1'} color="red" variant="">
                    YouTube
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {true && (
          <div className="mb-64 mt-12">
            <div className="flex items-center gap-x-3">
              <p className="font-space-mono text-lg font-medium opacity-90">{t('animePage.episodesTitle')}</p>
              {isAuthenticated && (
                <Button
                  variant="soft"
                  size={'2'}
                  onClick={scrollToComments}
                  color="cyan"
                  className="font-medium"
                >
                  <ChatBubbleIcon width="16" height="16" />
                  {t('comments.writeComment')}
                </Button>
              )}
              <Button
                variant="soft"
                size={'1'}
                onClick={() => setDualAudio(!dualAudio)}
                color={dualAudio ? 'blue' : 'gray'}
              >
                {t('animePage.englishDub')}
              </Button>
              <Button
                variant="soft"
                size={'1'}
                onClick={() => setHideWatchedEpisodes(!hideWatchedEpisodes)}
                color={hideWatchedEpisodes ? 'blue' : 'gray'}
              >
                {t('animePage.hideWatchedEpisodes')}
              </Button>
              <DropdownMenu.Root className="nodrag" modal={false}>
                <DropdownMenu.Trigger>
                  <Button variant="soft" color="gray" size={'1'}>
                    <div className="flex animate-fade items-center gap-x-2">{t('animePage.quality')} {quality === 'All' ? t('animePage.all') : quality}</div>
                    <DropdownMenu.TriggerIcon />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <DropdownMenu.Item
                    color={`${quality === 'All' ? 'indigo' : 'gray'}`}
                    onClick={() => setQuality('All')}
                  >
                    {t('animePage.all')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    color={`${quality === '1080p' ? 'indigo' : 'gray'}`}
                    shortcut="HD"
                    onClick={() => setQuality('1080p')}
                  >
                    {t('animePage.hd')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    color={`${quality === '720p' ? 'indigo' : 'gray'}`}
                    shortcut="SD"
                    onClick={() => setQuality('720p')}
                  >
                    {t('animePage.sd')}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
              {relatedSeasons.length > 1 && (
                <DropdownMenu.Root className="nodrag" modal={false}>
                  <DropdownMenu.Trigger>
                    <Button variant="soft" color="purple" size={'1'}>
                      <div className="flex animate-fade items-center gap-x-2">
                        📺 {animeData?.title?.romaji?.split(' ').slice(0, 2).join(' ')} ({relatedSeasons.findIndex(s => s.id === animeData.id) + 1}/{relatedSeasons.length})
                      </div>
                      <DropdownMenu.TriggerIcon />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content>
                    {relatedSeasons.map((season, index) => (
                      <DropdownMenu.Item
                        key={season.id}
                        color={season.id === animeData.id ? 'indigo' : 'gray'}
                        onClick={() => {
                          if (season.id !== animeData.id) {
                            navigate(`/anime/${season.id}`);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <img src={season.coverImage} alt="" className="w-8 h-12 object-cover rounded" />
                          <div>
                            <div className="font-semibold">Season {index + 1}</div>
                            <div className="text-xs opacity-60">
                              {season.episodes} eps • {season.status}
                            </div>
                          </div>
                        </div>
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              )}
            </div>
            {!isLoadingMappings && (
              <div className="mt-3 grid grid-cols-1 gap-y-3">
                <Episode
                  all={true}
                  anime={data}
                  dualAudio={dualAudio}
                  data={{ aids: mappingsData?.mappings?.anidb_id, quality, eids: 0, selectedSeason }}
                  bannerImage={data?.bannerImage}
                  setAvailableSeasons={setAvailableSeasons}
                />
                {animeEpisodes
                  ?.filter(episode => {
                    if (selectedSeason === 'all') return true;
                    // Filter by season based on episode number ranges
                    // Season 1: 1-12, Season 2: 13-24, etc.
                    const epNum = parseInt(episode.epNum);
                    const seasonNum = Math.ceil(epNum / 12);
                    return seasonNum.toString() === selectedSeason;
                  })
                  ?.map((episode, ix) => (
                    <Episode
                      key={'ep -' + ix}
                      anime={data}
                      animeId={data.id}
                      data={{
                        ...episode,
                        progress: episodesWatched,
                        hideWatchedEpisodes,
                        quality,
                        selectedSeason
                      }}
                      dualAudio={dualAudio}
                      episodeNumber={parseInt(episode.epNum)}
                      aniZip_titles={aniZip_titles}
                      bannerImage={data?.bannerImage}
                    />
                  ))}
              </div>
            )}
            {isLoadingMappings && <Skeleton className="mt-3 h-12" />}
          </div>
        )}

        {/* Comments Section */}
        <div ref={commentSectionRef}>
          <CommentSection animeId={animeId} />
        </div>
      </div>

      {/* Scroll to Top Button */}
      <ScrollToTop />
    </div>
  );
}
