// Deployment switches. PIPELINE_ONLY=true publishes the Task Pipeline (plus sign-in) for employees and the admin pages
// that feed it; the rest of the app stays available locally and in deployments without the flag.

export const PIPELINE_HOME = "/ops/pipeline";

export const pipelineOnly = () => process.env.PIPELINE_ONLY === "true";

// The pipeline's "New task" button and the task panel's full-task link open these single-task pages.
const TASK_PAGE = /^\/my-tasks\/(new|(?!complete$|report$)[^/]+(\/edit)?)$/;

// A task needs a project and an assignee, so the pipeline can't run without these. Each page checks its own permission,
// so employees get no access from this list.
const ADMIN_PAGES = ["/projects", "/people", "/departments", "/clients", "/settings"];

/** Paths a pipeline-only deployment serves: the pipeline (and its CSV export), creating/opening a single task, the admin
 * pages, sign-in and the no-access page. */
export function isPipelineOnlyPath(pathname: string): boolean {
  const within = (page: string) => pathname === page || pathname.startsWith(`${page}/`);
  return within(PIPELINE_HOME) || TASK_PAGE.test(pathname) || ADMIN_PAGES.some(within) || pathname === "/login" || pathname === "/forbidden";
}
