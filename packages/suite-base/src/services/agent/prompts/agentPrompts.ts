// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import type { IAppConfiguration } from "@lichtblick/suite-base/context/AppConfigurationContext";
import { SKILL_REGISTRY, type Skill } from "@lichtblick/suite-base/services/agent/local/skills";

/**
 * User customization of the agent's prompt and skills.
 *
 * Built-in skills are never mutated. An override records the edited body separately and is applied
 * on read, so a user can always revert to the shipped text and so an updated built-in skill is not
 * silently lost behind a stale copy of it.
 */
export type AgentPromptCustomization = {
  /** Free-text instructions appended to the system prompt on every turn. */
  instructions: string;
  /** Replacement bodies for built-in skills, keyed by skill id. */
  skillOverrides: Record<string, string>;
  /** Skills defined entirely by the user. */
  customSkills: Skill[];
};

export const AGENT_PROMPT_MAX_INSTRUCTIONS_LENGTH = 8000;
export const AGENT_PROMPT_MAX_SKILL_BODY_LENGTH = 20000;
export const AGENT_PROMPT_MAX_CUSTOM_SKILLS = 20;

/** Custom skill ids must not collide with built-ins and must be usable in the load_skill enum. */
export const CUSTOM_SKILL_ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/u;

export class AgentPromptValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AgentPromptValidationError";
  }
}

export const EMPTY_CUSTOMIZATION: AgentPromptCustomization = {
  instructions: "",
  skillOverrides: {},
  customSkills: [],
};

function isSkill(value: unknown): value is Skill {
  if (typeof value !== "object" || value == undefined) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.whenToUse === "string" &&
    typeof candidate.body === "string"
  );
}

/**
 * Reads the stored customization. Malformed storage degrades to "no customization" rather than
 * throwing: a bad edit must not make the agent unusable.
 */
export function readAgentPromptCustomization(
  configuration: IAppConfiguration,
): AgentPromptCustomization {
  const raw = configuration.get(AppSetting.AGENT_PROMPT_CUSTOMIZATION);
  if (typeof raw !== "string" || raw.length === 0) {
    return EMPTY_CUSTOMIZATION;
  }
  try {
    // Deliberately typed as unknown: this is user-edited JSON from storage, so every field has to
    // be narrowed rather than asserted.
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed == undefined) {
      return EMPTY_CUSTOMIZATION;
    }
    const record = parsed as Record<string, unknown>;
    const overrides = record.skillOverrides;
    const customSkills = record.customSkills;
    return {
      instructions: typeof record.instructions === "string" ? record.instructions : "",
      skillOverrides:
        typeof overrides === "object" && overrides != undefined && !Array.isArray(overrides)
          ? Object.fromEntries(
              Object.entries(overrides).filter(
                (entry): entry is [string, string] =>
                  typeof entry[1] === "string" && SKILL_REGISTRY.has(entry[0]),
              ),
            )
          : {},
      customSkills: Array.isArray(customSkills) ? customSkills.filter(isSkill) : [],
    };
  } catch {
    return EMPTY_CUSTOMIZATION;
  }
}

export function validateAgentPromptCustomization(value: AgentPromptCustomization): void {
  if (value.instructions.length > AGENT_PROMPT_MAX_INSTRUCTIONS_LENGTH) {
    throw new AgentPromptValidationError(
      `Instructions must be at most ${String(AGENT_PROMPT_MAX_INSTRUCTIONS_LENGTH)} characters`,
    );
  }
  for (const [id, body] of Object.entries(value.skillOverrides)) {
    if (!SKILL_REGISTRY.has(id)) {
      throw new AgentPromptValidationError(`"${id}" is not a built-in skill`);
    }
    if (body.length > AGENT_PROMPT_MAX_SKILL_BODY_LENGTH) {
      throw new AgentPromptValidationError(
        `Skill "${id}" must be at most ${String(AGENT_PROMPT_MAX_SKILL_BODY_LENGTH)} characters`,
      );
    }
  }
  if (value.customSkills.length > AGENT_PROMPT_MAX_CUSTOM_SKILLS) {
    throw new AgentPromptValidationError(
      `At most ${String(AGENT_PROMPT_MAX_CUSTOM_SKILLS)} custom skills are supported`,
    );
  }
  const seen = new Set<string>();
  for (const skill of value.customSkills) {
    if (!CUSTOM_SKILL_ID_PATTERN.test(skill.id)) {
      throw new AgentPromptValidationError(
        `Skill id "${skill.id}" must be lowercase words separated by hyphens`,
      );
    }
    if (SKILL_REGISTRY.has(skill.id)) {
      throw new AgentPromptValidationError(
        `Skill id "${skill.id}" is already used by a built-in skill; edit that skill instead`,
      );
    }
    if (seen.has(skill.id)) {
      throw new AgentPromptValidationError(`Duplicate skill id "${skill.id}"`);
    }
    seen.add(skill.id);
    if (skill.whenToUse.trim().length === 0 || skill.body.trim().length === 0) {
      throw new AgentPromptValidationError(
        `Skill "${skill.id}" needs both a "when to use" line and a body`,
      );
    }
    if (skill.body.length > AGENT_PROMPT_MAX_SKILL_BODY_LENGTH) {
      throw new AgentPromptValidationError(
        `Skill "${skill.id}" must be at most ${String(AGENT_PROMPT_MAX_SKILL_BODY_LENGTH)} characters`,
      );
    }
  }
}

export async function writeAgentPromptCustomization(
  configuration: IAppConfiguration,
  value: AgentPromptCustomization,
): Promise<void> {
  validateAgentPromptCustomization(value);
  const isEmpty =
    value.instructions.trim().length === 0 &&
    Object.keys(value.skillOverrides).length === 0 &&
    value.customSkills.length === 0;
  await configuration.set(
    AppSetting.AGENT_PROMPT_CUSTOMIZATION,
    isEmpty ? undefined : JSON.stringify(value),
  );
}

/**
 * The effective skill set: built-ins with any override applied, followed by custom skills.
 *
 * Built-in order is preserved so the prompt index stays stable as a user edits bodies. Custom
 * skills are always indexed: the built-in-only `indexed` marker is stripped from them so a
 * user-defined skill can never hide itself from the prompt index via that flag.
 */
export function resolveSkills(customization: AgentPromptCustomization): Skill[] {
  const builtIns = [...SKILL_REGISTRY.values()].map((skill) => {
    const override = customization.skillOverrides[skill.id];
    return override == undefined ? skill : { ...skill, body: override };
  });
  const builtInIds = new Set(builtIns.map((skill) => skill.id));
  // A custom skill colliding with a built-in is rejected on write, but stored data can predate a
  // newly added built-in; drop rather than shadow it.
  return [
    ...builtIns,
    ...customization.customSkills
      .filter((skill) => !builtInIds.has(skill.id))
      // Strip the built-in-only `indexed` marker so custom skills always enter the index.
      .map(({ id, name, whenToUse, body }) => ({ id, name, whenToUse, body })),
  ];
}
