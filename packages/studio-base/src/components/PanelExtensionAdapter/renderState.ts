// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { filterMap } from "@foxglove/den/collection";
import Log from "@foxglove/log";
import { compare, toSec } from "@foxglove/rostime";
import {
  AppSettingValue,
  MessageEvent,
  ParameterValue,
  RegisterMessageConverterArgs,
  RenderState,
  Subscription,
  Topic,
} from "@foxglove/studio";
import {
  EMPTY_GLOBAL_VARIABLES,
  GlobalVariables,
} from "@foxglove/studio-base/hooks/useGlobalVariables";
import { PlayerState, Topic as PlayerTopic } from "@foxglove/studio-base/players/types";
import { HoverValue } from "@foxglove/studio-base/types/hoverValue";

const log = Log.getLogger(__filename);

const EmptyParameters = new Map<string, ParameterValue>();

type BuilderRenderStateInput = {
  appSettings: Map<string, AppSettingValue> | undefined;
  colorScheme: RenderState["colorScheme"] | undefined;
  currentFrame: MessageEvent<unknown>[] | undefined;
  globalVariables: GlobalVariables;
  hoverValue: HoverValue | undefined;
  messageConverters?: RegisterMessageConverterArgs<unknown>[];
  playerState: PlayerState | undefined;
  sharedPanelState: Record<string, unknown> | undefined;
  sortedTopics: readonly PlayerTopic[];
  subscriptions: Subscription[];
  watchedFields: Set<string>;
};

type BuildRenderStateFn = (input: BuilderRenderStateInput) => Readonly<RenderState> | undefined;

// Create a string lookup key using fromSchemaName and toSchemaName.
//
// The string key uses a newline delimeter to avoid producting the same key for from/to name values
// that might concatenate to the same string. i.e. "fromName" "toName" and "fromNameto" "Name".
function converterKey(fromSchemaName: string, toSchemaName: string): string {
  return fromSchemaName + "\n" + toSchemaName;
}

/**
 * initRenderStateBuilder creates a function that transforms render state input into a new
 * RenderState
 *
 * This function tracks previous input to determine what parts of the existing render state to
 * update or whether there are any updates
 *
 * @returns a function that accepts render state input and returns a new RenderState to render or
 * undefined if there's no update for rendering
 */
