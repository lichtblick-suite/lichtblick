// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { RosMsgDefinition, RosMsgField } from "rosbag";

import deserializers from "./BuiltinDeserialize";

// Sizes for builtin types - if a type has a fixed size, the deserializer is able to optimize
const fixedSizeTypes = new Map<string, number>([
  ["bool", 1],
  ["int8", 1],
  ["uint8", 1],
  ["int16", 2],
  ["uint16", 2],
  ["int32", 4],
  ["uint32", 4],
  ["int64", 8],
  ["uint64", 8],
  ["float32", 4],
  ["float64", 8],
  ["time", 8],
  ["duration", 8],
]);

const builtinSizes = {
  // strings are the only builtin type that are variable size
  string: (view: DataView, offset: number) => {
    return 4 + view.getInt32(offset, true);
  },
  fixedArray: (
    view: DataView,
    offset: number,
    len: number,
    typeSize: (view: DataView, offset: number) => number,
  ): number => {
    let size = 0;
    for (let idx = 0; idx < len; ++idx) {
      const elementSize = typeSize(view, offset);
      size += elementSize;
      offset += elementSize;
    }
    return size;
  },
  array: (
    view: DataView,
    offset: number,
    typeSize: (view: DataView, offset: number) => number,
  ): number => {
    const len = view.getUint32(offset, true);

    let size = 4;
    offset += 4;
    for (let idx = 0; idx < len; ++idx) {
      const elementSize = typeSize(view, offset);
      size += elementSize;
      offset += elementSize;
    }
    return size;
  },
};

function sanitizeName(name: string): string {
  return name.replace(/^[0-9]|[^a-zA-Z0-9_]/g, "_");
}

interface SerializedMessageReader {
  build: (view: DataView, offset?: number) => unknown;
  size: (view: DataView, offset?: number) => number;
  source: () => string;
}

// Return a static size function for our @param field
function sizeFunction(field: RosMsgField): string {
  if (field.isConstant === true) {
    return "";
  }

  const fieldSize = fixedSizeTypes.get(field.type);

  // if the field size is not known, size will be calculated on-demand
  if (fieldSize == undefined) {
    // the size function for the field to use in calculating the size on-demand
    const fieldSizeFn =
      field.type === "string" ? "sizes.string" : `${sanitizeName(field.type)}.size`;

    if (field.isArray === true) {
      if (field.arrayLength != undefined) {
        return `
          static ${field.name}_size(view /* dataview */, offset) {
              return sizes.fixedArray(view, offset, ${field.arrayLength}, ${fieldSizeFn});
          }`;
      } else {
        return `
          static ${field.name}_size(view /* dataview */, offset) {
              return sizes.array(view, offset, ${fieldSizeFn});
          }`;
      }
    }

    return `
      static ${field.name}_size(view /* dataview */, offset) {
          return ${fieldSizeFn}(view, offset);
      }`;
  } else {
    if (field.isArray === true) {
      if (field.arrayLength != undefined) {
        return `
          static ${field.name}_size(view /* dataview */, offset) {
            return ${fieldSize} * ${field.arrayLength};
          }`;
      } else {
        return `
          static ${field.name}_size(view /* dataview */, offset) {
            const len = view.getUint32(offset, true);
            return 4 + len * ${fieldSize};
          }`;
      }
    }

    return `
      static ${field.name}_size(view /* dataview */, offset) {
          return ${fieldSize};
      }`;
  }
}

// Return the part of the static size() function for our message class for @param field
function sizePartForDefinition(className: string, field: RosMsgField): string {
  if (field.isConstant === true) {
    return "";
  }

  const fieldSize = fixedSizeTypes.get(field.type);
  const isFixedArray = field.isArray === true && field.arrayLength != undefined;

  if (fieldSize != undefined && (isFixedArray || field.isArray === false)) {
    if (field.arrayLength != undefined) {
      const totalSize = fieldSize * field.arrayLength;
      return `
        // ${field.type}[${field.arrayLength}] ${field.name}
        totalSize += ${totalSize};
        offset += ${totalSize};
      `;
    } else {
      return `
        // ${field.type} ${field.name}
        totalSize += ${fieldSize};
        offset += ${fieldSize};
      `;
    }
  }

  return `
    // ${field.type} ${field.name}
    {
        const size = ${className}.${field.name}_size(view, offset);
        totalSize += size;
        offset += size;
    }
    `;
}

