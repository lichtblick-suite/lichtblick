export const DATATYPE = {
  uint8: 2,
  uint16: 4,
  int16: 3,
  int32: 5,
  float32: 7,
};

export interface FieldReader {
  read(data: Uint8Array, index: number): number;
}

export class Float32Reader implements FieldReader {
  #offset: number;
  #view: DataView;
  public constructor(offset: number) {
    this.#offset = offset;
    const buffer = new ArrayBuffer(4);
    this.#view = new DataView(buffer);
  }

  public read(data: Uint8Array, index: number): number {
    const base = index + this.#offset;
    const size = 4;
    if (data.length < base + size) {
      throw new Error("cannot read Float32 from data - not enough data");
    }
    this.#view.setUint8(0, data[base]!);
    this.#view.setUint8(1, data[base + 1]!);
    this.#view.setUint8(2, data[base + 2]!);
    this.#view.setUint8(3, data[base + 3]!);
    return this.#view.getFloat32(0, true);
  }
}

export class Int32Reader implements FieldReader {
  #offset: number;
  #view: DataView;
  public constructor(offset: number) {
    this.#offset = offset;
    const buffer = new ArrayBuffer(4);
    this.#view = new DataView(buffer);
  }

  public read(data: Uint8Array, index: number): number {
    const base = index + this.#offset;
    const size = 4;
    if (data.length < base + size) {
      throw new Error("cannot read Int32 from data - not enough data");
    }
    this.#view.setUint8(0, data[base]!);
    this.#view.setUint8(1, data[base + 1]!);
    this.#view.setUint8(2, data[base + 2]!);
    this.#view.setUint8(3, data[base + 3]!);
    return this.#view.getInt32(0, true);
  }
}

export class Uint16Reader implements FieldReader {
  #offset: number;
  #view: DataView;
  public constructor(offset: number) {
    this.#offset = offset;
    const buffer = new ArrayBuffer(2);
    this.#view = new DataView(buffer);
  }

  public read(data: Uint8Array, index: number): number {
    const base = index + this.#offset;
    const size = 2;
    if (data.length < base + size) {
      throw new Error("cannot read Uint16 from data - not enough data");
    }
    this.#view.setUint8(0, data[base]!);
    this.#view.setUint8(1, data[base + 1]!);
    return this.#view.getUint16(0, true);
  }
}

export class Uint8Reader implements FieldReader {
  #offset: number;
  public constructor(offset: number) {
    this.#offset = offset;
  }

  public read(data: Uint8Array, index: number): number {
    const base = index + this.#offset;
    const size = 1;
    if (data.length < base + size) {
      throw new Error("cannot read Uint8 from data - not enough data");
    }
    return data[base]!;
  }
}

export class Int16Reader implements FieldReader {
  #offset: number;
  #view: DataView;
  public constructor(offset: number) {
    this.#offset = offset;
    const buffer = new ArrayBuffer(2);
    this.#view = new DataView(buffer);
  }

  public read(data: Uint8Array, index: number): number {
    const base = index + this.#offset;
    const size = 2;
    if (data.length < base + size) {
      throw new Error("cannot read Int16 from data - not enough data");
    }
    this.#view.setUint8(0, data[base]!);
    this.#view.setUint8(1, data[base + 1]!);
    return this.#view.getInt16(0, true);
  }
}

export function getReader(datatype: number, offset: number): FieldReader {
  switch (datatype) {
    case DATATYPE.float32:
      return new Float32Reader(offset);
    case DATATYPE.uint8:
      return new Uint8Reader(offset);
    case DATATYPE.uint16:
      return new Uint16Reader(offset);
    case DATATYPE.int16:
      return new Int16Reader(offset);
    case DATATYPE.int32:
      return new Int32Reader(offset);
    default:
      throw new Error(`Unsupported datatype: '${datatype}'`);
  }
}
