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

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function dailyShuffle(array) {
  const now = new Date();

  // JSTに変換
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  // 朝3時までは前日扱い
  if (jst.getHours() < 3) {
    jst.setDate(jst.getDate() - 1);
  }

  const y = jst.getFullYear();
  const m = String(jst.getMonth() + 1).padStart(2, "0");
  const d = String(jst.getDate()).padStart(2, "0");

  const seed = Number(`${y}${m}${d}`);

  for (let i = array.length - 1; i > 0; i--) {
    const r = seededRandom(seed + i);
    const j = Math.floor(r * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

const tracks = await fetchPlaylistItems();

// プレイリスト先頭5件（新着枠）
const latestCount = 5;
const latestTracks = tracks.slice(0, latestCount);

// 残りは順番をシャッフル
const restTracks = tracks.slice(latestCount);
dailyShuffle(restTracks);

// 結合
const finalTracks = [
  ...latestTracks.map(track => ({ ...track, tag: "new" })),
  ...restTracks.map(track => ({ ...track, tag: "daily" })),
];

await fs.mkdir("public", { recursive: true });

await fs.writeFile(
  OUT_PATH,
  JSON.stringify(
    {
      updatedAt: new Date().toISOString(),
      source: `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`,
      tracks: finalTracks,
    },
    null,
    2
  ),
  "utf8"
);

console.log(`Wrote ${OUT_PATH}: ${finalTracks.length} tracks`);