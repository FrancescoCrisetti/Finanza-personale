import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const authHeader = request.headers.get("authorization");

  return NextResponse.json({
    received_query_token: token,
    received_query_token_length: token?.length ?? 0,
    has_auth_header: !!authHeader,
    full_url: request.nextUrl.toString(),
    all_query_params: Object.fromEntries(request.nextUrl.searchParams.entries()),
  });
}
