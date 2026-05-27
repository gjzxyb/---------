import { NextResponse } from "next/server";

import { importStudents } from "@/app/actions/base-data";
import { STUDENT_IMPORT_TEMPLATE_CSV } from "@/lib/base-data/student-import";

export function GET() {
  return new Response(`\uFEFF${STUDENT_IMPORT_TEMPLATE_CSV}`, {
    headers: {
      "Content-Disposition": 'attachment; filename="student-import-template.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

export async function POST(request: Request) {
  await importStudents(await request.formData());

  return NextResponse.redirect(new URL("/admin/base-data/students", request.url), {
    status: 303,
  });
}
