import test from "node:test";
import assert from "node:assert/strict";
import { formatObservedWind, milesPerHour } from "../src/weather-data.js";

test("converts NWS kilometers per hour instead of treating it as meters per second", () => {
  assert.equal(Math.round(milesPerHour({ value: 18.504, unitCode: "wmoUnit:km_h-1" })), 11);
  assert.equal(formatObservedWind(
    { value: 18.504, unitCode: "wmoUnit:km_h-1" },
    { value: 60 },
    { value: null, unitCode: "wmoUnit:km_h-1" }
  ), "11 mph NE");
});

test("shows a gust only when NWS supplies a valid gust exceeding sustained wind", () => {
  assert.equal(formatObservedWind(
    { value: 10, unitCode: "wmoUnit:m_s-1" },
    { value: 90 },
    { value: 15, unitCode: "wmoUnit:m_s-1" }
  ), "22 mph E · Gust 34 mph");
});

test("does not render missing or unsupported wind speed as a numeric value", () => {
  assert.equal(formatObservedWind({ value: null, unitCode: "wmoUnit:km_h-1" }, { value: 90 }), "Unavailable");
  assert.equal(formatObservedWind({ value: 10, unitCode: "wmoUnit:unknown" }, { value: 90 }), "Unavailable");
});
