import { NextResponse } from "next/server";

import { importEnrollments } from "@/app/actions/base-data";
import { ENROLLMENT_IMPORT_TEMPLATE_CSV } from "@/lib/base-data/class-enrollment";

export function GET() {
  return new Response(`\uFEFF${ENROLLMENT_IMPORT_TEMPLATE_CSV}`, {
    headers: {
      "Content-Disposition": 'attachment; filename="enrollment-import-template.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

export async function POST(request: Request) {
  await importEnrollments(await request.formData());

  return NextResponse.redirect(new URL("/admin/base-data/classes", request.url), {
    status: 303,
  });
}
