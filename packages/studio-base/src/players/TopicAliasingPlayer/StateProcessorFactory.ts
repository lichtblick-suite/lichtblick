// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { TopicAliasFunction, Immutable as Im } from "@foxglove/studio";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { PlayerProblem, Topic } from "@foxglove/studio-base/players/types";

import { AliasingStateProcessor, TopicAliasMap } from "./AliasingStateProcessor";
import { IStateProcessor } from "./IStateProcessor";
import { NoopStateProcessor } from "./NoopStateProcessor";

export type TopicAliasFunctions = Array<{ extensionId: string; aliasFunction: TopicAliasFunction }>;

export type StateFactoryInput = {
  aliasFunctions: TopicAliasFunctions;
  topics: undefined | Topic[];
  variables: GlobalVariables;
};

/**
 * StateProcessorFactory builds instances of IStateProcessor from sets of inputs.
 *
 * Its purpose is to manage idempotency and memoization of the input and output to only build a new
 * processor when a set of alias function outputs results in a semantically different output.
 */
export class StateProcessorFactory {
  #aliases: TopicAliasMap = new Map();
  #stateProcessor: IStateProcessor = new NoopStateProcessor();

  /**
   * Build a state processor instance from the inputs.
   *
   * Returns a StateProcessor instance from the inputs and alias functions. This builder keeps
   * track of inputs and alias function outputs and will only create a new state processor if the
   * output values change. If the output values are unchanged, the existing state processor
   * instance is returned.
   */
  public buildStateProcessor(input: Im<StateFactoryInput>): IStateProcessor {
    const mappings = input.aliasFunctions.map((mapper) => ({
      extensionId: mapper.extensionId,
      aliases: mapper.aliasFunction({
        topics: input.topics ?? [],
        globalVariables: input.variables,
      }),
    }));

    const anyMappings = mappings.some((map) => [...map.aliases].length > 0);
    if (!anyMappings) {
      this.#aliases = new Map();

      // We are already using a no-op state processor so we can keep the same reference Technically
      // with a no-op processor its ok if the reference changes since its a no-op but this check
      // keeps the semnatics more consistent.
      if (this.#stateProcessor instanceof NoopStateProcessor) {
        return this.#stateProcessor;
      }
      return (this.#stateProcessor = new NoopStateProcessor());
    }

    const { aliasMap, problems } = mergeAliases(mappings, input);

    // When the output of aliasing is the same list of topics, then we can keep our existing state
    // processor. This keep the state processor instance unchanged and preserves memoizations.
    if (_.isEqual(aliasMap, this.#aliases)) {
      return this.#stateProcessor;
    }

    this.#aliases = aliasMap;
    return (this.#stateProcessor = new AliasingStateProcessor(aliasMap, problems));
  }
}

// Merges multiple aliases into a single unified alias map. Note that a single topic name
// can alias to more than one renamed topic if multiple extensions provide an alias for it.
// Also returns any problems caused by disallowed aliases.
function mergeAliases(
  maps: Im<{ extensionId: string; aliases: ReturnType<TopicAliasFunction> }[]>,
  inputs: Im<StateFactoryInput>,
): {
  aliasMap: TopicAliasMap;
  problems: undefined | PlayerProblem[];
} {
  const inverseMapping = new Map<string, string>();
  const problems: PlayerProblem[] = [];
  const merged: TopicAliasMap = new Map();
  const topics = inputs.topics ?? [];
  for (const { extensionId, aliases } of maps) {
    for (const { name, sourceTopicName } of aliases) {
      const existingMapping = inverseMapping.get(name);
      if (topics.some((topic) => topic.name === name)) {
        problems.push({
          severity: "error",
          message: `Disallowed topic alias`,
          tip: `Extension ${extensionId} aliased topic ${name} is already present in the data source.`,
        });
      } else if (existingMapping != undefined && existingMapping !== sourceTopicName) {
        problems.push({
          severity: "error",
          message: `Disallowed topic alias`,
          tip: `Extension ${extensionId} requested duplicate alias from topic ${sourceTopicName} to topic ${name}.`,
        });
      } else {
        inverseMapping.set(name, sourceTopicName);
        const mergedValues = _.uniq(merged.get(sourceTopicName) ?? []).concat(name);
        merged.set(sourceTopicName, mergedValues);
      }
    }
  }
  return { aliasMap: merged, problems: problems.length > 0 ? problems : undefined };
}
