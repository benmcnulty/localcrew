export interface VoicePreset {
  key: string;
  voice: string;
  description: string;
}

const LEGACY_PRESET_ALIASES: Record<string, string> = {
  albert: "reed_us",
  eddy: "eddy_us",
  flo: "flo_us"
};

export const VOICE_PRESETS: VoicePreset[] = [
  {
    key: "siri",
    voice: "Siri",
    description: "Apple Siri voice when installed for `say`."
  },
  {
    key: "allison",
    voice: "Allison (Enhanced)",
    description: "Warm enhanced US English with a polished, natural lead voice."
  },
  {
    key: "zoe",
    voice: "Zoe (Premium)",
    description: "Premium US English voice with a composed, articulate feminine delivery."
  },
  {
    key: "samantha",
    voice: "Samantha (Enhanced)",
    description: "Enhanced US English voice with clear diction and steady conversational tone."
  },
  {
    key: "evan",
    voice: "Evan (Enhanced)",
    description: "Enhanced US English masculine voice with the most natural delivery in the set."
  },
  {
    key: "daniel",
    voice: "Daniel",
    description: "Refined UK English voice with a polished delivery."
  },
  {
    key: "reed_us",
    voice: "Reed (English (US))",
    description: "Clear US English with the most natural studio-style delivery in the set."
  },
  {
    key: "reed_uk",
    voice: "Reed (English (UK))",
    description: "Calm UK English with the same high-clarity neural delivery as the US Reed voice."
  },
  {
    key: "eddy_uk",
    voice: "Eddy (English (UK))",
    description: "Polished UK English with a composed and articulate sound."
  },
  {
    key: "eddy_us",
    voice: "Eddy (English (US))",
    description: "Direct US English with a crisp modern tone."
  },
  {
    key: "flo_us",
    voice: "Flo (English (US))",
    description: "Smooth US English with a softer but still highly coherent tone."
  },
  {
    key: "sandy_us",
    voice: "Sandy (English (US))",
    description: "Bright US English with an even, highly intelligible assistant-style delivery."
  },
  {
    key: "sandy_uk",
    voice: "Sandy (English (UK))",
    description: "Clean UK English with a steady modern tone."
  },
  {
    key: "flo_uk",
    voice: "Flo (English (UK))",
    description: "Smooth UK English with a measured conversational style."
  }
];

const DEFAULT_VOICE_PRESETS: Record<string, string> = {
  cap: "allison",
  vic: "zoe",
  min: "samantha",
  pav: "evan"
};

const GENERATED_DEFAULT_VOICE_PRESETS: Record<string, string[]> = {
  cap: ["siri", "reed_us", "flo_us"],
  vic: ["zoe", "eddy_uk", "sandy_uk"],
  min: ["samantha", "eddy_us", "sandy_us"],
  pav: ["daniel", "flo_uk", "reed_us"]
};

function getCanonicalAlias(alias: string): string {
  return alias.toLowerCase();
}

export function getDefaultVoicePreset(alias: string): string {
  return DEFAULT_VOICE_PRESETS[getCanonicalAlias(alias)] ?? "allison";
}

export function getGeneratedDefaultVoicePresets(alias: string): string[] {
  return GENERATED_DEFAULT_VOICE_PRESETS[getCanonicalAlias(alias)] ?? [];
}

export function getVoicePreset(key: string): VoicePreset | undefined {
  const normalizedKey = key.toLowerCase();
  const resolvedKey = LEGACY_PRESET_ALIASES[normalizedKey] ?? normalizedKey;
  return VOICE_PRESETS.find((preset) => preset.key === resolvedKey);
}

export function voicePresetExists(key: string): boolean {
  return getVoicePreset(key) !== undefined;
}

export function hasVoicePreset(value: unknown): value is string {
  return typeof value === "string" && voicePresetExists(value);
}

export function normalizeVoicePreset(key: string, alias?: string): string {
  const normalizedKey = key.toLowerCase();
  const resolvedKey = LEGACY_PRESET_ALIASES[normalizedKey] ?? normalizedKey;

  if (voicePresetExists(resolvedKey)) {
    return resolvedKey;
  }

  return getDefaultVoicePreset(alias ?? "");
}
