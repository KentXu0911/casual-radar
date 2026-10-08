import assert from "node:assert/strict";
import test from "node:test";
import { publicAssetUrl } from "../app/public-asset-url.ts";

test("loads data and covers under a Pages project path without altering external links", () => {
  assert.equal(publicAssetUrl("/games.json?v=1", "/casual-radar/"), "/casual-radar/games.json?v=1");
  assert.equal(publicAssetUrl("/video-thumbnails/实机.jpg", "/casual-radar/"), "/casual-radar/video-thumbnails/实机.jpg");
  assert.equal(publicAssetUrl("/casual-radar/favicon.svg", "/casual-radar/"), "/casual-radar/favicon.svg");
  assert.equal(publicAssetUrl("/games.json", "/"), "/games.json");
  assert.equal(publicAssetUrl("https://www.bilibili.com/video/BV1/", "/casual-radar/"), "https://www.bilibili.com/video/BV1/");
  assert.equal(publicAssetUrl("//example.com/cover.jpg", "/casual-radar/"), "//example.com/cover.jpg");
});
