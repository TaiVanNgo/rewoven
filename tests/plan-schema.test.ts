import { test } from "bun:test";
import assert from "node:assert/strict";
import { createReusePlanSchema } from "../src/features/plans/model";
import { PLAN_HEADINGS } from "../src/features/plans/types";

test("provider contract requires each named plan section and enforces its own item limits", () => {
  const schema = createReusePlanSchema(["e1"]);
  assert.ok(
    schema.properties.draft,
    "A generic sections array permits duplicate/misordered headings and too many outcome items",
  );
  for (const branch of schema.properties.draft.anyOf) {
    const clarification = branch.properties.kind.enum[0] === "clarification";
    const sections = branch.properties.sections;
    assert.deepEqual(sections.required, [...PLAN_HEADINGS]);
    assert.equal(sections.additionalProperties, false);
    const limits = [2, clarification ? 0 : 4, 5, 3, 4];
    for (const [i, heading] of PLAN_HEADINGS.entries()) {
      const section = sections.properties[heading];
      assert.equal(section.maxItems, limits[i]);
      assert.equal(
        section.minItems,
        i === 0 || i === 2 || (i === 1 && !clarification) ? 1 : 0,
      );
      for (const variant of section.items.anyOf) {
        const item = variant.properties;
        assert.equal(item.doneWhen.maxLength, i === 2 ? 500 : 0);
        if (i === 2) {
          assert.deepEqual(item.kind.enum, ["recommendation"]);
          assert.equal(item.doneWhen.minLength, 1);
        }
        if (i === 4) assert.deepEqual(item.kind.enum, ["unknown"]);
        if (clarification) assert.equal(item.evidence.maxItems, 0);
        else if (
          i === 1 ||
          item.kind.enum.some((k) => k === "fact" || k === "inference")
        ) {
          assert.equal(item.evidence.minItems, 1);
          assert.deepEqual(item.evidence.items.enum, ["e1"]);
        }
      }
    }
  }
});

test("a provider with no historical evidence can only return an uncited clarification draft", () => {
  const branches = createReusePlanSchema([]).properties.draft.anyOf;
  assert.equal(branches.length, 1);
  assert.deepEqual(branches[0].properties.kind.enum, ["clarification"]);
  for (const section of Object.values(
    branches[0].properties.sections.properties,
  ))
    for (const variant of section.items.anyOf) {
      assert.ok(variant.properties.kind.enum.length);
      assert.equal(variant.properties.evidence.maxItems, 0);
    }
});
