import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";

// Serve uploaded documents. Gated: only authenticated users may fetch.
// (Per-listing access is enforced on the page; this keeps files off anon access.)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { path: segments } = await params;
  const safe = segments.map((s) => s.replace(/\.\./g, "")).join("/");
  const full = path.join(process.cwd(), "uploads", safe);

  try {
    const data = await readFile(full);
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Disposition": `inline; filename="${path.basename(full)}"` },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
