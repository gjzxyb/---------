import { NextResponse } from "next/server";

import { importTeachingClasses } from "@/app/actions/base-data";
import { TEACHING_CLASS_IMPORT_TEMPLATE_CSV } from "@/lib/base-data/class-enrollment";

export function GET() {
  return new Response(`\uFEFF${TEACHING_CLASS_IMPORT_TEMPLATE_CSV}`, {
    headers: {
      "Content-Disposition": 'attachment; filename="teaching-class-import-template.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

export async function POST(request: Request) {
  await importTeachingClasses(await request.formData());

  return NextResponse.redirect(new URL("/admin/base-data/classes", request.url), {
    status: 303,
  });
}