function initRenderStateBuilder(): BuildRenderStateFn {
  let prevVariables: GlobalVariables = EMPTY_GLOBAL_VARIABLES;
  let prevBlocks: unknown;
  let prevSeekTime: number | undefined;
  let prevSubscriptions: BuilderRenderStateInput["subscriptions"];
  let prevSortedTopics: BuilderRenderStateInput["sortedTopics"] | undefined;
  let prevMessageConverters: BuilderRenderStateInput["messageConverters"] | undefined;
  let prevSharedPanelState: BuilderRenderStateInput["sharedPanelState"];

  // Topics which we are subscribed without a conversion, these are topics we want to receive the original message
  const topicNoConversions: Set<string> = new Set();

  // Topic -> convertTo mapping. These are topics which we want to receive some converted data in the convertTo schema
  const topicConversions: Map<string, string> = new Map();

  // from + to -> converter mapping. Allows for quick lookup of a converter by its from and to schema names
  const convertersByKey: Map<string, RegisterMessageConverterArgs<unknown>> = new Map();

  const prevRenderState: RenderState = {};

  return function buildRenderState(input: BuilderRenderStateInput) {
    const {
      appSettings,
      colorScheme,
      currentFrame,
      globalVariables,
      hoverValue,
      messageConverters,
      playerState,
      sharedPanelState,
      sortedTopics,
      subscriptions,
      watchedFields,
    } = input;

    // If the player has loaded all the blocks, the blocks reference won't change so our message
    // pipeline handler for allFrames won't create a new set of all frames for the newly
    // subscribed topic. To ensure a new set of allFrames with the newly subscribed topic is
    // created, we unset the blocks ref which will force re-creating allFrames.
    if (subscriptions !== prevSubscriptions) {
      prevBlocks = undefined;

      // Bin the subscriptions into two sets: those which want a conversion and those that do not.
      //
      // For the subscriptions that want a conversion, if the topic schemaName matches the requested
      // convertTo, then we don't need to do a conversion.
      for (const subscription of subscriptions) {
        if (subscription.convertTo) {
          const noConversion = sortedTopics.find(
            (topic) =>
              topic.name === subscription.topic && topic.schemaName === subscription.convertTo,
          );
          if (noConversion) {
            topicNoConversions.add(noConversion.name);
          } else {
            topicConversions.set(subscription.topic, subscription.convertTo);
          }
        } else {
          topicNoConversions.add(subscription.topic);
        }
      }
    }
    prevSubscriptions = subscriptions;

    // Should render indicates whether any fields of render state are updated
    let shouldRender = false;

    const activeData = playerState?.activeData;

    // The render state starts with the previous render state and changes are applied as detected
    const renderState: RenderState = prevRenderState;

    if (watchedFields.has("didSeek")) {
      const didSeek = prevSeekTime !== activeData?.lastSeekTime;
      if (didSeek !== renderState.didSeek) {
        renderState.didSeek = didSeek;
        shouldRender = true;
      }
      prevSeekTime = activeData?.lastSeekTime;
    }

    if (watchedFields.has("parameters")) {
      const parameters = activeData?.parameters ?? EmptyParameters;
      if (parameters !== renderState.parameters) {
        shouldRender = true;
        renderState.parameters = parameters;
      }
    }

    if (watchedFields.has("sharedPanelState")) {
      if (sharedPanelState !== prevSharedPanelState) {
        shouldRender = true;
        prevSharedPanelState = sharedPanelState;
        renderState.sharedPanelState = sharedPanelState;
      }
    }

    if (watchedFields.has("variables")) {
      if (globalVariables !== prevVariables) {
        shouldRender = true;
        prevVariables = globalVariables;
        renderState.variables = new Map(Object.entries(globalVariables));
      }
    }

    if (watchedFields.has("topics")) {
      if (sortedTopics !== prevSortedTopics || prevMessageConverters !== messageConverters) {
        shouldRender = true;

        const topics = sortedTopics.map<Topic>((topic) => {
          const newTopic: Topic = {
            name: topic.name,
            datatype: topic.schemaName ?? "",
            schemaName: topic.schemaName ?? "",
          };

          if (messageConverters) {
            const convertibleTo: string[] = [];

            // find any converters that can convert _from_ the schema name of the topic
            // the _to_ names of the converter become additional schema names for the topic entry
            for (const converter of messageConverters) {
              if (converter.fromSchemaName === topic.schemaName) {
                if (!convertibleTo.includes(converter.toSchemaName)) {
                  convertibleTo.push(converter.toSchemaName);
                }
              }
            }

            if (convertibleTo.length > 0) {
              newTopic.convertibleTo = convertibleTo;
            }
          }

          return newTopic;
        });

        renderState.topics = topics;
        prevSortedTopics = sortedTopics;
      }
    }

    // Update the mapping of converters.
    // This needs to happen _after_ the above topics processing which re-runs if the message converters have changed,
    // and _before_ currentFrame and _allFrames_ processing which use this cache.
    //
    // If setting `prevMessageConverters` runs before the above topics handling then topics won't
    // run again if the message converters have changed.
    //
    // And if this runs after the currentFrame and allFrames handling then convertersByKey will be
    // from the previous converters.
    if (messageConverters !== prevMessageConverters) {
      convertersByKey.clear();

      if (messageConverters) {
        for (const converter of messageConverters) {
          const key = converterKey(converter.fromSchemaName, converter.toSchemaName);
          if (convertersByKey.has(key)) {
            log.error(
              `A message converter from (${converter.fromSchemaName}) to (${converter.toSchemaName}) already exists.`,
            );
          }
          convertersByKey.set(key, converter);
        }
      }
    }
    prevMessageConverters = messageConverters;

    if (watchedFields.has("currentFrame")) {
      // If there are new frames we render
      // If there are old frames we render (new frames either replace old or no new frames)
      // Note: renderState.currentFrame.length !== currentFrame.length is wrong because it
      // won't render when the number of messages is the same from old to new
      if (renderState.currentFrame?.length !== 0 || currentFrame?.length !== 0) {
        shouldRender = true;

        if (currentFrame) {
          const postProcessedFrame: MessageEvent<unknown>[] = [];

          for (const messageEvent of currentFrame) {
            if (topicNoConversions.has(messageEvent.topic)) {
              postProcessedFrame.push(messageEvent);
            }

            // When subscribing with a convertTo, we have a topic + destination schema
            // to identify a potential converter to use we lookup a converter by the src schema + dest schema.
            // The src schema comes from the message event and the destination schema from the subscription

            // Lookup any subscriptions for this topic which want a conversion
            const subConvertTo = topicConversions.get(messageEvent.topic);
            if (subConvertTo) {
              const convertKey = converterKey(messageEvent.schemaName, subConvertTo);
              const converter = convertersByKey.get(convertKey);
              if (converter) {
                const convertedMessage = converter.converter(messageEvent.message);
                postProcessedFrame.push({
                  topic: messageEvent.topic,
                  schemaName: converter.toSchemaName,
                  receiveTime: messageEvent.receiveTime,
                  message: convertedMessage,
                  originalMessageEvent: messageEvent,
                  sizeInBytes: messageEvent.sizeInBytes,
                });
              }
            }
          }

          renderState.currentFrame = postProcessedFrame;
        } else {
          renderState.currentFrame = undefined;
        }
      }
    }

    if (watchedFields.has("allFrames")) {
      // see comment for prevBlocksRef on why extended message store updates are gated this way
      const newBlocks = playerState?.progress.messageCache?.blocks;
      if (newBlocks && prevBlocks !== newBlocks) {
        shouldRender = true;
        const frames: MessageEvent<unknown>[] = (renderState.allFrames = []);
        // only populate allFrames with topics that the panel wants to preload
        const topicsToPreloadForPanel = Array.from(
          new Set<string>(
            filterMap(subscriptions, (sub) => (sub.preload === true ? sub.topic : undefined)),
          ),
        );

        for (const block of newBlocks) {
          if (!block) {
            continue;
          }

          // Given that messagesByTopic should be in order by receiveTime
          // We need to combine all of the messages into a single array and sorted by receive time
          forEachSortedArrays(
            topicsToPreloadForPanel.map((topic) => block.messagesByTopic[topic] ?? []),
            (a, b) => compare(a.receiveTime, b.receiveTime),
            (messageEvent) => {
              // Message blocks may contain topics that we are not subscribed to so we need to filter those out.
              // We use the topicNoConversions and topicConversions to determine if we should include the message event

              if (topicNoConversions.has(messageEvent.topic)) {
                frames.push(messageEvent);
              }

              // Lookup any subscriptions for this topic which want a conversion
              const subConvertTo = topicConversions.get(messageEvent.topic);
              if (subConvertTo) {
                const convertKey = converterKey(messageEvent.schemaName, subConvertTo);
                const converter = convertersByKey.get(convertKey);
                if (converter) {
                  const convertedMessage = converter.converter(messageEvent.message);
                  frames.push({
                    topic: messageEvent.topic,
                    schemaName: converter.toSchemaName,
                    receiveTime: messageEvent.receiveTime,
                    message: convertedMessage,
                    originalMessageEvent: messageEvent,
                    sizeInBytes: messageEvent.sizeInBytes,
                  });
                }
              }
            },
          );
        }
      }
      prevBlocks = newBlocks;
    }

    if (watchedFields.has("currentTime")) {
      const currentTime = activeData?.currentTime;

      if (currentTime != undefined && currentTime !== renderState.currentTime) {
        shouldRender = true;
        renderState.currentTime = currentTime;
      } else {
        if (renderState.currentTime != undefined) {
          shouldRender = true;
        }
        renderState.currentTime = undefined;
      }
    }

    if (watchedFields.has("startTime")) {
      const startTime = activeData?.startTime;

      if (startTime != undefined && startTime !== renderState.startTime) {
        shouldRender = true;
        renderState.startTime = startTime;
      } else {
        if (renderState.startTime != undefined) {
          shouldRender = true;
        }
        renderState.startTime = undefined;
      }
    }

    if (watchedFields.has("endTime")) {
      const endTime = activeData?.endTime;

      if (endTime != undefined && endTime !== renderState.endTime) {
        shouldRender = true;
        renderState.endTime = endTime;
      } else {
        if (renderState.endTime != undefined) {
          shouldRender = true;
        }
        renderState.endTime = undefined;
      }
    }

    if (watchedFields.has("previewTime")) {
      const startTime = activeData?.startTime;

      if (startTime != undefined && hoverValue != undefined) {
        const stamp = toSec(startTime) + hoverValue.value;
        if (stamp !== renderState.previewTime) {
          shouldRender = true;
        }
        renderState.previewTime = stamp;
      } else {
        if (renderState.previewTime != undefined) {
          shouldRender = true;
        }
        renderState.previewTime = undefined;
      }
    }

    if (watchedFields.has("colorScheme")) {
      if (colorScheme !== renderState.colorScheme) {
        shouldRender = true;
        renderState.colorScheme = colorScheme;
      }
    }

    if (watchedFields.has("appSettings")) {
      if (renderState.appSettings !== appSettings) {
        shouldRender = true;
        renderState.appSettings = appSettings;
      }
    }

    if (!shouldRender) {
      return undefined;
    }

    return renderState;
  };
}

