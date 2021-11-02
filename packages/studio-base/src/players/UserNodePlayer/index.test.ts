/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import FakePlayer from "@foxglove/studio-base/components/MessagePipeline/FakePlayer";
import UserNodePlayer from "@foxglove/studio-base/players/UserNodePlayer";
import MockUserNodePlayerWorker from "@foxglove/studio-base/players/UserNodePlayer/MockUserNodePlayerWorker";
import exampleDatatypes from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/fixtures/example-datatypes";
import {
  Sources,
  DiagnosticSeverity,
  ErrorCodes,
} from "@foxglove/studio-base/players/UserNodePlayer/types";
import { PlayerStateActiveData } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { basicDatatypes } from "@foxglove/studio-base/util/datatypes";
import { DEFAULT_STUDIO_NODE_PREFIX } from "@foxglove/studio-base/util/globalConstants";
import signal from "@foxglove/studio-base/util/signal";

const nodeId = "nodeId";

const nodeUserCode = `
  export const inputs = ["/np_input"];
  export const output = "${DEFAULT_STUDIO_NODE_PREFIX}1";
  let lastStamp, lastReceiveTime;
  export default (message: { message: { payload: string } }): { custom_np_field: string, value: string } => {
    return { custom_np_field: "abc", value: message.message.payload };
  };
`;

const nodeUserCodeWithPointClouds = `
  import { convertToRangeView } from "./pointClouds";
  import { RGBA } from "./types";
  export const inputs = ["/np_input"];
  export const output = "${DEFAULT_STUDIO_NODE_PREFIX}1";
  export default (message: { message: { payload: string } }): RGBA => {
    const colors = convertToRangeView([{x:0.1, y:0.2, z:0.3}], 0.4, true);
    return colors[0];
  };
`;

const nodeUserCodeWithGlobalVars = `
  export const inputs = ["/np_input"];
  export const output = "${DEFAULT_STUDIO_NODE_PREFIX}1";
  let lastStamp, lastReceiveTime;
  type GlobalVariables = { globalValue: string };
  export default (message: { message: { payload: string } }, globalVars: GlobalVariables): { custom_np_field: string, value: string } => {
    return { custom_np_field: globalVars.globalValue, value: globalVars.globalValue };
  };
`;

const nodeUserCodeWithLogAndError = `
  export const inputs = ["/np_input"];
  export const output = "${DEFAULT_STUDIO_NODE_PREFIX}1";
  export default (message: { message: { payload: string } }): { success: boolean } => {
    if (message.message.payload === "bar") {
      log('Running. Will fail.');
      throw new Error("Error!");
    }
    log('Running. Will succeed.');
    return { success: true };
  };
`;

const defaultUserNodeActions = {
  setUserNodeDiagnostics: jest.fn(),
  addUserNodeLogs: jest.fn(),
  setUserNodeRosLib: jest.fn(),
};

const basicPlayerState: PlayerStateActiveData = {
  startTime: { sec: 0, nsec: 0 },
  endTime: { sec: 1, nsec: 0 },
  isPlaying: true,
  speed: 0.2,
  lastSeekTime: 0,
  parsedMessageDefinitionsByTopic: {},
  totalBytesReceived: 1234,
  messages: [],
  messageOrder: "receiveTime",
  currentTime: { sec: 0, nsec: 0 },
  topics: [],
  datatypes: new Map(),
};

const upstreamFirst = {
  topic: "/np_input",
  receiveTime: { sec: 0, nsec: 1 },
  message: {
    payload: "bar",
  },
};

const upstreamSecond = {
  topic: "/np_input",
  receiveTime: { sec: 0, nsec: 100 },
  message: {
    payload: "baz",
  },
};

const setListenerHelper = (player: UserNodePlayer, numPromises: number = 1) => {
  const signals = [...new Array(numPromises)].map(() => signal());
  let numEmits = 0;
  player.setListener(async (playerState) => {
    const topicNames = [];
    if (playerState.activeData) {
      topicNames.push(...playerState.activeData.topics.map((topic) => topic.name));
    }
    const messages = playerState.activeData?.messages ?? [];
    signals[numEmits]?.resolve({
      topicNames,
      messages,
      topics: playerState.activeData?.topics,
      datatypes: playerState.activeData?.datatypes,
    } as any);
    numEmits += 1;
  });

  return signals;
};

// @ts-expect-error MockUserNodePlayerWorker is not a fully valid SharedWorker but is enough for our needs
UserNodePlayer.CreateNodeRuntimeWorker = () => {
  return new MockUserNodePlayerWorker();
};

// @ts-expect-error MockUserNodePlayerWorker is not a fully valid SharedWorker but is enough for our needs
UserNodePlayer.CreateNodeTransformWorker = () => {
  return new MockUserNodePlayerWorker();
};

