import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    ok: true,

    host: request.headers.get("host"),

    forwarded_host:
      request.headers.get("x-forwarded-host"),

    forwarded_proto:
      request.headers.get("x-forwarded-proto"),

    vercel_url:
      process.env.VERCEL_URL || null,

    production_url:
      process.env.VERCEL_PROJECT_PRODUCTION_URL || null,

    git_commit_sha:
      process.env.VERCEL_GIT_COMMIT_SHA || null,

    git_branch:
      process.env.VERCEL_GIT_COMMIT_REF || null,

    environment:
      process.env.VERCEL_ENV || null,

    marker:
      "CRITICIDAD-DEBUG-2026-08-28",
  });
}