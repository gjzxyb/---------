import { COURSE_IMPORT_TEMPLATE_CSV } from "@/lib/base-data/course-import";

export function GET() {
  return new Response(`\uFEFF${COURSE_IMPORT_TEMPLATE_CSV}`, {
    headers: {
      "Content-Disposition": 'attachment; filename="course-import-template.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
