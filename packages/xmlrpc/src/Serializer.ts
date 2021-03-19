// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { bytesToBase64 } from "byte-base64";
import { create as createXml } from "xmlbuilder2";
import type { XMLBuilder } from "xmlbuilder2/lib/interfaces";

import { CustomType } from "./CustomType";
import { DateFormatter } from "./DateFormatter";
import { XmlRpcFault } from "./XmlRpcFault";
import { Encoding, XmlRpcStruct, XmlRpcValue } from "./XmlRpcTypes";

type ValueInfo = { index?: number; keys?: string[]; value: XmlRpcValue; xml: XMLBuilder };

const illegalChars = /^(?![^<&]*]]>[^<&]*)[^<&]*$/;
const dateFormatter = new DateFormatter();

// Creates the XML for an XML-RPC method call
export function serializeMethodCall(
  method: string,
  params: XmlRpcValue[] = [],
  encoding?: Encoding,
): string {
  const xml = createXml()
    .ele("methodCall", { version: "1.0", encoding })
    .ele("methodName")
    .txt(method)
    .up()
    .ele("params");
  params.forEach((param) => serializeValue(param, xml.ele("param")));

  // Includes the <?xml ...> declaration
  return xml.doc().toString();
}

// Creates the XML for an XML-RPC method response
export function serializeMethodResponse(result: XmlRpcValue): string {
  const xml = createXml().ele("methodResponse", { version: "1.0" }).ele("params").ele("param");
  serializeValue(result, xml);

  // Includes the <?xml ...> declaration
  return xml.doc().toString();
}

export function serializeFault(fault: XmlRpcFault): string {
  // ref <http://xmlrpc-epi.sourceforge.net/specs/rfc.fault_codes.php>
  const APPLICATION_ERROR = -32500;

  const xml = createXml().ele("methodResponse", { version: "1.0" }).ele("fault");
  const faultCode = fault.faultCode ?? APPLICATION_ERROR;
  const faultString = fault.faultString ?? fault.message;
  serializeValue({ faultCode, faultString }, xml);

  // Includes the <?xml ...> declaration
  return xml.doc().toString();
}

function serializeValue(value: XmlRpcValue, xml: XMLBuilder) {
  let current: ValueInfo = { value: value, xml: xml };
  const stack = [current];
  let valueNode;
  let next;

  while (stack.length > 0) {
    current = stack[stack.length - 1] as ValueInfo;

    if (current.index !== undefined) {
      // Iterating a compound
      next = getNextItemsFrame(current);
      if (next) {
        stack.push(next);
      } else {
        stack.pop();
      }
    } else {
      // we're about to add a new value (compound or simple)
      valueNode = current.xml.ele("value");
      switch (typeof current.value) {
        case "boolean":
          appendBoolean(current.value, valueNode);
          stack.pop();
          break;
        case "string":
          appendString(current.value, valueNode);
          stack.pop();
          break;
        case "number":
          appendNumber(current.value, valueNode);
          stack.pop();
          break;
        case "object":
          if (current.value == undefined) {
            valueNode.ele("nil");
            stack.pop();
          } else if (current.value instanceof Date) {
            appendDatetime(current.value, valueNode);
            stack.pop();
          } else if (Buffer.isBuffer(current.value)) {
            appendBuffer(current.value, valueNode);
            stack.pop();
          } else if (current.value instanceof CustomType) {
            current.value.serialize(valueNode);
            stack.pop();
          } else {
            if (Array.isArray(current.value)) {
              current.xml = valueNode.ele("array").ele("data");
            } else {
              current.xml = valueNode.ele("struct");
              current.keys = Object.keys(current.value);
            }
            current.index = 0;
            next = getNextItemsFrame(current);
            if (next) {
              stack.push(next);
            } else {
              stack.pop();
            }
          }
          break;
        default:
          stack.pop();
          break;
      }
    }
  }
}

function getNextItemsFrame(frame: ValueInfo) {
  let nextFrame: ValueInfo | undefined;

  if (frame.keys && frame.index != undefined) {
    if (frame.index < frame.keys.length) {
      const key = frame.keys[frame.index++] as string;
      const member = frame.xml.ele("member").ele("name").txt(key).up();
      nextFrame = {
        value: (frame.value as XmlRpcStruct)[key],
        xml: member,
      };
    }
  } else if (
    frame.index != undefined &&
    Array.isArray(frame.value) &&
    frame.index < frame.value.length
  ) {
    nextFrame = {
      value: frame.value[frame.index],
      xml: frame.xml,
    };
    frame.index++;
  }

  return nextFrame;
}

function appendBoolean(value: boolean, xml: XMLBuilder) {
  xml.ele("boolean").txt(value ? "1" : "0");
}

function appendString(value: string, xml: XMLBuilder) {
  if (value.length === 0) {
    xml.ele("string");
  } else if (!illegalChars.test(value)) {
    xml.ele("string").dat(value);
  } else {
    xml.ele("string").txt(value);
  }
}

function appendNumber(value: number, xml: XMLBuilder) {
  if (value % 1 === 0) {
    xml.ele("int").txt(String(value));
  } else {
    xml.ele("double").txt(String(value));
  }
}

function appendDatetime(value: Date, xml: XMLBuilder) {
  xml.ele("dateTime.iso8601").txt(dateFormatter.encodeIso8601(value));
}

function appendBuffer(value: Uint8Array, xml: XMLBuilder) {
  xml.ele("base64").txt(bytesToBase64(value));
}
