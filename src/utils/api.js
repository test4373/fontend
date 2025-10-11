import axios from 'axios';

const BASE_URL_JIKAN = 'https://api.jikan.moe/v4';
const BASE_URL_NYAA = decodeURIComponent(
  atob("aHR0cHM6Ly9ueWFhYXBpLm9ucmVuZGVyLmNvbS9ueWFh")
);

export const BASE_URL_ANILIST = 'https://graphql.anilist.co';
const BASE_URL_ANIZIP = 'https://api.ani.zip';
const TOSHO = decodeURIComponent(atob("aHR0cHM6Ly9mZWVkLmFuaW1ldG9zaG8ub3Jn"));

export function SEARCH_ANIME(query, limit = 10) {
  return `${BASE_URL_JIKAN}/anime?q=${query}&limit=${limit}`;
}

// NOTE: nyaaapi.onrender.com is unreliable, using AnimeTosho as primary source
export function SEARCH_TORRENT(query) {
  // Use AnimeTosho for more reliable results
  return `${TOSHO}/json?qx=1&q=${encodeURIComponent(query)}`;
}

export function TOP_AIRING_ANIME() {
  return `${BASE_URL_JIKAN}/top/anime?&filter=airing&limit=25&sfw=true&type=tv`;
}

export function TOP_ANIME(page = 1) {
  return `${BASE_URL_JIKAN}/top/anime?page=${page}&limit=25&sfw=true`;
}

export function GET_ANIME_DETAILS_BY_ID(id) {
  return `${BASE_URL_JIKAN}/anime/${id}/full`;
}

export function GET_ANIME_MAPPING_BY_ANILIST_ID(anilist_id, anidb = false) {
  console.log(`${BASE_URL_ANIZIP}/mappings?anilist_id=${anilist_id}`);
  if (anidb) return `${BASE_URL_ANIZIP}/mappings?anidb_id=${anilist_id}`;
  return `${BASE_URL_ANIZIP}/mappings?anilist_id=${anilist_id}`;
}

export function GET_ANIME_EPISODES_BY_ID(id) {
  return `${BASE_URL_JIKAN}/anime/${id}/episodes`;
}

export function GET_TOSHO_RSS(packer = "[SubsPlease]") {
  return `${TOSHO}/json?qx=1&q=${packer}`;
}

export function GET_TOSHO_RSS_BY_QUERY(quality = 'all', aids, eids) {
  if (eids === 0 || eids === null) {
    if (quality.toLowerCase() === 'all') return `${TOSHO}/json?qx=1&aids=${aids}`;
    return `${TOSHO}/json?qx=1&q=${quality}&aids=${aids}`;
  }
  if (quality.toLowerCase() === 'all') return `${TOSHO}/json?qx=1&aids=${aids}&eids=${eids}`;
  return `${TOSHO}/json?qx=1&q=${quality}&aids=${aids}&eids=${eids}`;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://zens23.onrender.com/api',
  timeout: 30000, // 30 seconds for torrent searches
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/users/login', credentials),
  register: (userData) => api.post('/users/register', userData),
  logout: () => api.post('/users/logout'),
};

// User API
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (profileData) => {
    if (profileData instanceof FormData) {
      return api.put('/users/profile', profileData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return api.put('/users/profile', profileData);
  },
  getSettings: () => api.get('/users/settings'),
  updateSettings: (settings) => api.put('/users/settings', settings),
};

// Comment API
export const commentAPI = {
  getComments: (animeId, page = 1) => api.get(`/comments/anime/${animeId}?page=${page}`),
  createComment: (commentData) => api.post('/comments', commentData),
  likeComment: (commentId) => api.post(`/comments/${commentId}/like`),
  deleteComment: (commentId) => api.delete(`/comments/${commentId}`),
};

// Watch History API
export const watchAPI = {
  getHistory: () => api.get('/watch/history'),
  getLastWatched: () => api.get('/watch/last-watched'),
  addToHistory: (data) => api.post('/watch/history', data),
  updateProgress: (animeId, episodeNum, progress) =>
    api.put(`/watch/history/${animeId}/${episodeNum}`, { progress }),
  getCompleted: () => api.get('/watch/completed'),
  markAsCompleted: (animeId) => api.post(`/watch/completed/${animeId}`),
  removeFromHistory: (animeId) => api.delete(`/watch/history/${animeId}`),
};

// Admin API
export const adminAPI = {
  // User Management
  grantAdmin: (data) => api.post('/admin/users/grant-admin', data),
  revokeAdmin: (username) => api.delete(`/admin/users/revoke-admin/${username}`),
  getAdmins: () => api.get('/admin/users/admins'),

  // 4K Episodes
  add4KEpisode: (data) => api.post('/admin/episodes/add-4k', data),
  get4KEpisodes: (animeId) => api.get(`/admin/episodes/4k/${animeId}`),
  getAll4KEpisodes: () => api.get('/admin/episodes/4k'),
  delete4KEpisode: (id) => api.delete(`/admin/episodes/4k/${id}`),

  // Subtitles
  searchTorrents: (query) => api.get(`/admin/torrents/search?query=${encodeURIComponent(query)}`),
  searchMKV: (query) => api.get(`/admin/mkv/search?query=${encodeURIComponent(query)}`),
  extractSubtitles: (data) => api.post('/admin/subtitles/extract', data),
  addSubtitle: (data) => api.post('/admin/subtitles/add', data),
  getSubtitles: (animeId, episodeNumber) => api.get(`/admin/subtitles/${animeId}/${episodeNumber}`),
  deleteSubtitle: (id) => api.delete(`/admin/subtitles/${id}`),

  // Anime Search
  searchAnime: (query) => api.get(`/admin/anime/search?query=${encodeURIComponent(query)}`),

  // Statistics
  getStats: () => api.get('/admin/stats'),
};

// Legacy exports for backward compatibility
export const getComments = commentAPI.getComments;
export const createComment = commentAPI.createComment;
export const likeComment = commentAPI.likeComment;
export const deleteComment = commentAPI.deleteComment;

// Export api as named export as well
export { api };
export default api;
