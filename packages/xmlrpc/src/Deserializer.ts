// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import sax from "sax";

import { DateFormatter } from "./DateFormatter";
import { XmlRpcFault } from "./XmlRpcFault";
import { XmlRpcValue, Encoding, XmlRpcStruct } from "./XmlRpcTypes";

type XmlNode = { name: string; body: string };
type DeserializerType = "methodcall" | "methodresponse";
type ResponseType = "params" | "fault";

export class Deserializer {
  dateFormatter = new DateFormatter();

  #type?: DeserializerType;
  #responseType?: ResponseType;
  #stack: XmlRpcValue[] = [];
  #marks: number[] = [];
  #data: string[] = [];
  #methodname?: string;
  #encoding: Encoding;
  #value: boolean = false;
  #callback: (err?: Error, res?: XmlRpcValue[]) => void = () => {};
  #error?: Error;
  #parser: sax.SAXStream;

  static isInteger = /^-?\d+$/;

  constructor(encoding: Encoding = "utf8") {
    this.#encoding = encoding;
    this.#parser = sax.createStream();
    this.#parser.on("opentag", this.#onOpentag);
    this.#parser.on("closetag", this.#onClosetag);
    this.#parser.on("text", this.#onText);
    this.#parser.on("cdata", this.#onCDATA);
    this.#parser.on("end", this.#onDone);
    this.#parser.on("error", this.#onError);
  }

