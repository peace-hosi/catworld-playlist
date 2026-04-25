// scripts/sync-youtube-playlist.mjs
import fs from "node:fs/promises";

const API_KEY = process.env.YOUTUBE_API_KEY;
const PLAYLIST_ID = process.env.YOUTUBE_PLAYLIST_ID;

if (!API_KEY || !PLAYLIST_ID) {
  throw new Error("YOUTUBE_API_KEY and YOUTUBE_PLAYLIST_ID are required");
}

const OUT_PATH = "public/playlist.json";

async function fetchPlaylistItems() {
  const tracks = [];
  let pageToken = "";

  while (true) {
    const params = new URLSearchParams({
      part: "snippet,status",
      playlistId: PLAYLIST_ID,
      maxResults: "50",
      key: API_KEY,
    });

    if (pageToken) params.set("pageToken", pageToken);

    const url = `https://www.googleapis.com/youtube/v3/playlistItems?${params}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`YouTube API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();

    for (const item of data.items ?? []) {
      const snippet = item.snippet ?? {};
      const resource = snippet.resourceId ?? {};
      const videoId = resource.videoId;
      const title = snippet.title ?? "Untitled";

      if (resource.kind !== "youtube#video") continue;
      if (!videoId) continue;
      if (title === "Private video" || title === "Deleted video") continue;

      tracks.push({
        name: title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        mode: 0,
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return tracks;
}

const tracks = await fetchPlaylistItems();

await fs.mkdir("public", { recursive: true });

await fs.writeFile(
  OUT_PATH,
  JSON.stringify(
    {
      updatedAt: new Date().toISOString(),
      source: `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`,
      tracks,
    },
    null,
    2
  ),
  "utf8"
);

console.log(`Wrote ${OUT_PATH}: ${tracks.length} tracks`);