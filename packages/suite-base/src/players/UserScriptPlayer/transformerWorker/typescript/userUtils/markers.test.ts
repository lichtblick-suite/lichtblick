import { IRosMarker, ImageMarker, buildImageMarker, buildRosMarker } from "./markers";

describe("markers", () => {
  describe("buildRosMarker", () => {
    it("should create a valid ros marker with no arguments", () => {
      const expectedRosMarker: IRosMarker = {
        header: {
          frame_id: "",
          stamp: {
            sec: 0,
            nsec: 0,
          },
          seq: 0,
        },
        ns: "",
        id: 0,
        type: 0,
        action: 0,
        pose: {
          position: {
            x: 0,
            y: 0,
            z: 0,
          },
          orientation: {
            x: 0,
            y: 0,
            z: 0,
            w: 0,
          },
        },
        scale: { x: 0, y: 0, z: 0 },
        color: { r: 0, g: 0, b: 0, a: 0 },
        lifetime: { sec: 0, nsec: 0 },
        frame_locked: false,
        points: [],
        colors: [],
        text: "",
        mesh_resource: "",
        mesh_use_embedded_materials: false,
      };

      const rosMarker = buildRosMarker();

      expect(rosMarker).toEqual(expectedRosMarker);
    });

    it("should create a valid ros marker with correct partial arguments", () => {
      const args: Partial<IRosMarker> = {
        ns: "test_ns",
        id: 123,
        type: 1,
        action: 3,
        text: "Text text",
        mesh_use_embedded_materials: true,
      };

      const rosMarker = buildRosMarker(args);

      expect(rosMarker.ns).toBe(args.ns);
      expect(rosMarker.id).toBe(args.id);
      expect(rosMarker.type).toBe(args.type);
      expect(rosMarker.text).toBe("Text text");
      expect(rosMarker.action).toBe(3);
      expect(rosMarker.mesh_use_embedded_materials).toBe(true);
    });
  });

  describe("buildImageMarker", () => {
    it("should create a valid image marker with no arguments", () => {
      const expectedImageMarker: ImageMarker = {
        header: {
          frame_id: "",
          stamp: {
            sec: 0,
            nsec: 0,
          },
          seq: 0,
        },
        ns: "",
        id: 0,
        type: 0,
        action: 0,
        position: {
          x: 0,
          y: 0,
          z: 0,
        },
        scale: 1,
        outline_color: { r: 0, g: 0, b: 0, a: 0 },
        lifetime: { sec: 0, nsec: 0 },
        points: [],
        outline_colors: [],
        filled: false,
        fill_color: { r: 0, g: 0, b: 0, a: 0 },
      };

      const imageMarker = buildImageMarker();

      expect(imageMarker).toEqual(expectedImageMarker);
    });

    it("should create a valid image marker with correct partial arguments", () => {
      const args: Partial<ImageMarker> = {
        ns: "test_ns",
        id: 123,
        type: 1,
        action: 3,
        fill_color: { r: 0.2, g: 0.4, b: 0.6, a: 1 },
        outline_color: { r: 0, g: 0.5, b: 1, a: 0.3 },
      };

      const imageMarker = buildImageMarker(args);

      expect(imageMarker.ns).toBe(args.ns);
      expect(imageMarker.id).toBe(args.id);
      expect(imageMarker.type).toBe(args.type);
      expect(imageMarker.action).toBe(3);
      expect(imageMarker.fill_color).toEqual({ r: 0.2, g: 0.4, b: 0.6, a: 1 });
      expect(imageMarker.outline_color).toEqual({ r: 0, g: 0.5, b: 1, a: 0.3 });
    });
  });
});