  deserializeMethodResponse(data: string | ArrayBuffer): Promise<XmlRpcValue> {
    return new Promise((resolve, reject) => {
      this.#callback = (error, result) => {
        if (error) {
          reject(error);
        } else if (result != undefined && result.length > 1) {
          reject(new Error("Response has more than one param"));
        } else if (this.#type !== "methodresponse") {
          reject(new Error("Not a method response"));
        } else if (this.#responseType == undefined) {
          reject(new Error("Invalid method response"));
        } else {
          resolve(result?.[0]);
        }
      };

      this.#parser.end(data, this.#encoding);
    });
  }

  deserializeMethodCall(data: string): Promise<[methodName: string, args: XmlRpcValue[]]> {
    return new Promise((resolve, reject) => {
      this.#callback = (error, result) => {
        if (error) {
          reject(error);
        } else if (this.#type !== "methodcall") {
          reject(new Error("Not a method call"));
        } else if (this.#methodname == undefined) {
          reject(new Error("Method call did not contain a method name"));
        } else {
          resolve([this.#methodname, result ?? []]);
        }
      };

      this.#parser.end(data, this.#encoding);
    });
  }

  #onDone = (): void => {
    if (!this.#error) {
      if (this.#type == undefined || this.#marks.length !== 0) {
        this.#callback(new Error("Invalid XML-RPC message"));
      } else if (this.#responseType === "fault") {
        const createFault = (fault: XmlRpcStruct) => {
          const faultString = typeof fault.faultString === "string" ? fault.faultString : undefined;
          const faultCode = typeof fault.faultCode === "number" ? fault.faultCode : undefined;
          return new XmlRpcFault(faultString, faultCode);
        };
        this.#callback(createFault(this.#stack[0] as XmlRpcStruct));
      } else {
        this.#callback(undefined, this.#stack);
      }
    }
  };

  #onError = (err: Error): void => {
    if (!this.#error) {
      this.#error = err;
      this.#callback?.(this.#error);
    }
  };

  #push = (value: XmlRpcValue): void => {
    this.#stack.push(value);
  };

  //==============================================================================
  // SAX Handlers
  //==============================================================================

  #onOpentag = (node: XmlNode): void => {
    if (node.name === "ARRAY" || node.name === "STRUCT") {
      this.#marks.push(this.#stack.length);
    }
    this.#data = [];
    this.#value = node.name === "VALUE";
  };

  #onText = (text: string): void => {
    this.#data.push(text);
  };

  #onCDATA = (cdata: string): void => {
    this.#data.push(cdata);
  };

  #onClosetag = (el: string): void => {
    const data = this.#data.join("");
    try {
      switch (el) {
        case "BOOLEAN":
          this.#endBoolean(data);
          break;
        case "INT":
        case "I4":
          this.#endInt(data);
          break;
        case "I8":
          this.#endI8(data);
          break;
        case "DOUBLE":
          this.#endDouble(data);
          break;
        case "STRING":
        case "NAME":
          this.#endString(data);
          break;
        case "ARRAY":
          this.#endArray(data);
          break;
        case "STRUCT":
          this.#endStruct(data);
          break;
        case "BASE64":
          this.#endBase64(data);
          break;
        case "DATETIME.ISO8601":
          this.#endDateTime(data);
          break;
        case "VALUE":
          this.#endValue(data);
          break;
        case "PARAMS":
          this.#endParams(data);
          break;
        case "FAULT":
          this.#endFault(data);
          break;
        case "METHODRESPONSE":
          this.#endMethodResponse(data);
          break;
        case "METHODNAME":
          this.#endMethodName(data);
          break;
        case "METHODCALL":
          this.#endMethodCall(data);
          break;
        case "NIL":
          this.#endNil(data);
          break;
        case "DATA":
        case "PARAM":
        case "MEMBER":
          // Ignored by design
          break;
        default:
          this.#onError(new Error(`Unknown XML-RPC tag "${el}"`));
          break;
      }
    } catch (e) {
      this.#onError(e);
    }
  };

  #endNil = (_data: string): void => {
    this.#push(undefined);
    this.#value = false;
  };

  #endBoolean = (data: string): void => {
    if (data === "1") {
      this.#push(true);
    } else if (data === "0") {
      this.#push(false);
    } else {
      throw new Error("Illegal boolean value '" + data + "'");
    }
    this.#value = false;
  };

  #endInt = (data: string): void => {
    const value = parseInt(data, 10);
    if (isNaN(value)) {
      throw new Error("Expected an integer but got '" + data + "'");
    } else {
      this.#push(value);
      this.#value = false;
    }
  };

  #endDouble = (data: string): void => {
    const value = parseFloat(data);
    if (isNaN(value)) {
      throw new Error("Expected a double but got '" + data + "'");
    } else {
      this.#push(value);
      this.#value = false;
    }
  };

  #endString = (data: string): void => {
    this.#push(data);
    this.#value = false;
  };

  #endArray = (_data: string): void => {
    const mark = this.#marks.pop() ?? 0;
    this.#stack.splice(mark, this.#stack.length - mark, this.#stack.slice(mark));
    this.#value = false;
  };

  #endStruct = (_data: string): void => {
    const mark = this.#marks.pop() ?? 0;
    const struct: XmlRpcStruct = {};
    const items = this.#stack.slice(mark);
    for (let i = 0; i < items.length; i += 2) {
      const key = String(items[i]);
      struct[key] = items[i + 1];
    }
    this.#stack.splice(mark, this.#stack.length - mark, struct);
    this.#value = false;
  };

  #endBase64 = (data: string): void => {
    const buffer = Buffer.from(data, "base64");
    this.#push(buffer);
    this.#value = false;
  };

  #endDateTime = (data: string): void => {
    const date = this.dateFormatter.decodeIso8601(data);
    this.#push(date);
    this.#value = false;
  };

  #endI8 = (data: string): void => {
    if (!Deserializer.isInteger.test(data)) {
      throw new Error(`Expected integer (I8) value but got "${data}"`);
    } else {
      this.#endString(data);
    }
  };

  #endValue = (data: string): void => {
    if (this.#value) {
      this.#endString(data);
    }
  };

  #endParams = (_data: string): void => {
    this.#responseType = "params";
  };

  #endFault = (_data: string): void => {
    this.#responseType = "fault";
  };

  #endMethodResponse = (_data: string): void => {
    this.#type = "methodresponse";
  };

  #endMethodName = (data: string): void => {
    this.#methodname = data;
  };

  #endMethodCall = (_data: string): void => {
    this.#type = "methodcall";
  };
}
