import { NextRequest, NextResponse } from "next/server";

/**
 * RED scaffold (14-06 Task 1): deliberately wrong, non-throwing response so
 * the new test file's assertions fail on real assertions rather than a
 * module-load crash. Replaced with the full implementation in the GREEN
 * commit.
 */
export async function GET(
  _request: NextRequest,
  _context: { params: Promise<{ id: string }> },
) {
  return NextResponse.json({ wrong: true });
}
