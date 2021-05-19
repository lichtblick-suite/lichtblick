// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { EventEmitter } from "eventemitter3";

import { HttpServer, XmlRpcServer, XmlRpcValue } from "@foxglove/xmlrpc";

import { LoggerService } from "./LoggerService";
import { RosFollowerClient } from "./RosFollowerClient";
import { RosXmlRpcResponse } from "./XmlRpcTypes";
import { isPlainObject } from "./objectTests";

function CheckArguments(args: XmlRpcValue[], expected: string[]): Error | undefined {
  if (args.length !== expected.length) {
    return new Error(`Expected ${expected.length} arguments, got ${args.length}`);
  }

  for (let i = 0; i < args.length; i++) {
    if (expected[i] !== "*" && typeof args[i] !== expected[i]) {
      return new Error(`Expected "${expected[i]}" for arg ${i}, got "${typeof args[i]}"`);
    }
  }

  return undefined;
}

// A server implementing the <http://wiki.ros.org/ROS/Master_API> and
// <http://wiki.ros.org/ROS/Parameter%20Server%20API> APIs. This can be used as
// an alternative server implementation than roscore provided by the ros_comm
// library.
export class RosMaster extends EventEmitter {
  private _server: XmlRpcServer;
  private _log?: LoggerService;
  private _url?: string;

  private _nodes = new Map<string, string>();
  private _services = new Map<string, Map<string, string>>();
  private _topics = new Map<string, string>();
  private _publications = new Map<string, Set<string>>();
  private _subscriptions = new Map<string, Set<string>>();

  private _parameters = new Map<string, XmlRpcValue>();
  private _paramSubscriptions = new Map<string, Map<string, string>>();

  constructor(httpServer: HttpServer, log?: LoggerService) {
    super();
    this._server = new XmlRpcServer(httpServer);
    this._log = log;
  }

  async start(hostname: string, port?: number): Promise<void> {
    await this._server.listen(port, undefined, 10);
    this._url = `http://${hostname}:${this._server.port()}/`;

    this._server.setHandler("registerService", this.registerService);
    this._server.setHandler("unregisterService", this.unregisterService);
    this._server.setHandler("registerSubscriber", this.registerSubscriber);
    this._server.setHandler("unregisterSubscriber", this.unregisterSubscriber);
    this._server.setHandler("registerPublisher", this.registerPublisher);
    this._server.setHandler("unregisterPublisher", this.unregisterPublisher);
    this._server.setHandler("lookupNode", this.lookupNode);
    this._server.setHandler("getPublishedTopics", this.getPublishedTopics);
    this._server.setHandler("getTopicTypes", this.getTopicTypes);
    this._server.setHandler("getSystemState", this.getSystemState);
    this._server.setHandler("getUri", this.getUri);
    this._server.setHandler("lookupService", this.lookupService);
    this._server.setHandler("deleteParam", this.deleteParam);
    this._server.setHandler("setParam", this.setParam);
    this._server.setHandler("getParam", this.getParam);
    this._server.setHandler("searchParam", this.searchParam);
    this._server.setHandler("subscribeParam", this.subscribeParam);
    this._server.setHandler("unsubscribeParam", this.unsubscribeParam);
    this._server.setHandler("hasParam", this.hasParam);
    this._server.setHandler("getParamNames", this.getParamNames);
  }

  close(): void {
    this._server.close();
  }

  url(): string | undefined {
    return this._url;
  }

  // <http://wiki.ros.org/ROS/Master_API> handlers

