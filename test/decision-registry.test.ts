import { describe, expect, test } from "bun:test";

import {
  DECISION_POINTS,
  getDecisionsByType,
  type DecisionPoint,
} from "../src/decision-registry.ts";

describe("DECISION_POINTS", () => {
  test("all entries have required fields", () => {
    for (const point of DECISION_POINTS) {
      expect(typeof point.name).toBe("string");
      expect(point.name.length).toBeGreaterThan(0);
      expect(typeof point.module).toBe("string");
      expect(point.module.length).toBeGreaterThan(0);
      expect(typeof point.description).toBe("string");
      expect(point.description.length).toBeGreaterThan(0);
      expect(["deterministic", "inference"]).toContain(point.type);
    }
  });

  test("no duplicate names", () => {
    const names = DECISION_POINTS.map((p: DecisionPoint) => p.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  test("deterministic decisions outnumber inference decisions", () => {
    const deterministic = DECISION_POINTS.filter((p: DecisionPoint) => p.type === "deterministic");
    const inference = DECISION_POINTS.filter((p: DecisionPoint) => p.type === "inference");
    expect(deterministic.length).toBeGreaterThan(inference.length);
  });

  test("has at least 10 decision points", () => {
    expect(DECISION_POINTS.length).toBeGreaterThanOrEqual(10);
  });
});

describe("getDecisionsByType", () => {
  test("returns only deterministic decisions", () => {
    const deterministic = getDecisionsByType("deterministic");
    expect(deterministic.length).toBeGreaterThan(0);
    for (const point of deterministic) {
      expect(point.type).toBe("deterministic");
    }
  });

  test("returns only inference decisions", () => {
    const inference = getDecisionsByType("inference");
    expect(inference.length).toBeGreaterThan(0);
    for (const point of inference) {
      expect(point.type).toBe("inference");
    }
  });

  test("deterministic + inference = total", () => {
    const deterministic = getDecisionsByType("deterministic");
    const inference = getDecisionsByType("inference");
    expect(deterministic.length + inference.length).toBe(DECISION_POINTS.length);
  });
});
