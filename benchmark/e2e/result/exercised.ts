// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Free of DOM/Playwright/Node imports (compiled by the root tsconfig too).

import { EXERCISED_COMPONENT_PREFIXES } from "./constants";
import type {
  ExercisedComponents,
  ExercisedComponentsInput,
  ExercisedPanelType,
} from "./exercised.types";
import { compareCodeUnits } from "../shared/compare";

/** Common prefix of every `EXERCISED_COMPONENT_PREFIXES` entry (cheap pre-filter). */
const PIPELINE_PREFIX = "pipeline.";

function pipelineComponentOf(metric: string): string | undefined {
  if (!metric.startsWith(PIPELINE_PREFIX)) {
    return undefined;
  }
  return EXERCISED_COMPONENT_PREFIXES.find(([prefix]) => metric.startsWith(prefix))?.[1];
}

function pipelineComponents(samples: ExercisedComponentsInput["samples"]): string[] {
  const components = new Set<string>();
  const seenMetrics = new Set<string>();
  for (const { metric } of samples) {
    if (seenMetrics.has(metric)) {
      continue;
    }
    seenMetrics.add(metric);
    const component = pipelineComponentOf(metric);
    if (component != undefined) {
      components.add(component);
    }
  }
  return [...components].sort(compareCodeUnits);
}

function panelTypes(panels: ExercisedComponentsInput["summary"]["panels"]): ExercisedPanelType[] {
  const counts = new Map<string, number>();
  for (const panel of Object.values(panels ?? {})) {
    counts.set(panel.panelType, (counts.get(panel.panelType) ?? 0) + 1);
  }
  return [...counts]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => compareCodeUnits(a.type, b.type));
}

function panelsDeclaredWithoutTelemetry(input: ExercisedComponentsInput): string[] {
  const observed = input.summary.panels ?? {};
  return (input.run.scenario?.panels ?? [])
    .map((panel) => panel.id)
    .filter((id) => !Object.hasOwn(observed, id))
    .sort(compareCodeUnits);
}

/**
 * What a run exercised, from its telemetry: the product pipeline components that emitted metrics
 * (sample metric prefix -> component, `EXERCISED_COMPONENT_PREFIXES`), the panel types with panel
 * telemetry, and the layout panels the scenario declared but that produced no panel telemetry
 * (e.g. never mounted, or a scenario run with telemetry off). All lists are sorted by code units.
 */
export function exercisedComponents(input: ExercisedComponentsInput): ExercisedComponents {
  return {
    pipelineComponents: pipelineComponents(input.samples),
    panelTypes: panelTypes(input.summary.panels),
    panelsDeclaredWithoutTelemetry: panelsDeclaredWithoutTelemetry(input),
  };
}
