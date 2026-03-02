import { describe, expect, test } from "bun:test";

import { fetchWeather } from "../src/weather.ts";

describe("fetchWeather", () => {
  test("formats current conditions and forecast", async () => {
    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          nearest_area: [
            {
              areaName: [{ value: "San Francisco" }],
              country: [{ value: "United States" }],
            },
          ],
          current_condition: [
            {
              temp_F: "62",
              temp_C: "17",
              FeelsLikeF: "60",
              FeelsLikeC: "16",
              humidity: "72",
              windspeedMiles: "12",
              winddir16Point: "W",
              weatherDesc: [{ value: "Partly cloudy" }],
            },
          ],
          weather: [
            {
              date: "2025-01-15",
              maxtempF: "65",
              mintempF: "50",
              maxtempC: "18",
              mintempC: "10",
            },
            {
              date: "2025-01-16",
              maxtempF: "68",
              mintempF: "52",
              maxtempC: "20",
              mintempC: "11",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );

    const result = await fetchWeather("San Francisco", mockFetch);
    expect(result.location).toBe("San Francisco");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.summary).toContain("Partly cloudy");
    expect(result.summary).toContain("62°F");
    expect(result.summary).toContain("Humidity: 72%");
    expect(result.summary).toContain("Wind: 12 mph W");
    expect(result.summary).toContain("Forecast:");
    expect(result.summary).toContain("2025-01-15");
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0]).toContain("Weather chunk 1/");
  });

  test("throws on empty location", async () => {
    await expect(fetchWeather("", async () => new Response(""))).rejects.toThrow(
      "empty"
    );
  });

  test("throws on non-OK response", async () => {
    await expect(
      fetchWeather("nowhere", async () => new Response("Bad", { status: 500 }))
    ).rejects.toThrow("500");
  });

  test("handles minimal API response", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const result = await fetchWeather("90210", mockFetch);
    expect(result.location).toBe("90210");
    expect(result.summary).toContain("Weather for 90210");
    expect(result.chunks.length).toBeGreaterThan(0);
  });
});
