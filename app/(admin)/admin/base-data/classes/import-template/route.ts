import { ENROLLMENT_IMPORT_TEMPLATE_CSV } from "@/lib/base-data/class-enrollment";

export function GET() {
  return new Response(`\uFEFF${ENROLLMENT_IMPORT_TEMPLATE_CSV}`, {
    headers: {
      "Content-Disposition": 'attachment; filename="enrollment-import-template.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
