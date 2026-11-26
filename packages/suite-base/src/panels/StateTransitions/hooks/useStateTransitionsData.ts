// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useMemo, useRef } from "react";

import { Time } from "@lichtblick/rostime";
import {
  MessageAndData,
  MessageDataItemsByPath,
} from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { ChartDatasets } from "@lichtblick/suite-base/components/TimeBasedChart/types";
import {
  ROW_MARGIN,
  ROW_SPACING,
} from "@lichtblick/suite-base/panels/StateTransitions/hooks/constants";
import { UseStateTransitionsData } from "@lichtblick/suite-base/panels/StateTransitions/hooks/types";
import {
  messagesToDataset,
  StateTransitionDatasetBuilder,
} from "@lichtblick/suite-base/panels/StateTransitions/messagesToDataset";
import { datasetContainsArray } from "@lichtblick/suite-base/panels/StateTransitions/shared";
import {
  PathState,
  StateTransitionPath,
} from "@lichtblick/suite-base/panels/StateTransitions/types";

type Blocks = readonly (readonly MessageAndData[] | undefined)[];

// Every path field the dataset builder reads must be listed, or editing it won't rebuild the chart.
export const DATASET_PATH_FIELDS = ["value", "label", "timestampMethod"] as const;

type BlockDatasetCache = {
  key: string;
  blocks: Blocks;
  processedCounts: number[];
  builder: StateTransitionDatasetBuilder;
};

/**
 * Block arrays only grow while range data loads, so the builder can continue where it stopped
 * unless a block was replaced or shrank, or new messages would land before already processed ones.
 */
function canContinue(cache: BlockDatasetCache, key: string, blocks: Blocks): boolean {
  if (cache.key !== key || cache.blocks.length !== blocks.length) {
    return false;
  }
  let earlierBlockGrew = false;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const length = block?.length ?? 0;
    const processed = cache.processedCounts[i] ?? 0;
    if (block !== cache.blocks[i] || length < processed || (earlierBlockGrew && length > 0)) {
      return false;
    }
    earlierBlockGrew ||= length > processed;
  }
  return true;
}

function useStateTransitionsData(
  paths: StateTransitionPath[],
  startTime: Readonly<Time> | undefined,
  itemsByPath: MessageDataItemsByPath,
  decodedBlocks: MessageDataItemsByPath[],
  // eslint-disable-next-line @lichtblick/no-boolean-parameters
  showPoints: boolean,
): UseStateTransitionsData {
  const blockCachesRef = useRef(new Map<number, BlockDatasetCache>());

  return useMemo(() => {
    const blockCaches = blockCachesRef.current;
    // ignore all data when we don't have a start time
    if (!startTime) {
      blockCaches.clear();
      return {
        data: { datasets: [] },
        minY: undefined,
        pathState: [],
      };
    }

    let outMinY: number | undefined;
    const outDatasets: ChartDatasets = [];
    const outPathState: PathState[] = [];

    paths.forEach((path, pathIndex) => {
      const y = -(pathIndex + 1) * ROW_SPACING;
      outMinY = Math.min(outMinY ?? y, y - ROW_MARGIN);

      const blocksForPath = decodedBlocks.map((decodedBlock) => decodedBlock[path.value]);

      const key =
        JSON.stringify([
          ...DATASET_PATH_FIELDS.map((field) => path[field]),
          y,
          showPoints,
          startTime.sec,
          startTime.nsec,
        ]) ?? "";
      let cache = blockCaches.get(pathIndex);
      if (cache == undefined || !canContinue(cache, key, blocksForPath)) {
        cache = {
          key,
          blocks: blocksForPath,
          processedCounts: blocksForPath.map(() => 0),
          builder: new StateTransitionDatasetBuilder({ path, startTime, y, showPoints }),
        };
        blockCaches.set(pathIndex, cache);
      }
      for (let i = 0; i < blocksForPath.length; i++) {
        const block = blocksForPath[i];
        if (block != undefined) {
          cache.builder.append(block, cache.processedCounts[i]);
          cache.processedCounts[i] = block.length;
        }
      }
      const newBlockDataSet = cache.builder.dataset();

      const items = itemsByPath[path.value];
      const isArray = datasetContainsArray([...blocksForPath, items]);

      outPathState.push({
        path,
        isArray,
      });
      outDatasets.push(newBlockDataSet);

      if (items == undefined) {
        return;
      }

      const newPathDataSet = messagesToDataset({
        blocks: [items],
        path,
        pathIndex,
        startTime,
        y,
        showPoints,
      });
      outDatasets.push(newPathDataSet);
    });

    for (const pathIndex of blockCaches.keys()) {
      if (pathIndex >= paths.length) {
        blockCaches.delete(pathIndex);
      }
    }

    return {
      data: { datasets: outDatasets },
      minY: outMinY,
      pathState: outPathState,
    };
  }, [decodedBlocks, itemsByPath, paths, startTime, showPoints]);
}

export default useStateTransitionsData;