// Create a getter function for the field
function getterFunction(field: RosMsgField): string {
  if (field.isConstant === true) {
    return "";
  }

  const isBuiltinReader = field.type in deserializers;
  const isBuiltinSize = field.type in builtinSizes;

  // function to return a read array item
  const readerFn = isBuiltinReader ? `readers.${field.type}` : `${sanitizeName(field.type)}.build`;

  // function to return size of individual array item
  const sizeFn = isBuiltinSize ? `sizes.${field.type}` : `${sanitizeName(field.type)}.size`;

  const fieldSize = fixedSizeTypes.get(field.type);

  if (field.isArray === true) {
    const arrLen = field.arrayLength;
    if (arrLen != undefined) {
      // total size is known, which means we should use a builtin array reader
      if (fieldSize != undefined) {
        return `
          // ${field.type}[${arrLen}] ${field.name}
          get ${field.name}() {
            const offset = this.${field.name}_offset(this.#view, this.#offset);
            return readers.${field.type}Array(this.#view, offset, ${arrLen});
          }`;
      } else {
        // fixed size array of complex size items
        return `
        // ${field.type}[${arrLen}] ${field.name}
          get ${field.name}() {
            const offset = this.${field.name}_offset(this.#view, this.#offset);
            return readers.fixedArray(this.#view, offset, ${arrLen}, ${readerFn}, ${sizeFn});
          }`;
      }
    } else {
      // total size is known, which means we should use a builtin array reader
      if (fieldSize != undefined) {
        return `
          // ${field.type}[] ${field.name}
          get ${field.name}() {
            const offset = this.${field.name}_offset(this.#view, this.#offset);
            const len = this.#view.getUint32(offset, true);
            return readers.${field.type}Array(this.#view, offset + 4, len);
          }`;
      } else {
        return `
          // ${field.type}[] ${field.name}
          get ${field.name}() {
            const offset = this.${field.name}_offset(this.#view, this.#offset);
            return readers.dynamicArray(this.#view, offset, ${readerFn}, ${sizeFn});
          }`;
      }
    }
  } else {
    return `get ${field.name}() {
        const offset = this.${field.name}_offset(this.#view, this.#offset);
        return ${readerFn}(this.#view, offset);
      }`;
  }
}

// Create a SerializedMessageReader
//
// The output is a set of classes - one for each custom message type. Only the root message
// class is exposed.
//
// Each LazyMessage class consists of static _size_ functions, _offset_ methods, and property _getters.
// The size functions calculate the size of fields within arrays.
// The offset methods calculate the start byte of the field within the entire message buffer.
// The getter de-serializes the field from the message buffer.
export default function buildReader(types: readonly RosMsgDefinition[]): SerializedMessageReader {
  const classes = new Array<string>();

  for (const type of types) {
    const name = sanitizeName(type.name ?? "__RootMsg");

    const offsetFns = new Array<string>();
    const fields = new Array<string>();

    // getters need to "look back" at the previous field to create the offset function calls
    let prevField: RosMsgField | undefined;

    for (const field of type.definitions) {
      // constants have no impact on deserialization
      if (field.isConstant === true) {
        continue;
      }

      // offsets tell you where the raw data of your field starts (including any length bytes)
      // they are the size of the offset of the previous field + size of previous field
      // the first first field is at offset 0
      if (!prevField) {
        offsetFns.push(`
          ${field.name}_offset(view, initOffset) {
            return initOffset;
          }`);
      } else {
        // offsets tell you where the raw data of your field starts (including any length bytes)
        // they are the size of the offset of the previous field + size of previous field
        offsetFns.push(`
          _${field.name}_offset_cache = undefined;
          ${field.name}_offset(view, initOffset) {
            if (this._${field.name}_offset_cache) {
              return this._${field.name}_offset_cache;
            }
            const prevOffset = this.${prevField.name}_offset(view, initOffset);
            const totalOffset = prevOffset + ${name}.${prevField.name}_size(view, prevOffset);
            this._${field.name}_offset_cache = totalOffset;
            return totalOffset;
          }`);
      }

      fields.push(`${field.name}: this.${field.name}`);

      prevField = field;
    }

    const messageSrc = `class ${name} {
        ${type.definitions.map(sizeFunction).join("\n")}

        // return the total serialized size of the message in the view
        static size(view /* DataView */, initOffset = 0) {
            let totalSize = 0;
            let offset = initOffset;

            ${type.definitions.map(sizePartForDefinition.bind(undefined, name)).join("\n")}
            
            return totalSize;
        }

        ${offsetFns.join("\n")}

        // return an instance of ${name} from the view at initOffset bytes into the view
        // NOTE: the underlying view data lifetime must be at least the lifetime of the instance
        static build(view /* DataView */, offset = 0) {
            return new ${name}(view, offset);
        }

        #view = undefined;
        #offset;
  
        constructor(view, offset = 0) {
          this.#view = view;
          this.#offset = offset;
        }

        // return a json object of the fields
        // this fully parses the message
        toJSON() {
          return {
            ${fields.join(",\n")}
          };
        }

        ${type.definitions.map(getterFunction).join("\n")}
    }`;

    classes.push(messageSrc);
  }

  // Output the types in reverse order so the root message appears last
  // Since the root message depends on custom types we want those to be defined
  const src = classes.reverse().join("\n\n");

  // close over our builtin deserializers and builtin size functions
  // eslint-disable-next-line no-new-func
  const wrapFn = new Function("readers", "sizes", `${src}\nreturn __RootMsg;`);
  const rootMsg = wrapFn.call(undefined, deserializers, builtinSizes) as SerializedMessageReader;
  rootMsg.source = () => wrapFn.toString();
  return rootMsg;
}
