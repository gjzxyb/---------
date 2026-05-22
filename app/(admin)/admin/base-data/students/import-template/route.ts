import { STUDENT_IMPORT_TEMPLATE_CSV } from "@/lib/base-data/student-import";

export function GET() {
  return new Response(`\uFEFF${STUDENT_IMPORT_TEMPLATE_CSV}`, {
    headers: {
      "Content-Disposition": 'attachment; filename="student-import-template.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