describe("UserNodePlayer", () => {
  describe("default player behavior", () => {
    it("subscribes to underlying topics when node topics are subscribed", () => {
      const fakePlayer = new FakePlayer();
      const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);
      userNodePlayer.setListener(async () => {
        // no-op
      });
      userNodePlayer.setSubscriptions([{ topic: "/studio/test" }, { topic: "/input/baz" }]);
      expect(fakePlayer.subscriptions).toEqual([
        { topic: "/studio/test" },
        { topic: "/input/baz" },
      ]);
    });

    it("delegates play and pause calls to underlying player", () => {
      const fakePlayer = new FakePlayer();
      jest.spyOn(fakePlayer, "startPlayback");
      jest.spyOn(fakePlayer, "pausePlayback");
      const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);
      const messages = [];
      userNodePlayer.setListener(async (playerState) => {
        messages.push(playerState);
      });
      expect(fakePlayer.startPlayback).not.toHaveBeenCalled();
      expect(fakePlayer.pausePlayback).not.toHaveBeenCalled();
      userNodePlayer.startPlayback();
      expect(fakePlayer.startPlayback).toHaveBeenCalled();
      expect(fakePlayer.pausePlayback).not.toHaveBeenCalled();
      userNodePlayer.pausePlayback();
      expect(fakePlayer.startPlayback).toHaveBeenCalled();
      expect(fakePlayer.pausePlayback).toHaveBeenCalled();
    });

    it("delegates setPlaybackSpeed to underlying player", () => {
      const fakePlayer = new FakePlayer();
      jest.spyOn(fakePlayer, "setPlaybackSpeed");
      const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);
      const messages = [];
      userNodePlayer.setListener(async (playerState) => {
        messages.push(playerState);
      });
      expect(fakePlayer.setPlaybackSpeed).not.toHaveBeenCalled();
      userNodePlayer.setPlaybackSpeed(0.4);
      expect(fakePlayer.setPlaybackSpeed).toHaveBeenCalledWith(0.4);
    });

    it("delegates seekPlayback to underlying player", () => {
      const fakePlayer = new FakePlayer();
      jest.spyOn(fakePlayer, "seekPlayback");
      const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);
      const messages = [];
      userNodePlayer.setListener(async (playerState) => {
        messages.push(playerState);
      });
      expect(fakePlayer.seekPlayback).not.toHaveBeenCalled();
      userNodePlayer.seekPlayback({ sec: 2, nsec: 2 });
      expect(fakePlayer.seekPlayback).toHaveBeenCalledWith({ sec: 2, nsec: 2 }, undefined);
    });

    it("delegates publishing to underlying player", () => {
      const fakePlayer = new FakePlayer();
      jest.spyOn(fakePlayer, "setPublishers");
      jest.spyOn(fakePlayer, "publish");
      const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);
      expect(fakePlayer.setPublishers).not.toHaveBeenCalled();
      expect(fakePlayer.publish).not.toHaveBeenCalled();
      const publishers = [{ topic: "/foo", datatype: "foo", datatypes: new Map() }];
      userNodePlayer.setPublishers(publishers);
      expect(fakePlayer.setPublishers).toHaveBeenLastCalledWith(publishers);
      expect(fakePlayer.publish).not.toHaveBeenCalled();
      const publishPayload = { topic: "/foo", msg: {} };
      userNodePlayer.publish(publishPayload);
      expect(fakePlayer.publish).toHaveBeenCalledWith(publishPayload);
    });
  });

  describe("user node behavior", () => {
    it("exposes user node topics when available", async () => {
      const fakePlayer = new FakePlayer();
      const mockSetNodeDiagnostics = jest.fn();
      const userNodePlayer = new UserNodePlayer(fakePlayer, {
        ...defaultUserNodeActions,
        setUserNodeDiagnostics: mockSetNodeDiagnostics,
      });

      void userNodePlayer.setUserNodes({
        nodeId: { name: `${DEFAULT_STUDIO_NODE_PREFIX}1`, sourceCode: nodeUserCode },
      });

      const [done] = setListenerHelper(userNodePlayer);

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [],
          messageOrder: "receiveTime",
          currentTime: { sec: 0, nsec: 0 },
          topics: [{ name: "/np_input", datatype: `${DEFAULT_STUDIO_NODE_PREFIX}1` }],
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
        },
      });

      const { topicNames, messages }: any = await done;

      expect(mockSetNodeDiagnostics).toHaveBeenCalledWith(nodeId, []);
      expect(messages.length).toEqual(0);
      expect(topicNames).toEqual(["/np_input", `${DEFAULT_STUDIO_NODE_PREFIX}1`]);
    });

    it("memoizes topics and datatypes (even after seeking / reinitializing nodes)", async () => {
      const fakePlayer = new FakePlayer();
      const mockSetNodeDiagnostics = jest.fn();
      const userNodePlayer = new UserNodePlayer(fakePlayer, {
        ...defaultUserNodeActions,
        setUserNodeDiagnostics: mockSetNodeDiagnostics,
      });

      void userNodePlayer.setUserNodes({
        nodeId: { name: `${DEFAULT_STUDIO_NODE_PREFIX}1`, sourceCode: nodeUserCode },
      });

      const [done1, done2, done3] = setListenerHelper(userNodePlayer, 3);

      const activeData: PlayerStateActiveData = {
        ...basicPlayerState,
        messages: [],
        messageOrder: "receiveTime",
        currentTime: { sec: 0, nsec: 0 },
        topics: [{ name: "/np_input", datatype: "/np_input_datatype" }],
        datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
      };

      void fakePlayer.emit({ activeData });
      const { topics: firstTopics, datatypes: firstDatatypes }: any = await done1;
      expect(firstTopics).toEqual([
        { name: "/np_input", datatype: "/np_input_datatype" },
        { name: "/studio_node/1", datatype: `${DEFAULT_STUDIO_NODE_PREFIX}1` },
      ]);
      expect(firstDatatypes).toEqual(
        new Map([
          ["foo", { definitions: [] }],
          [
            `${DEFAULT_STUDIO_NODE_PREFIX}1`,
            {
              definitions: [
                { name: "custom_np_field", type: "string", isArray: false, isComplex: false },
                { name: "value", type: "string", isArray: false, isComplex: false },
              ],
            },
          ],
          ...basicDatatypes,
        ]),
      );

      // Seek should keep topics memoized.
      void fakePlayer.emit({ activeData: { ...activeData, lastSeekTime: 123 } });
      const { topics: secondTopics, datatypes: secondDatatypes }: any = await done2;
      expect(secondTopics).toBe(firstTopics);
      expect(secondDatatypes).toBe(firstDatatypes);

      // Changing topics/datatypes should not memoize.
      void fakePlayer.emit({ activeData: { ...activeData, topics: [], datatypes: new Map() } });
      const { topics: thirdTopics, datatypes: thirdDatatypes }: any = await done3;
      expect(thirdTopics).not.toBe(firstTopics);
      expect(thirdDatatypes).not.toBe(firstDatatypes);
    });

    it("gets memoized version of messages if they have not changed", async () => {
      const fakePlayer = new FakePlayer();
      const mockAddUserNodeLogs = jest.fn();
      const userNodePlayer = new UserNodePlayer(fakePlayer, {
        ...defaultUserNodeActions,
        setUserNodeDiagnostics: jest.fn(),
        addUserNodeLogs: mockAddUserNodeLogs,
      });

      userNodePlayer.setSubscriptions([{ topic: `${DEFAULT_STUDIO_NODE_PREFIX}1` }]);
      void userNodePlayer.setUserNodes({
        nodeId: {
          name: `${DEFAULT_STUDIO_NODE_PREFIX}1`,
          sourceCode: `${nodeUserCode}\nlog("LOG VALUE HERE");`,
        },
      });

      const messagesArray = [upstreamFirst];

      const [done, nextDone] = setListenerHelper(userNodePlayer, 2);

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: messagesArray,
          messageOrder: "receiveTime",
          currentTime: { sec: 0, nsec: 0 },
          topics: [{ name: "/np_input", datatype: `${DEFAULT_STUDIO_NODE_PREFIX}1` }],
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
        },
      });

      const { messages }: any = await done;

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: messagesArray,
          messageOrder: "receiveTime",
          currentTime: { sec: 0, nsec: 0 },
          topics: [{ name: "/np_input", datatype: `${DEFAULT_STUDIO_NODE_PREFIX}1` }],
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
        },
      });

      const { messages: newMessages }: any = await nextDone;

      expect(mockAddUserNodeLogs).toHaveBeenCalledTimes(1);
      expect(messages).toBe(newMessages);
    });

    it("subscribes to underlying topics when nodeInfo is added", async () => {
      const fakePlayer = new FakePlayer();
      const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);

      const [done] = setListenerHelper(userNodePlayer);

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [],
          messageOrder: "receiveTime",
          currentTime: { sec: 0, nsec: 0 },
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
        },
      });

      const { topicNames }: any = await done;
      void userNodePlayer.setUserNodes({
        nodeId: { name: "someNodeName", sourceCode: nodeUserCode },
      });
      userNodePlayer.setSubscriptions(topicNames.map((topic: any) => ({ topic })));
      expect(fakePlayer.subscriptions).toEqual([{ topic: "/np_input" }]);
    });

    it("does not produce messages from UserNodes if not subscribed to", async () => {
      const fakePlayer = new FakePlayer();
      const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);

      const [done] = setListenerHelper(userNodePlayer);

      void userNodePlayer.setUserNodes({
        [nodeId]: { name: `${DEFAULT_STUDIO_NODE_PREFIX}1`, sourceCode: nodeUserCode },
      });

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [upstreamFirst],
          messageOrder: "receiveTime",
          currentTime: upstreamFirst.receiveTime,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
        },
      });

      const { messages, topicNames }: any = await done;
      expect(topicNames).toEqual(["/np_input", `${DEFAULT_STUDIO_NODE_PREFIX}1`]);
      expect(messages).toEqual([upstreamFirst]);
    });

    it("produces messages from user input node code with messages produced from underlying player", async () => {
      const fakePlayer = new FakePlayer();
      const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);

      const [done] = setListenerHelper(userNodePlayer);

      userNodePlayer.setSubscriptions([{ topic: `${DEFAULT_STUDIO_NODE_PREFIX}1` }]);
      await userNodePlayer.setUserNodes({
        [nodeId]: { name: `${DEFAULT_STUDIO_NODE_PREFIX}1`, sourceCode: nodeUserCode },
      });

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [upstreamFirst],
          messageOrder: "receiveTime",
          currentTime: upstreamFirst.receiveTime,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
        },
      });

      const { messages }: any = await done;

      expect(messages).toEqual([
        upstreamFirst,
        {
          topic: `${DEFAULT_STUDIO_NODE_PREFIX}1`,
          receiveTime: upstreamFirst.receiveTime,
          message: { custom_np_field: "abc", value: "bar" },
        },
      ]);
    });

    it("does not add to logs when there is no 'log' invocation in the user code", async () => {
      const fakePlayer = new FakePlayer();
      const mockAddUserNodeLogs = jest.fn();
      const userNodePlayer = new UserNodePlayer(fakePlayer, {
        ...defaultUserNodeActions,
        setUserNodeDiagnostics: jest.fn(),
        addUserNodeLogs: mockAddUserNodeLogs,
      });

      const [done] = setListenerHelper(userNodePlayer);

      userNodePlayer.setSubscriptions([{ topic: `${DEFAULT_STUDIO_NODE_PREFIX}1` }]);
      await userNodePlayer.setUserNodes({
        [nodeId]: { name: `${DEFAULT_STUDIO_NODE_PREFIX}1`, sourceCode: nodeUserCode },
      });

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [upstreamFirst],
          messageOrder: "receiveTime",
          currentTime: upstreamFirst.receiveTime,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
        },
      });

      await done;
      expect(mockAddUserNodeLogs).not.toHaveBeenCalled();
    });

    it("adds to logs even when there is a runtime error", async () => {
      const fakePlayer = new FakePlayer();
      const addUserNodeLogs = jest.fn();
      const setUserNodeDiagnostics = jest.fn();
      const userNodePlayer = new UserNodePlayer(fakePlayer, {
        ...defaultUserNodeActions,
        addUserNodeLogs,
        setUserNodeDiagnostics,
      });
      const datatypes: RosDatatypes = new Map(
        Object.entries({ foo: { definitions: [{ name: "payload", type: "string" }] } }),
      );

      const [done1, done2] = setListenerHelper(userNodePlayer, 2);
      userNodePlayer.setSubscriptions([{ topic: `${DEFAULT_STUDIO_NODE_PREFIX}1` }]);
      await userNodePlayer.setUserNodes({
        [nodeId]: {
          name: `${DEFAULT_STUDIO_NODE_PREFIX}1`,
          sourceCode: nodeUserCodeWithLogAndError,
        },
      });

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [upstreamFirst],
          messageOrder: "receiveTime",
          currentTime: upstreamFirst.receiveTime,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes,
        },
      });
      await done1;

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [upstreamSecond],
          messageOrder: "receiveTime",
          currentTime: upstreamSecond.receiveTime,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes,
        },
      });
      await done2;

      expect(addUserNodeLogs.mock.calls).toEqual([
        [nodeId, [{ source: "processMessage", value: "Running. Will fail." }]],
        [nodeId, [{ source: "processMessage", value: "Running. Will succeed." }]],
      ]);
      // Errors are not immediately cleared by successful calls -- they stick around for the user
      // to read.
      expect(setUserNodeDiagnostics).toHaveBeenLastCalledWith(nodeId, [
        {
          code: ErrorCodes.RUNTIME,
          message: "Error: Error!",
          severity: DiagnosticSeverity.Error,
          source: Sources.Runtime,
        },
      ]);
    });

    it("provides access to './pointClouds' library for user input node code", async () => {
      const fakePlayer = new FakePlayer();
      const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);

      const [done] = setListenerHelper(userNodePlayer);

      userNodePlayer.setSubscriptions([{ topic: `${DEFAULT_STUDIO_NODE_PREFIX}1` }]);
      await userNodePlayer.setUserNodes({
        [nodeId]: {
          name: `${DEFAULT_STUDIO_NODE_PREFIX}1`,
          sourceCode: nodeUserCodeWithPointClouds,
        },
      });

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [upstreamFirst],
          messageOrder: "receiveTime",
          currentTime: upstreamFirst.receiveTime,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
        },
      });

      const { messages }: any = await done;

      expect(messages).toEqual([
        upstreamFirst,
        {
          topic: `${DEFAULT_STUDIO_NODE_PREFIX}1`,
          receiveTime: upstreamFirst.receiveTime,
          message: { a: 1, b: 0.7483314773547883, g: 0.7483314773547883, r: 1 },
        },
      ]);
    });

    it("skips publishing messages if a node does not produce a message", async () => {
      const fakePlayer = new FakePlayer();
      const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);

      const [done, nextDone] = setListenerHelper(userNodePlayer, 2);

      const unionTypeReturn = `
        export const inputs = ["/np_input"];
        export const output = "${DEFAULT_STUDIO_NODE_PREFIX}1";
        let lastStamp, lastReceiveTime;
        export default (message: { message: { payload: string } }): { custom_np_field: string, value: string } | undefined => {
          if (message.message.payload === "bar") {
            return;
          }
          return { custom_np_field: "abc", value: message.message.payload };
        };
      `;

      // TODO: test here to make sure the user node does not produce messages if not subscribed to.
      userNodePlayer.setSubscriptions([{ topic: `${DEFAULT_STUDIO_NODE_PREFIX}1` }]);
      await userNodePlayer.setUserNodes({
        [nodeId]: { name: `${DEFAULT_STUDIO_NODE_PREFIX}1`, sourceCode: unionTypeReturn },
      });

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [upstreamFirst],
          messageOrder: "receiveTime",
          currentTime: upstreamFirst.receiveTime,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
        },
      });

      const result: any = await done;
      expect(result.messages).toEqual([upstreamFirst]);

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [upstreamSecond],
          messageOrder: "receiveTime",
          currentTime: upstreamSecond.receiveTime,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
        },
      });

      const nextResult: any = await nextDone;
      expect(nextResult.messages).toEqual([
        upstreamSecond,
        {
          topic: `${DEFAULT_STUDIO_NODE_PREFIX}1`,
          receiveTime: upstreamSecond.receiveTime,
          message: { custom_np_field: "abc", value: "baz" },
        },
      ]);
    });

    it("should error if multiple nodes output to the same topic", async () => {
      const fakePlayer = new FakePlayer();
      const mockSetNodeDiagnostics = jest.fn();
      const userNodePlayer = new UserNodePlayer(fakePlayer, {
        ...defaultUserNodeActions,
        setUserNodeDiagnostics: mockSetNodeDiagnostics,
      });
      const [done] = setListenerHelper(userNodePlayer);

      void userNodePlayer.setUserNodes({
        [`${DEFAULT_STUDIO_NODE_PREFIX}1`]: {
          name: `${DEFAULT_STUDIO_NODE_PREFIX}1`,
          sourceCode: nodeUserCode,
        },
        [`${DEFAULT_STUDIO_NODE_PREFIX}2`]: {
          name: `${DEFAULT_STUDIO_NODE_PREFIX}2`,
          sourceCode: nodeUserCode,
        },
      });
      userNodePlayer.setSubscriptions([{ topic: `${DEFAULT_STUDIO_NODE_PREFIX}1` }]);

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [upstreamFirst],
          messageOrder: "receiveTime",
          currentTime: upstreamFirst.receiveTime,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes: new Map(
            Object.entries({ foo: { definitions: [] }, "std_msgs/Header": { definitions: [] } }),
          ),
        },
      });

      const { messages, topics }: any = await done;

      expect(messages).toHaveLength(2);
      expect(topics).toEqual([
        { name: "/np_input", datatype: "std_msgs/Header" },
        { name: `${DEFAULT_STUDIO_NODE_PREFIX}1`, datatype: `${DEFAULT_STUDIO_NODE_PREFIX}1` },
      ]);
      expect(mockSetNodeDiagnostics).toHaveBeenCalledWith(`${DEFAULT_STUDIO_NODE_PREFIX}1`, []);
      expect(mockSetNodeDiagnostics).toHaveBeenCalledWith(`${DEFAULT_STUDIO_NODE_PREFIX}2`, [
        {
          source: Sources.OutputTopicChecker,
          severity: DiagnosticSeverity.Error,
          message: `Output "${DEFAULT_STUDIO_NODE_PREFIX}1" must be unique`,
          code: ErrorCodes.OutputTopicChecker.NOT_UNIQUE,
        },
      ]);
    });

    it("should handle multiple user nodes", async () => {
      const fakePlayer = new FakePlayer();
      const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);

      const [done] = setListenerHelper(userNodePlayer);

      void userNodePlayer.setUserNodes({
        [`${DEFAULT_STUDIO_NODE_PREFIX}1`]: {
          name: `${DEFAULT_STUDIO_NODE_PREFIX}1`,
          sourceCode: nodeUserCode,
        },
      });

      const nodeUserCode2 = nodeUserCode.replace(
        `${DEFAULT_STUDIO_NODE_PREFIX}1`,
        `${DEFAULT_STUDIO_NODE_PREFIX}2`,
      );
      void userNodePlayer.setUserNodes({
        [nodeId]: { name: `${DEFAULT_STUDIO_NODE_PREFIX}1`, sourceCode: nodeUserCode },
        [`${nodeId}2`]: {
          name: `${DEFAULT_STUDIO_NODE_PREFIX}2`,
          sourceCode: nodeUserCode2,
        },
      });

      userNodePlayer.setSubscriptions([
        { topic: `${DEFAULT_STUDIO_NODE_PREFIX}1` },
        { topic: `${DEFAULT_STUDIO_NODE_PREFIX}2` },
      ]);

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [upstreamFirst],
          messageOrder: "receiveTime",
          currentTime: upstreamFirst.receiveTime,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes: new Map(
            Object.entries({ foo: { definitions: [] }, "std_msgs/Header": { definitions: [] } }),
          ),
        },
      });

      const { messages }: any = await done;

      expect(messages).toEqual([
        upstreamFirst,
        {
          topic: `${DEFAULT_STUDIO_NODE_PREFIX}1`,
          receiveTime: upstreamFirst.receiveTime,
          message: { custom_np_field: "abc", value: "bar" },
        },
        {
          topic: `${DEFAULT_STUDIO_NODE_PREFIX}2`,
          receiveTime: upstreamFirst.receiveTime,
          message: { custom_np_field: "abc", value: "bar" },
        },
      ]);
    });

    it("resets user node state on seek", async () => {
      const sourceCode = `
        let innerState = 0;
        export const inputs = ["/np_input"];
        export const output = "${DEFAULT_STUDIO_NODE_PREFIX}1";
        export default (): { innerState: number } => {
          innerState += 1;
          return { innerState };
        };
      `;

      const fakePlayer = new FakePlayer();
      const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);

      void userNodePlayer.setUserNodes({
        [nodeId]: { name: `${DEFAULT_STUDIO_NODE_PREFIX}1`, sourceCode },
      });

      userNodePlayer.setSubscriptions([{ topic: `${DEFAULT_STUDIO_NODE_PREFIX}1` }]);

      const [firstDone, secondDone] = setListenerHelper(userNodePlayer, 2);

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [upstreamFirst],
          messageOrder: "receiveTime",
          currentTime: upstreamFirst.receiveTime,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes: new Map(
            Object.entries({ foo: { definitions: [] }, "std_msgs/Header": { definitions: [] } }),
          ),
        },
      });

      await firstDone;

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [upstreamSecond],
          messageOrder: "receiveTime",
          currentTime: upstreamSecond.receiveTime,
          lastSeekTime: 1,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes: new Map(
            Object.entries({ foo: { definitions: [] }, "std_msgs/Header": { definitions: [] } }),
          ),
        },
      });

      const { messages }: any = await secondDone;

      expect(messages[messages.length - 1].message).toEqual({
        innerState: 1,
      });
    });
    it.each([
      {
        code: `
          export const inputs = ["/np_input"];
          export const output = "${DEFAULT_STUDIO_NODE_PREFIX}1";
          export default (messages: any): { num: number } => {
            if (messages.message) {
              throw new Error("error path");
            }
            return { num: 42 };
          };`,
        error: "Error: error path",
      },
      {
        code: `
          export const inputs = ["/np_input"];
          export const output = "${DEFAULT_STUDIO_NODE_PREFIX}1";
          export default (messages: any): { num: number } => {
            if (messages.message) {
             const badPropertyAccess = messages.message.message.message;
            }
            return { num: 42 };
          };`,
        error: expect.stringMatching(/^TypeError:/),
      },
      {
        code: `
          export const inputs = ["/np_input"];
          export const output = "${DEFAULT_STUDIO_NODE_PREFIX}1";
          const x: any = {};
          const y = x.bad.bad;
          export default (messages: any): { num: number } => {
            return { num: 42 };
          };`,
        error: expect.stringMatching(/^TypeError:/),
      },
      {
        code: `
          export const inputs = ["/np_input"];
          export const output = "${DEFAULT_STUDIO_NODE_PREFIX}1";
          throw "";
          export default (messages: any): { num: number } => {
            return { num: 42 };
          };`,
        error: "Unknown error encountered registering this node.",
      },
      {
        code: `
        export const inputs = ["/np_input"];
        export const output = "${DEFAULT_STUDIO_NODE_PREFIX}1";
        export default (messages: any): { num: number } => {
          throw ""
          return { num: 42 };
        };`,
        error: "Unknown error encountered running this node.",
      },
      {
        code: `
          export const inputs = ["/np_input"];
          export const output = "${DEFAULT_STUDIO_NODE_PREFIX}1";
          export default (messages: any): { num: number } => {
          if (messages.message) {
            throw new Error("");
          }
            return { num: 42 };
          };`,
        error: "Error",
      },
      {
        code: `
        export const inputs = ["/np_input"];
        export const output = "${DEFAULT_STUDIO_NODE_PREFIX}1";
        if (inputs.length) {
          throw new Error("");
        }
        export default (messages: any): { num: number } => {
          return { num: 42 };
        };`,
        error: "Error",
      },
    ])("records runtime errors in the diagnostics handler", async ({ code, error }) => {
      const fakePlayer = new FakePlayer();
      const mockSetNodeDiagnostics = jest.fn();
      const userNodePlayer = new UserNodePlayer(fakePlayer, {
        ...defaultUserNodeActions,
        setUserNodeDiagnostics: mockSetNodeDiagnostics,
      });

      userNodePlayer.setSubscriptions([{ topic: `${DEFAULT_STUDIO_NODE_PREFIX}1` }]);
      void userNodePlayer.setUserNodes({
        nodeId: { name: `${DEFAULT_STUDIO_NODE_PREFIX}1`, sourceCode: code },
      });

      const [done] = setListenerHelper(userNodePlayer);

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [upstreamFirst],
          messageOrder: "receiveTime",
          currentTime: upstreamFirst.receiveTime,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes: new Map(
            Object.entries({ foo: { definitions: [] }, "std_msgs/Header": { definitions: [] } }),
          ),
        },
      });

      const { topicNames, messages }: any = await done;
      expect(mockSetNodeDiagnostics).toHaveBeenLastCalledWith(nodeId, [
        {
          source: Sources.Runtime,
          severity: DiagnosticSeverity.Error,
          message: error,
          code: ErrorCodes.RUNTIME,
        },
      ]);
      // Sanity check to ensure none of the user node messages made it through if there was an error.
      expect(messages.map(({ topic }: any) => topic)).not.toContain(
        `${DEFAULT_STUDIO_NODE_PREFIX}1`,
      );
      expect(topicNames).toEqual(["/np_input", `${DEFAULT_STUDIO_NODE_PREFIX}1`]);
    });

    it("properly clears user node registrations", async () => {
      const fakePlayer = new FakePlayer();
      const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);

      void userNodePlayer.setUserNodes({
        [nodeId]: { name: `${DEFAULT_STUDIO_NODE_PREFIX}1`, sourceCode: nodeUserCode },
      });

      const [firstDone, secondDone] = setListenerHelper(userNodePlayer, 2);

      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [upstreamFirst],
          messageOrder: "receiveTime",
          currentTime: upstreamFirst.receiveTime,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes: new Map(
            Object.entries({ foo: { definitions: [] }, "std_msgs/Header": { definitions: [] } }),
          ),
        },
      });

      const { topicNames: firstTopicNames }: any = await firstDone;
      expect(firstTopicNames).toEqual(["/np_input", `${DEFAULT_STUDIO_NODE_PREFIX}1`]);

      void userNodePlayer.setUserNodes({});
      void fakePlayer.emit({
        activeData: {
          ...basicPlayerState,
          messages: [upstreamFirst],
          messageOrder: "receiveTime",
          currentTime: upstreamFirst.receiveTime,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes: new Map(
            Object.entries({ foo: { definitions: [] }, "std_msgs/Header": { definitions: [] } }),
          ),
        },
      });
      const { topicNames: secondTopicNames }: any = await secondDone;
      expect(secondTopicNames).toEqual(["/np_input"]);
    });
    it("properly sets diagnostics when there is an error", async () => {
      const code = `
        export const inputs = ["/np_input"];
        export const output = "/bad_prefix";
        export default (messages: any): any => {};
      `;
      const fakePlayer = new FakePlayer();
      const mockSetNodeDiagnostics = jest.fn();
      const userNodePlayer = new UserNodePlayer(fakePlayer, {
        ...defaultUserNodeActions,
        setUserNodeDiagnostics: mockSetNodeDiagnostics,
      });

      void userNodePlayer.setUserNodes({
        nodeId: { name: `${DEFAULT_STUDIO_NODE_PREFIX}1`, sourceCode: code },
      });

      const [done] = setListenerHelper(userNodePlayer);
      void fakePlayer.emit({ activeData: basicPlayerState });
      await done;
      expect(mockSetNodeDiagnostics).toHaveBeenLastCalledWith(nodeId, [
        {
          severity: DiagnosticSeverity.Error,
          message: expect.any(String),
          source: Sources.OutputTopicChecker,
          code: ErrorCodes.OutputTopicChecker.BAD_PREFIX,
        },
      ]);
    });

    describe("user logging", () => {
      it("records logs in the logs handler", async () => {
        const code = `
        import { Time } from "ros";
        type InputTopicMsg = {header: {stamp: Time}};
        type Marker = {};
        type MarkerArray = { markers: Marker[] }

        export const inputs = ["/np_input"];
        export const output = "${DEFAULT_STUDIO_NODE_PREFIX}1";
        const publisher = (message: { message: any }): MarkerArray => {
          log("inside publisher", message.message);
          return { markers: [] };
        };

        log(50, "ABC", null, undefined, 5 + 5);
        log({ "abc": 2, "def": false, });
        const add = (a: number, b: number): number => a + b;
        log("SUM: " + add(1, 2));

        export default publisher;
      `;

        const logs = [
          [
            { source: "registerNode", value: 50 },
            { source: "registerNode", value: "ABC" },
            { source: "registerNode", value: null }, // eslint-disable-line no-restricted-syntax
            { source: "registerNode", value: undefined },
            { source: "registerNode", value: 10 },
            { source: "registerNode", value: { abc: 2, def: false } },
            { source: "registerNode", value: "SUM: 3" },
          ],
          [
            { source: "processMessage", value: "inside publisher" },
            { source: "processMessage", value: { payload: "bar" } },
          ],
        ];

        const fakePlayer = new FakePlayer();
        const mockAddNodeLogs = jest.fn();
        const userNodePlayer = new UserNodePlayer(fakePlayer, {
          ...defaultUserNodeActions,
          addUserNodeLogs: mockAddNodeLogs,
        });
        const [done] = setListenerHelper(userNodePlayer);

        userNodePlayer.setSubscriptions([{ topic: `${DEFAULT_STUDIO_NODE_PREFIX}1` }]);
        void userNodePlayer.setUserNodes({
          [nodeId]: { name: `${DEFAULT_STUDIO_NODE_PREFIX}nodeName`, sourceCode: code },
        });

        void fakePlayer.emit({
          activeData: {
            ...basicPlayerState,
            messages: [upstreamFirst],
            messageOrder: "receiveTime",
            currentTime: upstreamFirst.receiveTime,
            topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
            datatypes: new Map(
              Object.entries({ foo: { definitions: [] }, "std_msgs/Header": { definitions: [] } }),
            ),
          },
        });

        const { topicNames }: any = await done;
        expect(mockAddNodeLogs).toHaveBeenCalled();
        expect(mockAddNodeLogs.mock.calls).toEqual(logs.map((log) => [nodeId, log]));
        expect(topicNames).toEqual(["/np_input", `${DEFAULT_STUDIO_NODE_PREFIX}1`]);
      });

      it("does not record logs if there is an error", async () => {
        const code = `
        import { Time, Message } from "ros";
        type InputTopicMsg = {header: {stamp: Time}};
        type Marker = {};
        type MarkerArray = { markers: Marker[] }

        export const inputs = ["/np_input"];
        export const output = "${DEFAULT_STUDIO_NODE_PREFIX}1";
        const publisher = (message: Message<InputTopicMsg>): MarkerArray => {
          log("inside publisher", message.message);
          return { markers: [] };
        };

        print("HELLO");

        export default publisher;
      `;

        const fakePlayer = new FakePlayer();
        const mockAddNodeLogs = jest.fn();
        const userNodePlayer = new UserNodePlayer(fakePlayer, {
          ...defaultUserNodeActions,
          addUserNodeLogs: mockAddNodeLogs,
        });
        const [done] = setListenerHelper(userNodePlayer);

        void fakePlayer.emit({
          activeData: {
            ...basicPlayerState,
            messages: [upstreamFirst],
            messageOrder: "receiveTime",
            currentTime: upstreamFirst.receiveTime,
            topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
            datatypes: new Map(
              Object.entries({ foo: { definitions: [] }, "std_msgs/Header": { definitions: [] } }),
            ),
          },
        });

        userNodePlayer.setSubscriptions([{ topic: `${DEFAULT_STUDIO_NODE_PREFIX}1` }]);
        void userNodePlayer.setUserNodes({ nodeId: { name: "nodeName", sourceCode: code } });

        const { topicNames }: any = await done;
        expect(mockAddNodeLogs.mock.calls).toEqual([]);
        expect(topicNames).toEqual(["/np_input"]);
      });
    });

    describe("datatypes", () => {
      it("updates the extracted datatype on a user code change", async () => {
        const sourceCode = `
        let innerState = 0;
        export const inputs = ["/np_input"];
        export const output = "${DEFAULT_STUDIO_NODE_PREFIX}innerState";
        export default (): { innerState: number } => {
          innerState += 1;
          return { innerState };
        };
      `;

        const fakePlayer = new FakePlayer();
        const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);
        const firstName = `${DEFAULT_STUDIO_NODE_PREFIX}innerState`;

        void userNodePlayer.setUserNodes({
          [nodeId]: { name: firstName, sourceCode },
        });
        userNodePlayer.setSubscriptions([{ topic: firstName }]);

        // Update the name of the node.
        const secondName = `${DEFAULT_STUDIO_NODE_PREFIX}state`;
        const secondSourceCode = sourceCode.replace(/innerState/g, "state");

        void userNodePlayer.setUserNodes({
          [nodeId]: {
            name: secondName,
            sourceCode: secondSourceCode,
          },
        });
        userNodePlayer.setSubscriptions([{ topic: secondName }]);

        const [done] = setListenerHelper(userNodePlayer);

        void fakePlayer.emit({
          activeData: {
            ...basicPlayerState,
            messages: [upstreamFirst],
            messageOrder: "receiveTime",
            currentTime: upstreamFirst.receiveTime,
            topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
            datatypes: new Map(
              Object.entries({ foo: { definitions: [] }, "std_msgs/Header": { definitions: [] } }),
            ),
          },
        });

        const { topics }: any = await done;
        expect(topics).toEqual([
          { name: "/np_input", datatype: "std_msgs/Header" },
          {
            name: `${DEFAULT_STUDIO_NODE_PREFIX}state`,
            datatype: `${DEFAULT_STUDIO_NODE_PREFIX}state`,
          },
        ]);
      });
      it("uses dynamically generated type definitions", async () => {
        const sourceCode = `
          import { Input, Messages } from 'ros';
          let innerState = 0;
          export const inputs = ["/np_input"];
          export const output = "${DEFAULT_STUDIO_NODE_PREFIX}state";
          export default (message: Input<"/np_input">): Messages.std_msgs__Header => {
            return message.message;
          };
        `;

        const fakePlayer = new FakePlayer();
        const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);
        const firstName = `${DEFAULT_STUDIO_NODE_PREFIX}state`;

        void userNodePlayer.setUserNodes({
          [nodeId]: { name: firstName, sourceCode },
        });
        userNodePlayer.setSubscriptions([{ topic: firstName }]);

        const [done] = setListenerHelper(userNodePlayer);

        void fakePlayer.emit({
          activeData: {
            ...basicPlayerState,
            messages: [upstreamFirst],
            messageOrder: "receiveTime",
            currentTime: upstreamFirst.receiveTime,
            topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
            datatypes: exampleDatatypes,
          },
        });

        const { topics }: any = await done;
        expect(topics).toEqual([
          { name: "/np_input", datatype: "std_msgs/Header" },
          { name: `${DEFAULT_STUDIO_NODE_PREFIX}state`, datatype: "std_msgs/Header" },
        ]);
      });
    });

    describe("global variable behavior", () => {
      it("passes global variables to nodes", async () => {
        const fakePlayer = new FakePlayer();
        const userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);
        const [done, done2] = setListenerHelper(userNodePlayer, 2);

        userNodePlayer.setGlobalVariables({ globalValue: "aaa" });
        userNodePlayer.setSubscriptions([{ topic: `${DEFAULT_STUDIO_NODE_PREFIX}1` }]);
        await userNodePlayer.setUserNodes({
          [nodeId]: {
            name: `${DEFAULT_STUDIO_NODE_PREFIX}1`,
            sourceCode: nodeUserCodeWithGlobalVars,
          },
        });

        const activeData: PlayerStateActiveData = {
          ...basicPlayerState,
          messages: [upstreamFirst],
          messageOrder: "receiveTime",
          currentTime: upstreamFirst.receiveTime,
          topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
        };
        void fakePlayer.emit({ activeData });

        const { messages }: any = await done;
        expect(messages).toEqual([
          upstreamFirst,
          {
            topic: `${DEFAULT_STUDIO_NODE_PREFIX}1`,
            receiveTime: upstreamFirst.receiveTime,
            message: { custom_np_field: "aaa", value: "aaa" },
          },
        ]);

        userNodePlayer.setGlobalVariables({ globalValue: "bbb" });
        void fakePlayer.emit({ activeData });

        const { messages: messages2 }: any = await done2;
        expect(messages2).toEqual([
          upstreamFirst,
          {
            topic: `${DEFAULT_STUDIO_NODE_PREFIX}1`,
            receiveTime: upstreamFirst.receiveTime,
            message: { custom_np_field: "bbb", value: "bbb" },
          },
        ]);
      });
    });
  });

  describe("node registration caching", () => {
    let fakePlayer: any;
    let userNodePlayer: any;
    let emit: any;
    let expectFromSource: any;
    let callCount: any;

    beforeEach(() => {
      const messageSpy = jest.spyOn(MockUserNodePlayerWorker.prototype, "messageSpy");
      callCount = (action: any) => {
        return messageSpy.mock.calls.filter(([a]) => a === action).length;
      };

      fakePlayer = new FakePlayer();
      userNodePlayer = new UserNodePlayer(fakePlayer, defaultUserNodeActions);

      emit = () => {
        fakePlayer.emit({
          activeData: {
            ...basicPlayerState,
            messages: [upstreamFirst],
            messageOrder: "receiveTime",
            currentTime: upstreamFirst.receiveTime,
            topics: [{ name: "/np_input", datatype: "std_msgs/Header" }],
            datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
          },
        });
      };

      expectFromSource = (messages: any, sourceIndex: number) => {
        expect(messages).toEqual([
          upstreamFirst,
          {
            topic: `${DEFAULT_STUDIO_NODE_PREFIX}0`,
            receiveTime: upstreamFirst.receiveTime,
            message: { key: sourceIndex },
          },
        ]);
      };
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const [userNode0, userNode1, userNode2] = new Array(3).fill(0).map((_, i) => {
      return {
        name: `${DEFAULT_STUDIO_NODE_PREFIX}0`,
        sourceCode: `
          export const inputs = ["/np_input"];
          export const output = "${DEFAULT_STUDIO_NODE_PREFIX}0";
          export default (): { key: number } => {
            return { key: ${i} };
          };
        `,
      };
    });

    it("creates node registrations when userNodes change", async () => {
      const donePromises = setListenerHelper(userNodePlayer, 5);
      userNodePlayer.setSubscriptions([{ topic: `${DEFAULT_STUDIO_NODE_PREFIX}0` }]);

      // New node 0, needs registration
      await userNodePlayer.setUserNodes({ nodeId0: userNode0 });
      emit();
      const { messages: messages0 }: any = await donePromises[0];
      expectFromSource(messages0, 0);
      expect(callCount("transform")).toBe(1);
      expect(callCount("processMessage")).toBe(1);

      // New node 1, needs registration
      await userNodePlayer.setUserNodes({ nodeId1: userNode1 });
      emit();
      const { messages: messages1 }: any = await donePromises[1];
      expectFromSource(messages1, 1);
      expect(callCount("transform")).toBe(2);

      // Should use cached registration from 0
      await userNodePlayer.setUserNodes({ nodeId0: userNode0 });
      emit();
      const { messages: messages2 }: any = await donePromises[2];
      expectFromSource(messages2, 0);
      expect(callCount("transform")).toBe(2); // Still 2

      // Should use cached registration from 1
      await userNodePlayer.setUserNodes({ nodeId0: userNode0 });
      emit();
      const { messages: messages3 }: any = await donePromises[3];
      expectFromSource(messages3, 0);
      expect(callCount("transform")).toBe(2); // Still 2

      await userNodePlayer.setUserNodes({ nodeId2: userNode2 });
      emit();
      const { messages: messages4 }: any = await donePromises[4];
      expectFromSource(messages4, 2);
      expect(callCount("transform")).toBe(3);

      // We'll still call registerNode and processMessage for every emit()
      expect(callCount("registerNode")).toBe(5);
      expect(callCount("processMessage")).toBe(5);
    });
  });
});
