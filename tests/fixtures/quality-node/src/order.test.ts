import { expect, test } from "vitest";
import { total } from "./order";

test("the total of a small order", () => {
  expect(total(3, 10)).toBe(30);
});
