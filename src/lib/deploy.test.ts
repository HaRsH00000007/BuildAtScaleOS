import { describe, expect, it } from "vitest";
import { isPipelineOnlyPath } from "./deploy";

describe("pipeline-only deployment", () => {
  it("serves the pipeline, its export, sign-in and the no-access page", () => {
    for (const p of ["/ops/pipeline", "/ops/pipeline/export", "/login", "/forbidden"]) expect(isPipelineOnlyPath(p)).toBe(true);
  });
  it("sends everything else back to the pipeline", () => {
    for (const p of ["/", "/ops", "/ops/overview", "/ops/pipelines", "/my-tasks", "/projects/abc", "/settings"]) expect(isPipelineOnlyPath(p)).toBe(false);
  });
});
