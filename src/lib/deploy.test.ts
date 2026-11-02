import { describe, expect, it } from "vitest";
import { isPipelineOnlyPath } from "./deploy";

describe("pipeline-only deployment", () => {
  it("serves the pipeline, its export, sign-in and the no-access page", () => {
    for (const p of ["/ops/pipeline", "/ops/pipeline/export", "/login", "/forbidden"]) expect(isPipelineOnlyPath(p)).toBe(true);
  });
  it("lets the pipeline create, open and edit a single task", () => {
    for (const p of ["/my-tasks/new", "/my-tasks/cmvm853or012", "/my-tasks/cmvm853or012/edit"]) expect(isPipelineOnlyPath(p)).toBe(true);
  });
  it("serves the admin pages the pipeline depends on", () => {
    for (const p of ["/projects", "/projects/new", "/projects/abc", "/projects/abc/edit", "/people", "/people/new", "/people/abc/edit", "/departments", "/clients", "/settings"]) expect(isPipelineOnlyPath(p)).toBe(true);
  });
  it("sends everything else back to the pipeline", () => {
    for (const p of ["/", "/ops", "/ops/overview", "/ops/portfolio", "/ops/pipelines", "/my-tasks", "/my-tasks/complete", "/my-tasks/report", "/peoples"]) expect(isPipelineOnlyPath(p)).toBe(false);
  });
});
