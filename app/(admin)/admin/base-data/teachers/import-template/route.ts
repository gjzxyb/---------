import { NextResponse } from "next/server";

import { importTeachers } from "@/app/actions/base-data";
import { TEACHER_IMPORT_TEMPLATE_CSV } from "@/lib/base-data/teacher-import";

export function GET() {
  return new Response(`\uFEFF${TEACHER_IMPORT_TEMPLATE_CSV}`, {
    headers: {
      "Content-Disposition": 'attachment; filename="teacher-import-template.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

export async function POST(request: Request) {
  await importTeachers(await request.formData());

  return NextResponse.redirect(new URL("/admin/base-data/teachers", request.url), {
    status: 303,
  });
}
