import {
  assignmentResponseRate,
  countSubmitted,
  formatDateTime,
} from "../demo-data";

type EnrollmentInput = {
  studentId: string;
  teachingClassId: string;
  studentStatus?: string;
};

type ExistingAssignmentInput = {
  evaluatorId: string;
  teachingClassId: string;
};

type AssignmentMetricInput = {
  status: string;
  response?: { status?: string | null } | null;
  submittedAt?: Date | null;
};

type OrganizationNodeInput = {
  id: string;
  parentId: string | null;
};

type TeachingClassScopeInput = {
  id: string;
  organizationId: string | null;
};

export type AssignmentDraft = {
  taskId: string;
  evaluatorId: string;
  teachingClassId: string;
};

export function buildAssignmentDrafts({
  enrollments,
  existingAssignments,
  teachingClassIds,
  taskId,
}: {
  enrollments: EnrollmentInput[];
  existingAssignments: ExistingAssignmentInput[];
  teachingClassIds: string[];
  taskId: string;
}): AssignmentDraft[] {
  const selectedClassIds = new Set(teachingClassIds);
  const existingKeys = new Set(
    existingAssignments.map(
      (assignment) =>
        `${assignment.evaluatorId}:${assignment.teachingClassId}`,
    ),
  );

  return enrollments.flatMap((enrollment) => {
    if (enrollment.studentStatus && enrollment.studentStatus !== "ACTIVE") {
      return [];
    }

    const isSelected =
      selectedClassIds.size === 0 ||
      selectedClassIds.has(enrollment.teachingClassId);
    const assignmentKey = `${enrollment.studentId}:${enrollment.teachingClassId}`;

    if (!isSelected || existingKeys.has(assignmentKey)) {
      return [];
    }

    existingKeys.add(assignmentKey);

    return {
      taskId,
      evaluatorId: enrollment.studentId,
      teachingClassId: enrollment.teachingClassId,
    };
  });
}

export function summarizeAssignmentsByStatus(
  assignments: AssignmentMetricInput[],
) {
  return {
    total: assignments.length,
    pending: assignments.filter((assignment) => assignment.status === "PENDING")
      .length,
    inProgress: assignments.filter(
      (assignment) => assignment.status === "IN_PROGRESS",
    ).length,
    submitted: countSubmitted(assignments),
    expired: assignments.filter((assignment) => assignment.status === "EXPIRED")
      .length,
    responseRate: assignmentResponseRate(assignments),
  };
}

export function resolveTeachingClassScope({
  organizations,
  selectedOrganizationIds,
  selectedTeachingClassIds,
  teachingClasses,
}: {
  organizations: OrganizationNodeInput[];
  selectedOrganizationIds: string[];
  selectedTeachingClassIds: string[];
  teachingClasses: TeachingClassScopeInput[];
}) {
  const selectedClassIds = new Set(selectedTeachingClassIds);
  const selectedOrgIds = new Set(selectedOrganizationIds);
  const orgIdsInScope = new Set(selectedOrganizationIds);
  let foundNewChild = true;

  while (foundNewChild) {
    foundNewChild = false;

    organizations.forEach((organization) => {
      if (
        organization.parentId &&
        orgIdsInScope.has(organization.parentId) &&
        !orgIdsInScope.has(organization.id)
      ) {
        orgIdsInScope.add(organization.id);
        foundNewChild = true;
      }
    });
  }

  if (selectedOrgIds.size > 0) {
    teachingClasses.forEach((teachingClass) => {
      if (
        teachingClass.organizationId &&
        orgIdsInScope.has(teachingClass.organizationId)
      ) {
        selectedClassIds.add(teachingClass.id);
      }
    });
  }

  return Array.from(selectedClassIds);
}

export function formatSubmissionStatusText(value: Date | null | undefined) {
  if (!value) {
    return "提交：暂未提交";
  }

  return `提交：${formatDateTime(value)}`;
}

export function isTaskVisibleInRecoveryDetail(status: string) {
  return status === "DRAFT" || status === "OPEN";
}

export function nextRestoredTaskStatus(status: string) {
  if (status === "ARCHIVED") {
    return "CLOSED";
  }

  if (status === "CLOSED") {
    return "OPEN";
  }

  return null;
}
