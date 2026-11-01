// Deployment switches. PIPELINE_ONLY=true publishes only the Task Pipeline (plus sign-in) for employees; the full app
// stays available locally and in deployments without the flag.

export const PIPELINE_HOME = "/ops/pipeline";

export const pipelineOnly = () => process.env.PIPELINE_ONLY === "true";

// The pipeline's "New task" button and the task panel's full-task link open these single-task pages.
const TASK_PAGE = /^\/my-tasks\/(new|(?!complete$|report$)[^/]+(\/edit)?)$/;

/** Paths a pipeline-only deployment serves: the pipeline (and its CSV export), creating/opening a single task, sign-in
 * and the no-access page. */
export function isPipelineOnlyPath(pathname: string): boolean {
  return pathname === PIPELINE_HOME || pathname.startsWith(`${PIPELINE_HOME}/`) || TASK_PAGE.test(pathname) || pathname === "/login" || pathname === "/forbidden";
}
