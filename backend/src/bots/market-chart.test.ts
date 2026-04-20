import test from "node:test";
import assert from "node:assert/strict";

import {
  chooseKlineInterval,
  normalizeInterval,
  normalizePriceSource,
  normalizeRange,
  normalizeStartedAt,
  selectRangeStartMs,
  toNullableNumber,
} from "./market-chart";

const DAY_MS = 24 * 60 * 60 * 1000;

test("normalizes range, interval and price source with safe defaults", () => {
  const endMs = Date.parse("2026-03-28T00:00:00.000Z");
  const startMs = endMs - 5 * DAY_MS;

  assert.equal(normalizeRange("30d"), "30d");
  assert.equal(normalizeRange("weird"), "lifetime");
  assert.equal(normalizeInterval("240", startMs, endMs), "240");
  assert.equal(normalizeInterval("bad", startMs, endMs), "60");
  assert.equal(normalizePriceSource("mark"), "mark");
  assert.equal(normalizePriceSource("unsupported"), "market");
});

test("chooses sensible default kline interval from runtime length", () => {
  const endMs = Date.parse("2026-03-28T00:00:00.000Z");

  assert.equal(chooseKlineInterval(endMs - 2 * DAY_MS, endMs), "15");
  assert.equal(chooseKlineInterval(endMs - 10 * DAY_MS, endMs), "60");
  assert.equal(chooseKlineInterval(endMs - 30 * DAY_MS, endMs), "240");
  assert.equal(chooseKlineInterval(endMs - 120 * DAY_MS, endMs), "D");
});

test("selects chart range start for fixed windows and lifetime", () => {
  const endMs = Date.parse("2026-03-28T00:00:00.000Z");
  const lifetimeStartedAt = Date.parse("2026-03-01T00:00:00.000Z");

  assert.equal(selectRangeStartMs("24h", lifetimeStartedAt, endMs), endMs - DAY_MS);
  assert.equal(selectRangeStartMs("7d", lifetimeStartedAt, endMs), endMs - 7 * DAY_MS);
  assert.equal(selectRangeStartMs("30d", lifetimeStartedAt, endMs), endMs - 30 * DAY_MS);
  assert.equal(selectRangeStartMs("90d", lifetimeStartedAt, endMs), endMs - 90 * DAY_MS);
  assert.equal(selectRangeStartMs("1y", lifetimeStartedAt, endMs), endMs - 365 * DAY_MS);
  assert.equal(selectRangeStartMs("lifetime", lifetimeStartedAt, endMs), lifetimeStartedAt);
});

test("normalizes runtime and numeric helper fields from mixed inputs", () => {
  assert.equal(normalizeStartedAt("1774528986726"), 1774528986726);
  assert.equal(normalizeStartedAt("2026-03-26T12:43:06.726Z"), 1774528986726);
  assert.equal(toNullableNumber("66"), 66);
  assert.equal(toNullableNumber(""), null);
});
