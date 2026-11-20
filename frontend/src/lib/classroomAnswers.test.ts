import { expect, it } from "vitest";
import { formatBlankAnswers, parseBlankAnswers } from "./classroomAnswers";

it.each([
  [null, [], ""],
  ["  answer  ", ["answer"], "  answer  "],
  ['[" loop ",8,null]', ["loop", "8", ""], "(1) loop；(2) 8；(3) "],
  ['{"10":"last","2":"first"}', ["first", "last"], "(1) first；(2) last"],
  [" [literal ", ["[literal"], " [literal "],
  ["[]", [], "[]"],
] as const)("keeps legacy blank-answer semantics for %s", (value, slots, display) => {
  expect(parseBlankAnswers(value)).toEqual(slots);
  expect(formatBlankAnswers(value)).toBe(display);
});
