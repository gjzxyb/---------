import {
  importStudentsWithState,
} from "@/app/actions/base-data";
import { BaseDataImportForm } from "@/app/(admin)/admin/base-data/BaseDataImportForm";

export function StudentImportForm({
  isDatabaseConfigured,
}: {
  isDatabaseConfigured: boolean;
}) {
  return (
    <BaseDataImportForm
      action={importStudentsWithState}
      disabled={!isDatabaseConfigured}
      helpText="支持 CSV，字段为姓名、邮箱、学号、年级、专业、组织、状态。组织可填写组织名称或组织 ID；状态支持 ACTIVE、INACTIVE、GRADUATED、启用、停用、已毕业。"
      templateHref="/admin/base-data/students/import-template"
      title="批量导入学生"
    />
  );
}
