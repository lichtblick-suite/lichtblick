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

  private _type?: DeserializerType;
  private _responseType?: ResponseType;
  private _stack: XmlRpcValue[] = [];
  private _marks: number[] = [];
  private _data: string[] = [];
  private _methodname?: string;
  private _encoding: Encoding;
  private _value: boolean = false;
  private _callback: (err?: Error, res?: XmlRpcValue[]) => void = () => {};
  private _error?: Error;
  private _parser: sax.SAXStream;

  static isInteger = /^-?\d+$/;

  constructor(encoding: Encoding = "utf8") {
    this._encoding = encoding;
    this._parser = sax.createStream();
    this._parser.on("opentag", this._onOpentag);
    this._parser.on("closetag", this._onClosetag);
    this._parser.on("text", this._onText);
    this._parser.on("cdata", this._onCDATA);
    this._parser.on("end", this._onDone);
    this._parser.on("error", this._onError);
  }

  deserializeMethodResponse(data: string | ArrayBuffer): Promise<XmlRpcValue> {
    return new Promise((resolve, reject) => {
      this._callback = (error, result) => {
        if (error) {
          reject(error);
        } else if (result != undefined && result.length > 1) {
          reject(new Error("Response has more than one param"));
        } else if (this._type !== "methodresponse") {
          reject(new Error("Not a method response"));
        } else if (this._responseType == undefined) {
          reject(new Error("Invalid method response"));
        } else {
          resolve(result?.[0]);
        }
      };

      this._parser.end(data, this._encoding);
    });
  }

  deserializeMethodCall(data: string): Promise<[methodName: string, args: XmlRpcValue[]]> {
    return new Promise((resolve, reject) => {
      this._callback = (error, result) => {
        if (error) {
          reject(error);
        } else if (this._type !== "methodcall") {
          reject(new Error("Not a method call"));
        } else if (this._methodname == undefined) {
          reject(new Error("Method call did not contain a method name"));
        } else {
          resolve([this._methodname, result ?? []]);
        }
      };

      this._parser.end(data, this._encoding);
    });
  }

  private _onDone = (): void => {
    if (!this._error) {
      if (this._type == undefined || this._marks.length !== 0) {
        this._callback(new Error("Invalid XML-RPC message"));
      } else if (this._responseType === "fault") {
        const createFault = (fault: XmlRpcStruct) => {
          const faultString = typeof fault.faultString === "string" ? fault.faultString : undefined;
          const faultCode = typeof fault.faultCode === "number" ? fault.faultCode : undefined;
          return new XmlRpcFault(faultString, faultCode);
        };
        this._callback(createFault(this._stack[0] as XmlRpcStruct));
      } else {
        this._callback(undefined, this._stack);
      }
    }
  };

  private _onError = (err: Error): void => {
    if (!this._error) {
      this._error = err;
      this._callback(this._error);
    }
  };

  private _push = (value: XmlRpcValue): void => {
    this._stack.push(value);
  };

  //==============================================================================
  // SAX Handlers
  //==============================================================================

  private _onOpentag = (node: XmlNode): void => {
    if (node.name === "ARRAY" || node.name === "STRUCT") {
      this._marks.push(this._stack.length);
    }
    this._data = [];
    this._value = node.name === "VALUE";
  };

  private _onText = (text: string): void => {
    this._data.push(text);
  };

  private _onCDATA = (cdata: string): void => {
    this._data.push(cdata);
  };

  private _onClosetag = (el: string): void => {
    const data = this._data.join("");
    try {
      switch (el) {
        case "BOOLEAN":
          this._endBoolean(data);
          break;
        case "INT":
        case "I4":
          this._endInt(data);
          break;
        case "I8":
          this._endI8(data);
          break;
        case "DOUBLE":
          this._endDouble(data);
          break;
        case "STRING":
        case "NAME":
          this._endString(data);
          break;
        case "ARRAY":
          this._endArray(data);
          break;
        case "STRUCT":
          this._endStruct(data);
          break;
        case "BASE64":
          this._endBase64(data);
          break;
        case "DATETIME.ISO8601":
          this._endDateTime(data);
          break;
        case "VALUE":
          this._endValue(data);
          break;
        case "PARAMS":
          this._endParams(data);
          break;
        case "FAULT":
          this._endFault(data);
          break;
        case "METHODRESPONSE":
          this._endMethodResponse(data);
          break;
        case "METHODNAME":
          this._endMethodName(data);
          break;
        case "METHODCALL":
          this._endMethodCall(data);
          break;
        case "NIL":
          this._endNil(data);
          break;
        case "DATA":
        case "PARAM":
        case "MEMBER":
          // Ignored by design
          break;
        default:
          this._onError(new Error(`Unknown XML-RPC tag "${el}"`));
          break;
      }
    } catch (e) {
      this._onError(e);
    }
  };

  private _endNil = (_data: string): void => {
    this._push(undefined);
    this._value = false;
  };

  private _endBoolean = (data: string): void => {
    if (data === "1") {
      this._push(true);
    } else if (data === "0") {
      this._push(false);
    } else {
      throw new Error("Illegal boolean value '" + data + "'");
    }
    this._value = false;
  };

  private _endInt = (data: string): void => {
    const value = parseInt(data, 10);
    if (isNaN(value)) {
      throw new Error("Expected an integer but got '" + data + "'");
    } else {
      this._push(value);
      this._value = false;
    }
  };

  private _endDouble = (data: string): void => {
    const value = parseFloat(data);
    if (isNaN(value)) {
      throw new Error("Expected a double but got '" + data + "'");
    } else {
      this._push(value);
      this._value = false;
    }
  };

  private _endString = (data: string): void => {
    this._push(data);
    this._value = false;
  };

  private _endArray = (_data: string): void => {
    const mark = this._marks.pop() ?? 0;
    this._stack.splice(mark, this._stack.length - mark, this._stack.slice(mark));
    this._value = false;
  };

  private _endStruct = (_data: string): void => {
    const mark = this._marks.pop() ?? 0;
    const struct: XmlRpcStruct = {};
    const items = this._stack.slice(mark);
    for (let i = 0; i < items.length; i += 2) {
      const key = String(items[i]);
      struct[key] = items[i + 1];
    }
    this._stack.splice(mark, this._stack.length - mark, struct);
    this._value = false;
  };

  private _endBase64 = (data: string): void => {
    const buffer = Buffer.from(data, "base64");
    this._push(buffer);
    this._value = false;
  };

  private _endDateTime = (data: string): void => {
    const date = this.dateFormatter.decodeIso8601(data);
    this._push(date);
    this._value = false;
  };

  private _endI8 = (data: string): void => {
    if (!Deserializer.isInteger.test(data)) {
      throw new Error(`Expected integer (I8) value but got "${data}"`);
    } else {
      this._endString(data);
    }
  };

  private _endValue = (data: string): void => {
    if (this._value) {
      this._endString(data);
    }
  };

  private _endParams = (_data: string): void => {
    this._responseType = "params";
  };

  private _endFault = (_data: string): void => {
    this._responseType = "fault";
  };

  private _endMethodResponse = (_data: string): void => {
    this._type = "methodresponse";
  };

  private _endMethodName = (data: string): void => {
    this._methodname = data;
  };

  private _endMethodCall = (_data: string): void => {
    this._type = "methodcall";
  };
}