export { initRenderStateBuilder };

/**
 * Function to iterate and call function over multiple sorted arrays in sorted order across all items in all arrays.
 * Time complexity is O(t*n) where t is the number of arrays and n is the total number of items in all arrays.
 * Space complexity is O(t) where t is the number of arrays.
 * @param arrays - sorted arrays to iterate over
 * @param compareFn - function called to compare items in arrays. Returns a positive value if left is larger than right,
 *  a negative value if right is larger than left, or zero if both are equal
 * @param forEach - callback to be executed on all items in the arrays to iterate over in sorted order across all arrays
 */
export function forEachSortedArrays<Item>(
  arrays: Item[][],
  compareFn: (a: Item, b: Item) => number,
  forEach: (item: Item) => void,
): void {
  const cursors: number[] = Array(arrays.length).fill(0);
  if (arrays.length === 0) {
    return;
  }
  for (;;) {
    let minCursorIndex = undefined;
    for (let i = 0; i < cursors.length; i++) {
      const cursor = cursors[i]!;
      const array = arrays[i]!;
      if (cursor >= array.length) {
        continue;
      }
      const item = array[cursor]!;
      if (minCursorIndex == undefined) {
        minCursorIndex = i;
      } else {
        const minItem = arrays[minCursorIndex]![cursors[minCursorIndex]!]!;
        if (compareFn(item, minItem) < 0) {
          minCursorIndex = i;
        }
      }
    }
    if (minCursorIndex == undefined) {
      break;
    }
    const minItem = arrays[minCursorIndex]![cursors[minCursorIndex]!];
    if (minItem != undefined) {
      forEach(minItem);
      cursors[minCursorIndex]++;
    } else {
      break;
    }
  }
}
