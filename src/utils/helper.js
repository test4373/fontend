import {
  BASE_URL_ANILIST,
  GET_ANIME_DETAILS_BY_ID,
  GET_ANIME_EPISODES_BY_ID,
  GET_ANIME_MAPPING_BY_ANILIST_ID,
  GET_TOSHO_RSS,
  GET_TOSHO_RSS_BY_QUERY,
  SEARCH_ANIME,
  SEARCH_TORRENT,
  TOP_AIRING_ANIME,
  TOP_ANIME,
} from "./api";

// export async function searchAnime(text, limit = 10) {
//   try {
//     if (text === "asd") throw new Error("Invalid search query");
//     const response = await fetch(SEARCH_ANIME(text, limit));
//     const data = await response.json();
//     return data;
//   } catch (error) {
//     throw new Error(error);
//   }
// }

const token = localStorage.getItem("anilist_token");

export async function searchAnime(text, limit = 10) {
  try {
    const query = `
      query ($search: String, $limit: Int) {
        Page(perPage: $limit) {
          media(search: $search, type: ANIME, sort: START_DATE_DESC) {
            id
            format
            status
            episodes
            startDate {
              year
              month
              day
            }
            title {
              romaji
              english
              native
            }
            description
            coverImage {
              large
              medium
            }
            genres
            relations {
              edges {
                relationType
                node {
                  id
                  format
                  title {
                    romaji
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      search: text,
      limit: limit,
    };

    const response = await fetch(BASE_URL_ANILIST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: query,
        variables: variables,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.errors?.[0]?.message || "Failed to fetch anime data",
      );
    }

    // Filter out sequels/prequels - only show the first season
    const results = data.data.Page.media;
    const filtered = results.filter(anime => {
      // Check if this anime is a sequel
      const isSequel = anime.relations?.edges?.some(edge => 
        edge.relationType === 'PREQUEL' && edge.node.format === 'TV'
      );
      return !isSequel; // Only show if it's NOT a sequel (i.e., it's the first season or standalone)
    });

    console.log(`Filtered ${results.length} -> ${filtered.length} (removed sequels)`);

    return filtered;
  } catch (error) {
    throw new Error(error.message || error);
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function searchAiringAnime(text, limit = 2) {
  console.log("Searching for airing anime with text:", text);
  await delay(1300); // Adjust the delay as needed

  try {
    const query = `
      query ($search: String, $limit: Int) {
        Page(perPage: $limit) {
          media(search: $search, type: ANIME, status: RELEASING, sort: START_DATE_DESC) {
            id
            format
            status
            episodes
            startDate {
              year
              month
              day
            }
            title {
              romaji
              english
              native
            }
            description
            coverImage {
              extraLarge
              large
              medium
            }
            genres
            relations {
              edges {
                relationType
                node {
                  id
                  format
                  title {
                    romaji
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      search: text,
      limit: limit,
    };
    // throw new Error("Too many requests to the API. You are being rate-limited. Please come back after a minute.");

    const response = await fetch(BASE_URL_ANILIST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: query,
        variables: variables,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.errors?.[0]?.message || "Failed to fetch anime data",
      );
    }

    // Filter out sequels
    const results = data.data.Page.media;
    const filtered = results.filter(anime => {
      const isSequel = anime.relations?.edges?.some(edge => 
        edge.relationType === 'PREQUEL' && edge.node.format === 'TV'
      );
      return !isSequel;
    });

    return filtered;
  } catch (error) {
    if (error.message.includes("Failed to fetch"))
      throw new Error(
        "Too many requests to the API. You are being rate-limited. Please come back after a minute.",
      );
    throw new Error(error.message || error);
  }
}

/* ------------------------------------------------------ */
export async function getTopAiringAnime() {
  const query = `
    query {
      Page(perPage: 49, page: 1) {
        media(type: ANIME, sort: TRENDING_DESC, status_in: [RELEASING], isAdult: false) {
          id
          idMal
          bannerImage
          title {
            romaji
            english
            native
          }
          season
          seasonYear
          coverImage {
            extraLarge
          }
          description
          episodes
          averageScore
          popularity
          startDate {
            year
            month
            day
          }
          format
          relations {
            edges {
              relationType
              node {
                id
                format
              }
            }
          }
          ${
            token
              ? `mediaListEntry {
            id
            status
            score
            progress
          }`
              : ""
          }
        }
      }
    }
  `;

  try {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // If token is present, add Authorization header
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(BASE_URL_ANILIST, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });

    if (response.status === 429) {
      throw new Error(
        "Too many requests to the API. You are being rate-limited. Please come back after a minute.",
      );
    } else if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error ${response.status}: ${response.statusText} - ${errorData.message}`,
      );
    }

    const { data } = await response.json();
    
    // Filter out sequels
    const results = data.Page.media;
    const filtered = results.filter(anime => {
      const isSequel = anime.relations?.edges?.some(edge => 
        edge.relationType === 'PREQUEL' && edge.node.format === 'TV'
      );
      return !isSequel;
    });
    
    console.log(`Top Airing: ${results.length} -> ${filtered.length} (removed sequels)`);
    return filtered;
  } catch (error) {
    throw new Error(error.message);
  }
}

/* ------------------------------------------------------ */

export async function getTopAnime(page = 1) {
  console.log("Fetching top anime with page:", page);

  // Set a timeout to prevent too many requests
  await new Promise((resolve) => setTimeout(resolve, 2000)); // 900 milliseconds delay

  const query = `
    query ($page: Int) {
      Page(page: $page, perPage: 25) {
        media(type: ANIME, sort: SCORE_DESC, isAdult: false) {
          id
          idMal
          bannerImage
          title {
            romaji
            english
            native
          }
          coverImage {
            extraLarge
          }
          description
          episodes
          averageScore
          popularity
          startDate {
            year
            month
            day
          }
          format
          relations {
            edges {
              relationType
              node {
                id
                format
              }
            }
          }
          ${
            token
              ? `mediaListEntry {
            id
            status
            score
            progress
          }`
              : ""
          }
        }
      }
    }
  `;

  try {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // If token is present, add Authorization header
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(BASE_URL_ANILIST, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        variables: { page },
      }),
    });

    if (response.status === 429) {
      console.log(
        "Too many requests to the API. You are being rate-limited. Please wait a minute and refresh the page.",
      );
      throw new Error(
        "Too many requests to the API. You are being rate-limited. Please wait a minute and refresh the page.",
      );
    } else if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error ${response.status}: ${response.statusText} - ${errorData.message}`,
      );
    }

    const data = await response.json();
    
    // Filter out sequels
    const results = data.data.Page.media;
    const filtered = results.filter(anime => {
      const isSequel = anime.relations?.edges?.some(edge => 
        edge.relationType === 'PREQUEL' && edge.node.format === 'TV'
      );
      return !isSequel;
    });
    
    console.log(`Top Anime (Page ${page}): ${results.length} -> ${filtered.length} (removed sequels)`);
    return filtered;
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function getAnimeById(id) {
  console.log("Fetching anime with id:", id);

  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        bannerImage
        coverImage {
          extraLarge
        }
        description
        episodes
        averageScore
        popularity
        idMal
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
        siteUrl
        format
        status
        genres
        season
        streamingEpisodes {
          title
          thumbnail
          url
          site
        }
        trailer {
          id
          site
          thumbnail
        }
        relations {
          edges {
            relationType
            node {
              id
              title {
                romaji
                english
              }
              format
              status
              episodes
              coverImage {
                large
              }
            }
          }
        }
        characters {
          edges {
            node {
              id
              name {
                full
              }
            }
          }
        }
        ${
          token
            ? `mediaListEntry {
          id
          status
          score
          progress
        }`
            : ""
        }
      }
    }
  `;

  try {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // If token is present, add Authorization header
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(BASE_URL_ANILIST, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        variables: { id },
      }),
    });

    if (response.status === 429) {
      throw new Error(
        "Too many requests to the API. You are being rate-limited. Please wait a minute and refresh the page.",
      );
    } else if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error ${response.status}: ${response.statusText} - ${errorData.message}`,
      );
    }

    const { data } = await response.json();
    console.log(data);

    return data.Media;
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function getAnimeByMalId(id) {
  try {
    console.log("Fetching anime with id:", id);

    const response = await fetch(GET_ANIME_DETAILS_BY_ID(id));

    if (response.status === 429) {
      throw new Error(
        "Too many requests to the API. You are being rate-limited. Please wait a min and refresh the page.",
      );
    } else if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error ${response.status}: ${response.statusText} - ${errorData.message}`,
      );
    }

    const data = await response.json();
    console.log(data);

    return data;
  } catch (error) {
    throw new Error(error);
  }
}

// NOT NEEDED
export async function getAnimeEpisodesById(id) {
  console.log("Fetching anime episodes with id:", id);

  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        episodes
        episodeStartDate {
          year
          month
          day
        }
        episodes
        airingData {
          episode
          airDate
        }
      }
    }
  `;

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { id },
      }),
    });

    if (response.status === 429) {
      throw new Error(
        "Too many requests to the API. You are being rate-limited. Please wait a minute and refresh the page.",
      );
    } else if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error ${response.status}: ${response.statusText} - ${errorData.message}`,
      );
    }

    const { data } = await response.json();
    return data.Media;
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function getAniZipMappings(anilist_id, anidb = false) {
  try {
    const response = await fetch(
      GET_ANIME_MAPPING_BY_ANILIST_ID(anilist_id, anidb),
    );

    if (response.status === 429) {
      throw new Error(
        "Too many requests to the API. You are being rate-limited. Please wait a minute and refresh the page.",
      );
    } else if (response.status === 404) {
      // Return empty array if mapping not found
      return [];
    } else if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error ${response.status}: ${response.statusText} - ${errorData.message}`,
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
}