  registerService = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, service, serviceApi, callerApi]
    const err = CheckArguments(args, ["string", "string", "string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, service, serviceApi, callerApi] = args as [string, string, string, string];

    if (!this._services.has(service)) {
      this._services.set(service, new Map<string, string>());
    }
    const serviceProviders = this._services.get(service) as Map<string, string>;

    serviceProviders.set(callerId, serviceApi);
    this._nodes.set(callerId, callerApi);

    return Promise.resolve([1, "", 0]);
  };

  unregisterService = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, service, serviceApi]
    const err = CheckArguments(args, ["string", "string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, service, _serviceApi] = args as [string, string, string];
    const serviceProviders = this._services.get(service);
    if (serviceProviders == undefined) {
      return Promise.resolve([1, "", 0]);
    }

    const removed = serviceProviders.delete(callerId);
    if (serviceProviders.size === 0) {
      this._services.delete(service);
    }

    return Promise.resolve([1, "", removed ? 1 : 0]);
  };

  registerSubscriber = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, topic, topicType, callerApi]
    const err = CheckArguments(args, ["string", "string", "string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, topic, topicType, callerApi] = args as [string, string, string, string];

    const dataType = this._topics.get(topic);
    if (dataType != undefined && dataType !== topicType) {
      return Promise.resolve([
        0,
        `topic_type "${topicType}" for topic "${topic}" does not match "${dataType}"`,
        [],
      ]);
    }

    if (!this._subscriptions.has(topic)) {
      this._subscriptions.set(topic, new Set<string>());
    }
    const subscribers = this._subscriptions.get(topic) as Set<string>;
    subscribers.add(callerId);

    this._nodes.set(callerId, callerApi);

    const publishers = Array.from((this._publications.get(topic) ?? new Set<string>()).values());
    const publisherApis = publishers
      .map((p) => this._nodes.get(p))
      .filter((a) => a != undefined) as string[];
    return Promise.resolve([1, "", publisherApis]);
  };

  unregisterSubscriber = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, topic, callerApi]
    const err = CheckArguments(args, ["string", "string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, topic, _callerApi] = args as [string, string, string];

    const subscribers = this._subscriptions.get(topic);
    if (subscribers == undefined) {
      return Promise.resolve([1, "", 0]);
    }

    const removed = subscribers.delete(callerId);
    if (subscribers.size === 0) {
      this._subscriptions.delete(topic);
    }

    return Promise.resolve([1, "", removed ? 1 : 0]);
  };

  registerPublisher = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, topic, topicType, callerApi]
    const err = CheckArguments(args, ["string", "string", "string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, topic, topicType, callerApi] = args as [string, string, string, string];

    const dataType = this._topics.get(topic);
    if (dataType != undefined && dataType !== topicType) {
      return Promise.resolve([
        0,
        `topic_type "${topicType}" for topic "${topic}" does not match "${dataType}"`,
        [],
      ]);
    }

    if (!this._publications.has(topic)) {
      this._publications.set(topic, new Set<string>());
    }
    const publishers = this._publications.get(topic) as Set<string>;
    publishers.add(callerId);

    this._topics.set(topic, topicType);
    this._nodes.set(callerId, callerApi);

    const subscribers = Array.from((this._subscriptions.get(topic) ?? new Set<string>()).values());
    const subscriberApis = subscribers
      .map((s) => this._nodes.get(s))
      .filter((a) => a != undefined) as string[];

    // Inform all subscribers of the new publisher
    const publisherApis = Array.from(publishers.values())
      .sort()
      .map((p) => this._nodes.get(p))
      .filter((a) => a != undefined) as string[];
    for (const api of subscriberApis) {
      new RosFollowerClient(api)
        .publisherUpdate(callerId, topic, publisherApis)
        .catch((apiErr) => this._log?.warn?.(`publisherUpdate call to ${api} failed: ${apiErr}`));
    }

    return Promise.resolve([1, "", subscriberApis]);
  };

  unregisterPublisher = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, topic, callerApi]
    const err = CheckArguments(args, ["string", "string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, topic, _callerApi] = args as [string, string, string];

    const publishers = this._publications.get(topic);
    if (publishers == undefined) {
      return Promise.resolve([1, "", 0]);
    }

    const removed = publishers.delete(callerId);
    if (publishers.size === 0) {
      this._publications.delete(topic);
    }

    return Promise.resolve([1, "", removed ? 1 : 0]);
  };

  lookupNode = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, nodeName]
    const err = CheckArguments(args, ["string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [_callerId, nodeName] = args as [string, string];

    const nodeApi = this._nodes.get(nodeName);
    if (nodeApi == undefined) {
      return Promise.resolve([0, `node "${nodeName}" not found`, ""]);
    }
    return Promise.resolve([1, "", nodeApi]);
  };

  getPublishedTopics = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, subgraph]
    const err = CheckArguments(args, ["string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    // Subgraph filtering would need to be supported to become a fully compatible implementation
    const [_callerId, _subgraph] = args as [string, string];

    const entries: [string, string][] = [];
    for (const topic of this._publications.keys()) {
      const dataType = this._topics.get(topic);
      if (dataType != undefined) {
        entries.push([topic, dataType]);
      }
    }

    return Promise.resolve([1, "", entries]);
  };

  getTopicTypes = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId]
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    const entries = Array.from(this._topics.entries());
    return Promise.resolve([1, "", entries]);
  };

  getSystemState = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId]
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    const publishers: [string, string[]][] = Array.from(this._publications.entries()).map(
      ([topic, nodeNames]) => [topic, Array.from(nodeNames.values()).sort()],
    );

    const subscribers: [string, string[]][] = Array.from(this._subscriptions.entries()).map(
      ([topic, nodeNames]) => [topic, Array.from(nodeNames.values()).sort()],
    );

    const services: [string, string[]][] = Array.from(this._services.entries()).map(
      ([service, nodeNamesToServiceApis]) => [
        service,
        Array.from(nodeNamesToServiceApis.keys()).sort(),
      ],
    );

    return Promise.resolve([1, "", [publishers, subscribers, services]]);
  };

  getUri = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId]
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    const url = this._url;
    if (url == undefined) {
      return Promise.resolve([0, "", "not running"]);
    }

    return Promise.resolve([1, "", url]);
  };

  lookupService = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, service]
    const err = CheckArguments(args, ["string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [_callerId, service] = args as [string, string];

    const serviceProviders = this._services.get(service);
    if (serviceProviders == undefined || serviceProviders.size === 0) {
      return Promise.resolve([0, `no providers for service "${service}"`, ""]);
    }

    const serviceUrl = serviceProviders.values().next().value as string;
    return Promise.resolve([1, "", serviceUrl]);
  };

  // <http://wiki.ros.org/ROS/Parameter%20Server%20API> handlers

  deleteParam = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, key]
    const err = CheckArguments(args, ["string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [_callerId, key] = args as [string, string];

    this._parameters.delete(key);

    return Promise.resolve([1, "", 0]);
  };

  setParam = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, key, value]
    const err = CheckArguments(args, ["string", "string", "*"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, key, value] = args as [string, string, XmlRpcValue];
    const allKeyValues: [string, XmlRpcValue][] = isPlainObject(value)
      ? objectToKeyValues(key, value as Record<string, XmlRpcValue>)
      : [[key, value]];

    for (const [curKey, curValue] of allKeyValues) {
      this._parameters.set(curKey, curValue);

      // Notify any parameter subscribers about this new value
      const subscribers = this._paramSubscriptions.get(curKey);
      if (subscribers != undefined) {
        for (const api of subscribers.values()) {
          new RosFollowerClient(api)
            .paramUpdate(callerId, curKey, curValue)
            .catch((apiErr) => this._log?.warn?.(`paramUpdate call to ${api} failed: ${apiErr}`));
        }
      }
    }

    return Promise.resolve([1, "", 0]);
  };

  getParam = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, key]
    const err = CheckArguments(args, ["string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    // This endpoint needs to support namespace retrieval to fully match the rosparam server
    // behavior
    const [_callerId, key] = args as [string, string];

    const value = this._parameters.get(key);
    const status = value != undefined ? 1 : 0;
    return Promise.resolve([status, "", value ?? {}]);
  };

  searchParam = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, key]
    const err = CheckArguments(args, ["string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    // This endpoint would have to take into account the callerId namespace, partial matching, and
    // returning undefined keys to fully match the rosparam server behavior
    const [_callerId, key] = args as [string, string];

    const value = this._parameters.get(key);
    const status = value != undefined ? 1 : 0;
    return Promise.resolve([status, "", value ?? {}]);
  };

  subscribeParam = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, callerApi, key]
    const err = CheckArguments(args, ["string", "string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, callerApi, key] = args as [string, string, string];

    if (!this._paramSubscriptions.has(key)) {
      this._paramSubscriptions.set(key, new Map<string, string>());
    }
    const subscriptions = this._paramSubscriptions.get(key) as Map<string, string>;

    subscriptions.set(callerId, callerApi);

    const value = this._parameters.get(key) ?? {};
    return Promise.resolve([1, "", value]);
  };

  unsubscribeParam = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, callerApi, key]
    const err = CheckArguments(args, ["string", "string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, _callerApi, key] = args as [string, string, string];

    const subscriptions = this._paramSubscriptions.get(key);
    if (subscriptions == undefined) {
      return Promise.resolve([1, "", 0]);
    }

    const removed = subscriptions.delete(callerId);
    return Promise.resolve([1, "", removed ? 1 : 0]);
  };

  hasParam = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId, key]
    const err = CheckArguments(args, ["string", "string"]);
    if (err) {
      return Promise.reject(err);
    }

    const [_callerId, key] = args as [string, string];
    return Promise.resolve([1, "", this._parameters.has(key)]);
  };

  getParamNames = (_methodName: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    // [callerId]
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    const keys = Array.from(this._parameters.keys()).sort();
    return Promise.resolve([1, "", keys]);
  };
}

function objectToKeyValues(
  prefix: string,
  object: Record<string, XmlRpcValue>,
): [string, XmlRpcValue][] {
  let entries: [string, XmlRpcValue][] = [];
  for (const curKey in object) {
    const key = `${prefix}/${curKey}`;
    const value = object[curKey];
    if (isPlainObject(value)) {
      entries = entries.concat(objectToKeyValues(key, value as Record<string, XmlRpcValue>));
    } else {
      entries.push([key, value]);
    }
  }
  return entries;
}
