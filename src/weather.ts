import type { FetchFn } from "./ollama.ts";
import { chunkText } from "./page-fetcher.ts";
import type { WeatherResult } from "./types.ts";

const DEFAULT_TIMEOUT_MS = 10_000;
const WTTR_BASE = "https://wttr.in";

/**
 * Fetch current weather for a location using wttr.in's plain-text API.
 * Returns a structured result with chunked text for prompt injection.
 */
export async function fetchWeather(
  location: string,
  fetchFn: FetchFn = fetch,
  timeout = DEFAULT_TIMEOUT_MS
): Promise<WeatherResult> {
  const trimmed = location.trim();
  if (!trimmed) {
    throw new Error("Weather location cannot be empty.");
  }

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const encoded = encodeURIComponent(trimmed);
    const url = `${WTTR_BASE}/${encoded}?format=j1`;
    const response = await fetchFn(url, {
      headers: { "user-agent": "crusty-local-orchestrator" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}`);
    }

    const data = (await response.json()) as WeatherApiResponse;
    const durationMs = Date.now() - started;

    const summary = formatWeatherSummary(trimmed, data);
    const chunks = chunkText(summary, 1400).map(
      (chunk, index, all) => `Weather chunk ${index + 1}/${all.length}\n${chunk}`
    );

    return {
      location: trimmed,
      durationMs,
      summary,
      chunks,
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ---- wttr.in JSON response shape (partial) ---- */

interface WeatherCondition {
  temp_F?: string;
  temp_C?: string;
  weatherDesc?: { value: string }[];
  humidity?: string;
  windspeedMiles?: string;
  winddir16Point?: string;
  FeelsLikeF?: string;
  FeelsLikeC?: string;
}

interface WeatherForecastDay {
  date?: string;
  maxtempF?: string;
  mintempF?: string;
  maxtempC?: string;
  mintempC?: string;
  hourly?: WeatherCondition[];
}

interface WeatherApiResponse {
  current_condition?: WeatherCondition[];
  weather?: WeatherForecastDay[];
  nearest_area?: { areaName?: { value: string }[]; country?: { value: string }[] }[];
}

function formatWeatherSummary(location: string, data: WeatherApiResponse): string {
  const lines: string[] = [`Weather for ${location}:`];

  const area = data.nearest_area?.[0];
  if (area) {
    const areaName = area.areaName?.[0]?.value ?? "";
    const country = area.country?.[0]?.value ?? "";
    if (areaName || country) {
      lines.push(`Location: ${[areaName, country].filter(Boolean).join(", ")}`);
    }
  }

  const current = data.current_condition?.[0];
  if (current) {
    const desc = current.weatherDesc?.[0]?.value ?? "Unknown";
    lines.push(`Current: ${desc}`);
    if (current.temp_F) {
      lines.push(`Temperature: ${current.temp_F}°F / ${current.temp_C ?? "?"}°C`);
    }
    if (current.FeelsLikeF) {
      lines.push(`Feels like: ${current.FeelsLikeF}°F / ${current.FeelsLikeC ?? "?"}°C`);
    }
    if (current.humidity) {
      lines.push(`Humidity: ${current.humidity}%`);
    }
    if (current.windspeedMiles) {
      lines.push(`Wind: ${current.windspeedMiles} mph ${current.winddir16Point ?? ""}`);
    }
  }

  const forecast = data.weather;
  if (forecast && forecast.length > 0) {
    lines.push("", "Forecast:");
    for (const day of forecast.slice(0, 3)) {
      if (day.date) {
        lines.push(
          `  ${day.date}: ${day.mintempF ?? "?"}–${day.maxtempF ?? "?"}°F (${day.mintempC ?? "?"}–${day.maxtempC ?? "?"}°C)`
        );
      }
    }
  }

  return lines.join("\n");
}