// const searchQuery = `${anime} Episode ${data.mal_id < 10 ? `0${data.mal_id}` : data.mal_id}`;
//     const response = await fetch(SEARCH_TORRENT(searchQuery));
//     const data2 = await response.json();
export async function searchTorrent(query) {
  await new Promise((resolve) => setTimeout(resolve, 300)); // 300 milliseconds delay
  try {
    const response = await fetch(SEARCH_TORRENT(query));
    const data = await response.json();
    return data;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
}

export async function getRecentActivity() {
  const query = `
    query {
      Page(perPage: 30, page: 1) {
        activities(type: ANIME_LIST, sort: ID_DESC) {
          ... on ListActivity {
            id
            createdAt
            status
            progress
            media {
              id
              title {
                romaji
                english
                native
              }
              coverImage {
                extraLarge
              }
            }
            user {
              id
              name
              avatar {
                large
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(BASE_URL_ANILIST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (response.status === 429) {
      throw new Error(
        "Too many requests to the API. You are being rate-limited. Please wait a minute and refresh the page.",
      );
    } else if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error ${response.status}: ${response.statusText} - ${errorData.message}`,
      );
    }

    const { data } = await response.json();
    return data.Page.activities;
  } catch (error) {
    throw new Error(error.message);
  }
}

// getNewReleases(default"[SubsPlease]")
export async function getNewReleases(packer = "[SubsPlease]") {
  try {
    const response = await fetch(GET_TOSHO_RSS(packer));

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
}

/* ------------------------------------------------------ */

export async function setWatchedEpisodes(animeId, episodesWatched) {
  if (!token) {
    throw new Error(
      "User is not authenticated. Please log in to update episode data on AniList.",
    );
  }

  const mutation = `
    mutation ($id: Int, $progress: Int) {
      SaveMediaListEntry(
        mediaId: $id
        progress: $progress
      ) {
        id
        progress
      }
    }
  `;

  try {
    const response = await fetch(BASE_URL_ANILIST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          id: animeId,
          progress: episodesWatched,
        },
      }),
    });

    if (response.status === 429) {
      throw new Error(
        "Too many requests to the API. You are being rate-limited. Please wait a minute and refresh the page.",
      );
    } else if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error ${response.status}: ${response.statusText} - ${errorData.message}`,
      );
    }

    const data = await response.json();
    return data.data.SaveMediaListEntry;
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function getToshoEpisodes(quality, aids, eids) {
  try {
    const response = await fetch(GET_TOSHO_RSS_BY_QUERY(quality, aids, eids));

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(error);
  }
}
