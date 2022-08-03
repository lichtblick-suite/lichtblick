import { quaternionToEuler } from "./quaternions";

describe("quaternions", () => {
  it("converts quaternions to euler angles", () => {
    const quaternion = {
      x: 0.03813457647485015,
      y: 0.189307857412,
      z: 0.2392983377447303,
      w: 0.9515485246437886,
    };

    const euler = quaternionToEuler(quaternion);
    expect(euler.roll).toBeCloseTo(10);
    expect(euler.pitch).toBeCloseTo(20);
    expect(euler.yaw).toBeCloseTo(30);
  });
});
