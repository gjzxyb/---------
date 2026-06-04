import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AdminSettingsInput } from "@/lib/evaluation/validation";

export type AdminSettings = AdminSettingsInput;

export const defaultAdminSettings: AdminSettings = {
  academicYear: "2025-2026",
  anonymousSubmission: true,
  currentTerm: "2025-2026-2",
  dataIsolation: true,
  dictionaryParametersText:
    "题型=SCALE / TEXT\n任务状态=DRAFT / OPEN / CLOSED / ARCHIVED\n派发状态=PENDING / IN_PROGRESS / SUBMITTED / EXPIRED\n组织类型=SCHOOL / DEPARTMENT / CLASS",
  exportWatermark: true,
  requireFirstLoginPasswordChange: false,
  academicSystemEndpoint: "",
  interfaceNote: "预留统一认证、教务系统、LMS 和消息平台接口配置。",
  lmsEndpoint: "",
  messageWebhook: "",
  smallSampleThreshold: 3,
  reminderChannels: ["站内信", "邮件"],
  resultReleaseMode: "MANUAL",
  ssoProvider: "CAS / OAuth2",
  termEndDate: "",
  termStartDate: "",
  textDesensitization: true,
};

const settingsDirectory = join(process.cwd(), ".data");
const settingsFile = join(settingsDirectory, "admin-settings.json");

export async function loadAdminSettings(): Promise<AdminSettings> {
  try {
    const content = await readFile(settingsFile, "utf8");
    const parsedSettings = JSON.parse(content) as Partial<AdminSettings>;

    return {
      ...defaultAdminSettings,
      ...parsedSettings,
      dictionaryParametersText:
        parsedSettings.dictionaryParametersText ??
        defaultAdminSettings.dictionaryParametersText,
      reminderChannels: Array.isArray(parsedSettings.reminderChannels)
        ? parsedSettings.reminderChannels
        : defaultAdminSettings.reminderChannels,
      resultReleaseMode:
        parsedSettings.resultReleaseMode ??
        defaultAdminSettings.resultReleaseMode,
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return defaultAdminSettings;
    }

    throw error;
  }
}

export async function saveAdminSettings(settings: AdminSettings) {
  await mkdir(settingsDirectory, { recursive: true });
  await writeFile(settingsFile, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}
