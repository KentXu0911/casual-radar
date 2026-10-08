import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");

const replacements = {
  BV1TtuM6bE3B: {
    url: "https://www.youtube.com/watch?v=8j7E7B6V54g",
    title: "皇室战争2026年最值得觉醒的十大卡牌！新手必看！",
    platform: "YouTube",
    date: "2026-01-13",
    type: "guide",
    source: "YouTube · 皇室战争-666",
    note: "替代参考",
  },
  BV1Ex4y1A7mg: {
    url: "https://www.youtube.com/watch?v=7nODHyw3lgs",
    title: "Animal Crossing: New Horizons – Nintendo Switch 2 Edition & Free Update – Announcement Trailer",
    platform: "YouTube",
    date: "2025-10-30",
    type: "official",
    source: "Nintendo of America",
    note: "官方替代",
    views: "344.7万",
  },
  BV1VW421X7g1: {
    url: "https://www.bilibili.com/video/BV1f6eueKEUR/",
    title: "《代号：奇旅》首曝PV | 烦恼暂停，上岛数云！",
    platform: "B站",
    date: "2024-08-21",
    type: "official",
    source: "山海奇旅官方",
    note: "官方替代",
    views: "183.7万",
  },
  BV1PexCzGE1B: {
    url: "https://www.bilibili.com/video/BV12Ap2zjE5C/",
    title: "《粒粒的小人国》首曝PV&实机演示丨世界无限放大，烦恼统统变小",
    platform: "B站",
    date: "2025-09-24",
    type: "official",
    source: "B站",
    note: "替代地址",
    views: "579.8万",
  },
  BV1mHuS6CEi4: {
    url: "https://www.bilibili.com/video/BV1DTQfBVErR/",
    title: "一起赢终局！《王者万象棋》终极测试正式开启！",
    platform: "B站",
    date: "2026-03-24",
    type: "official",
    source: "王者万象棋官方",
    note: "官方替代",
    views: "10.9万",
  },
  BV1B7KAz3E1G: {
    url: "https://www.bilibili.com/video/BV15KTv6rEe3/",
    title: "「冒泡测试」定档7月24日！",
    platform: "B站",
    date: "2026-07-02",
    type: "showcase",
    source: "山海奇旅官方",
    note: "官方替代",
    views: "27.0万",
  },
  BV1M5Ksz9E8J: {
    url: "https://www.bilibili.com/video/BV11o4y1w7fq/",
    title: "[蛋仔滑滑]正式服登录界面",
    platform: "B站",
    date: "2023-05-04",
    type: "showcase",
    source: "B站玩家",
    note: "替代参考",
  },
};

const coverSources = {
  BV12Ap2zjE5C: "/video-thumbnails/alt-BV12Ap2zjE5C.jpg",
  BV1f6eueKEUR: "/video-thumbnails/alt-BV1f6eueKEUR.jpg",
  BV15KTv6rEe3: "/video-thumbnails/alt-BV15KTv6rEe3.jpg",
  BV1DTQfBVErR: "/video-thumbnails/alt-BV1DTQfBVErR.jpg",
  BV11o4y1w7fq: "/video-thumbnails/alt-BV11o4y1w7fq.jpg",
  "8j7E7B6V54g": "/video-thumbnails/alt-8j7E7B6V54g.jpg",
  "7nODHyw3lgs": "/video-thumbnails/alt-7nODHyw3lgs.jpg",
};

function findReplacement(value) {
  if (typeof value !== "string") return null;
  return Object.entries(replacements).find(([oldId]) => value.includes(oldId))?.[1] || null;
}

function updateObject(object) {
  const mediaValue = ["url", "video_url", "source_url"].map((key) => object[key]).find((value) => typeof value === "string" && findReplacement(value));
  const replacement = findReplacement(mediaValue);
  if (!replacement) return;

  for (const key of ["url", "video_url", "source_url"]) {
    if (typeof object[key] === "string" && findReplacement(object[key])) object[key] = replacement.url;
  }
  if ("title" in object) object.title = replacement.title;
  if ("platform" in object) object.platform = replacement.platform;
  if ("date" in object) object.date = replacement.date;
  if ("type" in object) object.type = replacement.type;
  if ("source" in object) object.source = replacement.source;
  if ("views" in object && replacement.views) object.views = replacement.views;
  object.replacement_note = replacement.note;
}

function replaceUrls(value) {
  if (Array.isArray(value)) {
    value.forEach(replaceUrls);
    return;
  }
  if (!value || typeof value !== "object") return;
  updateObject(value);
  Object.values(value).forEach((child) => {
    if (typeof child !== "string") replaceUrls(child);
  });
}

function replaceLooseStrings(value) {
  if (Array.isArray(value)) return value.map(replaceLooseStrings);
  if (!value || typeof value !== "object") {
    if (typeof value !== "string") return value;
    for (const [oldId, replacement] of Object.entries(replacements)) {
      if (value.includes(oldId)) return replacement.url;
    }
    return value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceLooseStrings(child)]));
}

for (const filename of ["public/games.json", "public/dashboard_data.json"]) {
  const filePath = path.join(projectRoot, filename);
  const parsed = JSON.parse(await readFile(filePath, "utf8"));
  replaceUrls(parsed);
  const replaced = replaceLooseStrings(parsed);
  await writeFile(filePath, `${JSON.stringify(replaced, null, 2)}\n`);
}

const coversPath = path.join(projectRoot, "public/video-covers.json");
const covers = JSON.parse(await readFile(coversPath, "utf8"));
for (const oldId of Object.keys(replacements)) delete covers[oldId];
for (const [videoId, pathValue] of Object.entries(coverSources)) {
  const replacement = Object.values(replacements).find((item) => item.url.includes(videoId));
  covers[videoId] = {
    path: pathValue,
    source: replacement?.source || "YouTube",
    title: replacement?.title || videoId,
    status: "ready",
  };
}
await writeFile(coversPath, `${JSON.stringify(covers, null, 2)}\n`);

console.log(`Updated ${Object.keys(replacements).length} unavailable video sources and ${Object.keys(coverSources).length} cover references.`);
