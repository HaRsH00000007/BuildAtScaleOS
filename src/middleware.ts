import { NextResponse, type NextRequest } from "next/server";
import { isPipelineOnlyPath, PIPELINE_HOME, pipelineOnly } from "@/lib/deploy";

// Pipeline-only deployments (PIPELINE_ONLY=true) open just the Task Pipeline: every other page goes back to it.
// Pages still check sign-in and permissions themselves; this only narrows what the deployment exposes.
export function middleware(req: NextRequest) {
  if (!pipelineOnly() || isPipelineOnlyPath(req.nextUrl.pathname)) return NextResponse.next();
  return NextResponse.redirect(new URL(PIPELINE_HOME, req.url));
}

export const config = {
  // Skip Next's own assets and static files.
  matcher: ["/((?!_next/|favicon\\.ico|icon\\.svg|.*\\.(?:png|jpg|jpeg|svg|ico|webp|css|js|map|txt)$).*)"],
};
