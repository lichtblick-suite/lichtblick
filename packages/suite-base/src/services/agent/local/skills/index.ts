// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DATA_QUERY_SKILL } from "./dataQuery";
import { LAYOUT_AUTHORING_SKILL } from "./layoutAuthoring";
import { PANEL_CATALOG_SKILL } from "./panelCatalog";
import { PANEL_3D_SKILL } from "./panels/3d";
import { PANEL_GAUGE_SKILL } from "./panels/gauge";
import { PANEL_IMAGE_SKILL } from "./panels/image";
import { PANEL_INDICATOR_SKILL } from "./panels/indicator";
import { PANEL_MAP_SKILL } from "./panels/map";
import { PANEL_PIE_CHART_SKILL } from "./panels/pieChart";
import { PANEL_PLOT_SKILL } from "./panels/plot";
import { PANEL_RAW_MESSAGES_SKILL } from "./panels/rawMessages";
import { PANEL_RAW_MESSAGES_VIRTUAL_SKILL } from "./panels/rawMessagesVirtual";
import { PANEL_ROSOUT_SKILL } from "./panels/rosOut";
import { PANEL_SOURCE_INFO_SKILL } from "./panels/sourceInfo";
import { PANEL_STATE_TRANSITIONS_SKILL } from "./panels/stateTransitions";
import { PANEL_TABLE_SKILL } from "./panels/table";
import type { Skill } from "./types";
import { USER_SCRIPTS_SKILL } from "./userScripts";

export type { Skill } from "./types";

const SKILLS: readonly Skill[] = [
  DATA_QUERY_SKILL,
  PANEL_CATALOG_SKILL,
  LAYOUT_AUTHORING_SKILL,
  USER_SCRIPTS_SKILL,
  // Per-panel reference detail. Marked indexed: false so the prompt index stays small; the
  // panel-catalog skill routes to them by id before any panel is proposed.
  PANEL_3D_SKILL,
  PANEL_PLOT_SKILL,
  PANEL_IMAGE_SKILL,
  PANEL_RAW_MESSAGES_SKILL,
  PANEL_RAW_MESSAGES_VIRTUAL_SKILL,
  PANEL_TABLE_SKILL,
  PANEL_GAUGE_SKILL,
  PANEL_MAP_SKILL,
  PANEL_STATE_TRANSITIONS_SKILL,
  PANEL_INDICATOR_SKILL,
  PANEL_PIE_CHART_SKILL,
  PANEL_SOURCE_INFO_SKILL,
  PANEL_ROSOUT_SKILL,
];

export const SKILL_REGISTRY: ReadonlyMap<string, Skill> = new Map(
  SKILLS.map((skill) => [skill.id, skill]),
);

/**
 * Tool-schema enum for `load_skill`. Non-empty tuple type so the schema cannot degrade to an empty
 * enum if the registry is ever emptied.
 */
export const SKILL_IDS: readonly [string, ...string[]] = [
  SKILLS[0]!.id,
  ...SKILLS.slice(1).map((skill) => skill.id),
];

/**
 * The one-line-per-skill index carried in the system prompt. Defaults to the built-ins; callers
 * with user customization pass the resolved set instead.
 *
 * Skills marked `indexed: false` are registered and loadable but deliberately left out of the
 * index: they are reference detail reached through a routing skill (see `panel-catalog`), so the
 * base prompt does not pay for lines the agent should not load directly.
 */
export function buildSkillIndex(skills: readonly Skill[] = SKILLS): string {
  return skills
    .filter((skill) => skill.indexed !== false)
    .map((skill) => `- ${skill.id}: ${skill.whenToUse}`)
    .join("\n");
}

/**
 * Renders a loaded skill for the tool result. Bodies carry their own heading, so this only adds
 * the identifier the agent used to load it.
 */
export function renderSkill(skill: Skill): string {
  return `<skill id="${skill.id}">\n${skill.body}\n</skill>`;
}
