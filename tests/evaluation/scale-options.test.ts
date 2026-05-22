import { describe, expect, it } from "vitest";

import { getScaleOptions } from "../../lib/evaluation/scale-options";

describe("getScaleOptions", () => {
  it("renders five-point options as satisfaction labels with descending score values", () => {
    expect(getScaleOptions(5)).toEqual([
      { label: "A.非常满意", value: 5 },
      { label: "B.满意", value: 4 },
      { label: "C.一般", value: 3 },
      { label: "D.不太满意", value: 2 },
      { label: "E.不满意", value: 1 },
    ]);
  });

  it("limits options to the question max score", () => {
    expect(getScaleOptions(3)).toEqual([
      { label: "A.非常满意", value: 3 },
      { label: "B.满意", value: 2 },
      { label: "C.一般", value: 1 },
    ]);
  });

  it("defaults missing max score to five options", () => {
    expect(getScaleOptions(null)).toHaveLength(5);
  });
});
