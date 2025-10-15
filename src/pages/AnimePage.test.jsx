import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AnimePage from '../pages/AnimePage'
import * as reactRouter from 'react-router-dom'
import * as useGetAnimeByIdHook from '../hooks/useGetAnimeById'
import * as useGetAniZipMappingsHook from '../hooks/useGetAniZipMappings'
import * as useGetAnimeByMalIdHook from '../hooks/useGetAnimeByMalId'
import * as contextProvider from '../utils/ContextProvider'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn()
}))

jest.mock('../hooks/useGetAnimeById')
jest.mock('../hooks/useGetAniZipMappings')
jest.mock('../hooks/useGetAnimeByMalId')
jest.mock('../utils/ContextProvider')
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn()
}))
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn()
  }
}))

describe('AnimePage', () => {
  const animeId = '123'
  const malId = 456
  const tMock = (key) => {
    const translations = {
      'newReleaseCard.episode': 'Episode',
      errorFetchingAnime: 'Error fetching anime',
      couldntFetchAnime: "Couldn't fetch anime",
      noDescription: 'No description available',
      'animePage.episodesLabel': 'episodes',
      'animePage.status_finished': 'Finished',
      'animePage.season_spring': 'Spring',
      'animePage.episodesTitle': 'Episodes',
      'animePage.englishDub': 'English Dub',
      'animePage.hideWatchedEpisodes': 'Hide Watched Episodes',
      'animePage.quality': 'Quality',
      'animePage.all': 'All',
      'animePage.hd': 'HD',
      'animePage.sd': 'SD'
    }
    return translations[key] || key
  }

  beforeEach(() => {
    jest.clearAllMocks()
    reactRouter.useParams.mockReturnValue({ animeId })
    useTranslation.mockReturnValue({ t: tMock })
    contextProvider.useZenshinContext.mockReturnValue({ glow: false })
  })

  test('renders loading state initially', () => {
    useGetAnimeByIdHook.default.mockReturnValue({
      isLoading: true,
      animeData: null,
      error: null,
      status: 'loading'
    })
    useGetAniZipMappingsHook.default.mockReturnValue({
      isLoading: true,
      data: null,
      error: null,
      status: 'loading'
    })
    useGetAnimeByMalIdHook.default.mockReturnValue({
      isLoading: true,
      data: null,
      error: null,
      status: 'loading'
    })

    render((<AnimePage />))
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  test('throws error when error returned from useGetAnimeById', () => {
    useGetAnimeByIdHook.default.mockReturnValue({
      isLoading: false,
      animeData: null,
      error: 'Failed to fetch anime',
      status: 'error'
    })
    useGetAniZipMappingsHook.default.mockReturnValue({
      isLoading: false,
      data: null,
      error: null,
      status: 'success'
    })
    useGetAnimeByMalIdHook.default.mockReturnValue({
      isLoading: false,
      data: null,
      error: null,
      status: 'success'
    })

    expect(() => render((<AnimePage />))).toThrow('Failed to fetch anime')
  })

  test('shows toast error when errorMappings or errorMalId occurs', () => {
    useGetAnimeByIdHook.default.mockReturnValue({
      isLoading: false,
      animeData: { idMal: malId },
      error: null,
      status: 'success'
    })
    useGetAniZipMappingsHook.default.mockReturnValue({
      isLoading: false,
      data: null,
      error: { message: 'Mapping error' },
      status: 'error'
    })
    useGetAnimeByMalIdHook.default.mockReturnValue({
      isLoading: false,
      data: null,
      error: null,
      status: 'success'
    })

    render((<AnimePage />))
    expect(toast.error).toHaveBeenCalledWith(
      'Error fetching anime',
      expect.objectContaining({
        description: "Couldn't fetch anime: Mapping error"
      })
    )
  })

  test('renders anime details and episodes with mappings data', async () => {
    const animeData = {
      idMal: malId,
      bannerImage: 'banner.jpg',
      coverImage: { extraLarge: 'cover.jpg' },
      title: { romaji: 'Romaji Title', english: 'English Title' },
      format: 'TV',
      episodes: 3,
      status: 'FINISHED',
      startDate: { year: 2020, month: 4, day: 1 },
      endDate: { year: 2020, month: 6, day: 30 },
      season: 'SPRING',
      averageScore: 85,
      popularity: 12345,
      description: 'Anime description',
      siteUrl: 'https://anilist.co/anime/123',
      trailer: { site: 'youtube', id: 'yt123' },
      streamingEpisodes: [
        { title: 'Episode 1' },
        { title: 'Episode 2' },
        { title: 'Episode 3' }
      ],
      mediaListEntry: { progress: 1 }
    }
    const mappingsData = {
      episodes: {
        1: {
          episode: 1,
          title: { en: 'Ep 1 Title' },
          image: 'thumb1.jpg',
          airdate: '2020-04-01',
          overview: 'Overview 1',
          anidbEid: 101
        },
        2: {
          episode: 2,
          title: { en: 'Ep 2 Title' },
          image: 'thumb2.jpg',
          airdate: '2020-04-08',
          overview: 'Overview 2',
          anidbEid: 102
        }
      },
      titles: { en: 'AniZip EN', ja: 'AniZip JA', 'x-jat': 'AniZip XJAT' },
      mappings: { anidb_id: [1, 2] }
    }
    const malIdData = {
      data: {
        titles: [
          { title: 'Romaji MAL Title' },
          {},
          {},
          {},
          { title: 'English MAL Title' }
        ],
        synopsis: 'MAL synopsis',
        url: 'https://myanimelist.net/anime/456'
      }
    }

    useGetAnimeByIdHook.default.mockReturnValue({
      isLoading: false,
      animeData,
      error: null,
      status: 'success'
    })
    useGetAniZipMappingsHook.default.mockReturnValue({
      isLoading: false,
      data: mappingsData,
      error: null,
      status: 'success'
    })
    useGetAnimeByMalIdHook.default.mockReturnValue({
      isLoading: false,
      data: malIdData,
      error: null,
      status: 'success'
    })

    render((<AnimePage />))

    expect(screen.getByText('Romaji Title')).toBeInTheDocument()
    expect(screen.getByText('English Title')).toBeInTheDocument()
    expect(screen.getByText('TV')).toBeInTheDocument()
    expect(screen.getByText('3 episodes')).toBeInTheDocument()
    expect(screen.getByText('(Finished)')).toBeInTheDocument()
    expect(screen.getByText('Episode 1')).toBeInTheDocument()
    expect(screen.getByText('Episode 2')).toBeInTheDocument()
    expect(screen.getByText('Episode 3')).toBeInTheDocument()
    expect(screen.getByText('AniList')).toBeInTheDocument()
    expect(screen.getByText('MyAnimeList')).toBeInTheDocument()
    expect(screen.getByText('YouTube')).toBeInTheDocument()
    expect(screen.getByText('Episodes')).toBeInTheDocument()
  })

  test('toggles dualAudio and hideWatchedEpisodes buttons', () => {
    const animeData = {
      idMal: malId,
      bannerImage: null,
      coverImage: { extraLarge: 'cover.jpg' },
      title: { romaji: 'Romaji Title', english: 'English Title' },
      format: 'TV',
      episodes: 1,
      status: 'FINISHED',
      startDate: null,
      endDate: null,
      season: 'SPRING',
      averageScore: 85,
      popularity: 12345,
      description: 'Anime description',
      siteUrl: 'https://anilist.co/anime/123',
      trailer: null,
      streamingEpisodes: [],
      mediaListEntry: { progress: 0 }
    }
    useGetAnimeByIdHook.default.mockReturnValue({
      isLoading: false,
      animeData,
      error: null,
      status: 'success'
    })
    useGetAniZipMappingsHook.default.mockReturnValue({
      isLoading: false,
      data: null,
      error: null,
      status: 'success'
    })
    useGetAnimeByMalIdHook.default.mockReturnValue({
      isLoading: false,
      data: null,
      error: null,
      status: 'success'
    })

    render((<AnimePage />))

    const englishDubBtn = screen.getByRole('button', { name: /English Dub/i })
    const hideWatchedBtn = screen.getByRole('button', { name: /Hide Watched Episodes/i })

    expect(englishDubBtn).toHaveAttribute('color', 'gray')
    expect(hideWatchedBtn).toHaveAttribute('color', 'gray')

    fireEvent.click(englishDubBtn)
    expect(englishDubBtn).toHaveAttribute('color', 'blue')

    fireEvent.click(hideWatchedBtn)
    expect(hideWatchedBtn).toHaveAttribute('color', 'blue')
  })

  test('renders fallback episodes when no ani.zip data', () => {
    const animeData = {
      idMal: malId,
      bannerImage: null,
      coverImage: { extraLarge: 'cover.jpg' },
      title: { romaji: 'Romaji Title', english: 'English Title' },
      format: 'TV',
      episodes: 2,
      status: 'FINISHED',
      startDate: null,
      endDate: null,
      season: 'SPRING',
      averageScore: 85,
      popularity: 12345,
      description: 'Anime description',
      siteUrl: 'https://anilist.co/anime/123',
      trailer: null,
      streamingEpisodes: [],
      mediaListEntry: { progress: 0 }
    }
    useGetAnimeByIdHook.default.mockReturnValue({
      isLoading: false,
      animeData,
      error: null,
      status: 'success'
    })
    useGetAniZipMappingsHook.default.mockReturnValue({
      isLoading: false,
      data: { episodes: null },
      error: null,
      status: 'success'
    })
    useGetAnimeByMalIdHook.default.mockReturnValue({
      isLoading: false,
      data: null,
      error: null,
      status: 'success'
    })

    render((<AnimePage />))

    expect(screen.getByText('Episode 1')).toBeInTheDocument()
    expect(screen.getByText('Episode 2')).toBeInTheDocument()
  })

  test('renders skeleton when mappings are loading', () => {
    const animeData = {
      idMal: malId,
      bannerImage: null,
      coverImage: { extraLarge: 'cover.jpg' },
      title: { romaji: 'Romaji Title', english: 'English Title' },
      format: 'TV',
      episodes: 1,
      status: 'FINISHED',
      startDate: null,
      endDate: null,
      season: 'SPRING',
      averageScore: 85,
      popularity: 12345,
      description: 'Anime description',
      siteUrl: 'https://anilist.co/anime/123',
      trailer: null,
      streamingEpisodes: [],
      mediaListEntry: { progress: 0 }
    }
    useGetAnimeByIdHook.default.mockReturnValue({
      isLoading: false,
      animeData,
      error: null,
      status: 'success'
    })
    useGetAniZipMappingsHook.default.mockReturnValue({
      isLoading: true,
      data: null,
      error: null,
      status: 'loading'
    })
    useGetAnimeByMalIdHook.default.mockReturnValue({
      isLoading: false,
      data: null,
      error: null,
      status: 'success'
    })

    render((<AnimePage />))

    expect(screen.getByText(/Episodes/i)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
