// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  MessagePathStructureItemMessage,
  parseMessagePath,
} from "@lichtblick/message-path";
import { Immutable } from "@lichtblick/suite";
import {
  messagePathStructures,
  traverseStructure,
  validTerminatingStructureItem,
} from "@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype";
import {
  isReferenceLinePlotPathType,
  PlotPath,
} from "@lichtblick/suite-base/panels/Plot/utils/config";
import { PLOTABLE_ROS_TYPES } from "@lichtblick/suite-base/panels/shared/constants";
import { Topic } from "@lichtblick/suite-base/players/types";
import type { AgentSafeLayoutData } from "@lichtblick/suite-base/services/agent/layoutSchema";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";
import type { SavedProps } from "@lichtblick/suite-base/types/panels";
import { getPanelTypeFromId } from "@lichtblick/suite-base/util/layout";

const PLOT_PANEL_TYPE = "Plot";

export type SanitizePlotPathsResult = {
  data: AgentSafeLayoutData;
  droppedCount: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != undefined && !Array.isArray(value);
}

/**
 * Validates one Plot path value against the loaded data source.
 *
 * - topic 不在已加载数据中 → 丢弃（无效 topic）。
 * - topic 存在但 schema 缺失/不完整（structures 中查不到）→ 视为不可验证 → 保留。
 * - 字段链 traversal 失败 → 丢弃（无效字段）。
 * - traversal 成功后仍需 validTerminatingStructureItem 确认终止字段可绘制：
 *   字段存在但终止于 message / 未切片数组等不可绘制类型的 path 同样丢弃。
 */
function isPlottableMessagePath(
  value: string,
  topicNames: ReadonlySet<string>,
  schemaByTopic: ReadonlyMap<string, string>,
  structures: Record<string, MessagePathStructureItemMessage>,
): boolean {
  const parsed = parseMessagePath(value);
  if (parsed == undefined) {
    // 无法解析的路径不可能渲染，丢弃。
    return false;
  }
  const { topicName, messagePath } = parsed;

  if (!topicNames.has(topicName)) {
    // topic 不在已加载数据中 → 丢弃（无效 topic）。
    return false;
  }
  const schemaName = schemaByTopic.get(topicName);
  if (schemaName == undefined) {
    // topic 存在但 schema 缺失 → 不可验证 → 保守保留。
    return true;
  }
  const structure = structures[schemaName];
  if (structure == undefined) {
    // topic 存在但 schema 缺失/不完整：不可验证 → 保守保留。
    return true;
  }
  const result = traverseStructure(structure, messagePath);
  if (!result.valid) {
    return false;
  }
  return validTerminatingStructureItem(result.structureItem, PLOTABLE_ROS_TYPES);
}

/**
 * 按已加载数据校验 Agent 下发 layout 中所有 Plot 面板的 paths，丢弃不可绘制的曲线。
 *
 * 过滤入口约定（services/agent/workspaceTools.ts 的 applyLayout）：本函数在 layoutSchema
 * 结构校验之后、保存之前执行，此时同时拥有最新 topics/datatypes。layoutSchema 保持为无
 * 上下文的结构安全边界，不做存在性校验。
 *
 * 保留策略：
 * - 数字字符串参考线（Plot/utils/config.ts:50 合法）直接跳过校验；
 * - slice/filter/modifier 表达式本身原样保留（仅校验基础 topic/字段链，改动不裁剪表达式）；
 * - topic 存在但 schema 缺失/不完整的 path（不可验证 → 保留）。
 *
 * 异常兜底：messagePathStructures(datatypes) 在 root schema 引用的嵌套 datatype 缺失时会抛
 * 异常（messagePathsForDatatype.ts:110）——结构构建 try/catch，抛异常时保守跳过整个过滤
 * （全部保留），applyLayout 不得因此失败。
 *
 * 数据源未加载（topics 为空）时不过滤。
 *
 * 若过滤后某 Plot 的 paths 变空：显式置位 autoSeeded: true，阻止 useAutoSeedPlotPaths
 * 再自动填入无关曲线（codex 指出的连锁行为）。
 */
export function sanitizePlotPaths(
  data: AgentSafeLayoutData,
  topics: readonly Topic[],
  datatypes: Immutable<RosDatatypes>,
): SanitizePlotPathsResult {
  if (topics.length === 0) {
    return { data, droppedCount: 0 };
  }

  let structures: Record<string, MessagePathStructureItemMessage>;
  try {
    structures = messagePathStructures(datatypes);
  } catch {
    return { data, droppedCount: 0 };
  }

  const topicNames = new Set<string>();
  const schemaByTopic = new Map<string, string>();
  for (const topic of topics) {
    topicNames.add(topic.name);
    if (topic.schemaName != undefined) {
      schemaByTopic.set(topic.name, topic.schemaName);
    }
  }

  let droppedCount = 0;
  let changed = false;
  const configById: SavedProps = {};
  for (const [panelId, config] of Object.entries(data.configById)) {
    if (
      getPanelTypeFromId(panelId) !== PLOT_PANEL_TYPE ||
      !isPlainObject(config) ||
      !Array.isArray(config.paths)
    ) {
      configById[panelId] = config;
      continue;
    }

    const paths = config.paths as ReadonlyArray<unknown>;
    const kept: unknown[] = [];
    for (const path of paths) {
      if (!isPlainObject(path) || typeof path.value !== "string") {
        // layoutSchema 已保证 Plot paths 元素为带字符串 value 的对象；双保险直接保留。
        kept.push(path);
        continue;
      }
      if (isReferenceLinePlotPathType(path as unknown as Immutable<PlotPath>)) {
        kept.push(path);
        continue;
      }
      if (isPlottableMessagePath(path.value, topicNames, schemaByTopic, structures)) {
        kept.push(path);
      } else {
        droppedCount++;
      }
    }

    if (kept.length === paths.length) {
      configById[panelId] = config;
    } else {
      changed = true;
      // 仅当过滤后 paths 为空时显式置位 autoSeeded，阻止 useAutoSeedPlotPaths 自动填入；
      // 部分丢弃时保留原 autoSeeded 值，不强制置位。
      configById[panelId] =
        kept.length === 0
          ? { ...config, paths: kept, autoSeeded: true }
          : { ...config, paths: kept };
    }
  }

  if (!changed) {
    return { data, droppedCount: 0 };
  }
  return { data: { ...data, configById }, droppedCount };
}
