import {
  AssignmentStatus,
  ImprovementStatus,
  OrgType,
  QuestionType,
  ResponseStatus,
  Role,
  TaskStatus,
} from "../lib/generated/prisma/client";
import { hashPassword } from "../lib/auth/password";
import { prisma } from "../lib/db";

async function clearDemoData() {
  await prisma.answer.deleteMany();
  await prisma.evaluationResponse.deleteMany();
  await prisma.evaluationAssignment.deleteMany();
  await prisma.improvementPlan.deleteMany();
  await prisma.evaluationTask.deleteMany();
  await prisma.templateQuestion.deleteMany();
  await prisma.evaluationTemplate.deleteMany();
  await prisma.questionBankItem.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.teachingClass.deleteMany();
  await prisma.course.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.teacherProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}

async function main() {
  await clearDemoData();

  const passwordHash = await hashPassword("Password123!");

  const school = await prisma.organization.create({
    data: {
      name: "示范大学",
      type: OrgType.SCHOOL,
    },
  });

  const computerScience = await prisma.organization.create({
    data: {
      name: "计算机学院",
      type: OrgType.DEPARTMENT,
      parentId: school.id,
    },
  });

  const humanities = await prisma.organization.create({
    data: {
      name: "人文学院",
      type: OrgType.DEPARTMENT,
      parentId: school.id,
    },
  });

  const classOrganization = await prisma.organization.create({
    data: {
      name: "软件工程 2026-1 班",
      type: OrgType.CLASS,
      parentId: computerScience.id,
    },
  });

  const [admin, teacher, student, analyst, student2] = await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@example.edu",
        name: "系统管理员",
        passwordHash,
        role: Role.SCHOOL_ADMIN,
        organizationId: school.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "teacher@example.edu",
        name: "李老师",
        passwordHash,
        role: Role.TEACHER,
        organizationId: computerScience.id,
        teacherProfile: {
          create: {
            teacherNo: "T2026001",
            title: "副教授",
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: "student@example.edu",
        name: "张同学",
        passwordHash,
        role: Role.STUDENT,
        organizationId: classOrganization.id,
        studentProfile: {
          create: {
            studentNo: "S2026001",
            grade: "2026",
            major: "软件工程",
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: "analyst@example.edu",
        name: "数据分析员",
        passwordHash,
        role: Role.ANALYST,
        organizationId: humanities.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "student2@example.edu",
        name: "王同学",
        passwordHash,
        role: Role.STUDENT,
        organizationId: classOrganization.id,
        studentProfile: {
          create: {
            studentNo: "S2026002",
            grade: "2026",
            major: "软件工程",
          },
        },
      },
    }),
  ]);

  const course = await prisma.course.create({
    data: {
      code: "SE101",
      name: "软件工程导论",
      organizationId: computerScience.id,
    },
  });

  const teachingClass = await prisma.teachingClass.create({
    data: {
      courseId: course.id,
      teacherId: teacher.id,
      organizationId: classOrganization.id,
      name: "软件工程导论 2026 春季班",
      term: "2026 Spring",
    },
  });

  await prisma.enrollment.createMany({
    data: [
      {
        studentId: student.id,
        teachingClassId: teachingClass.id,
      },
      {
        studentId: student2.id,
        teachingClassId: teachingClass.id,
      },
    ],
  });

  const questionBankItems = await Promise.all([
    prisma.questionBankItem.create({
      data: {
        type: QuestionType.SCALE,
        title: "教师备课充分，课程目标清晰",
        maxScore: 5,
      },
    }),
    prisma.questionBankItem.create({
      data: {
        type: QuestionType.SCALE,
        title: "课堂讲解重点突出，逻辑清楚",
        maxScore: 5,
      },
    }),
    prisma.questionBankItem.create({
      data: {
        type: QuestionType.SCALE,
        title: "课程内容具有启发性和实践价值",
        maxScore: 5,
      },
    }),
    prisma.questionBankItem.create({
      data: {
        type: QuestionType.SCALE,
        title: "教师能够及时回应学生问题",
        maxScore: 5,
      },
    }),
    prisma.questionBankItem.create({
      data: {
        type: QuestionType.TEXT,
        title: "请提出对本课程的改进建议",
        description: "可从教学内容、节奏、作业反馈等方面说明。",
      },
    }),
  ]);

  const template = await prisma.evaluationTemplate.create({
    data: {
      name: "本科课程教学评价模板",
      version: 1,
      questions: {
        create: questionBankItems.map((item, index) => ({
          questionItemId: item.id,
          type: item.type,
          title: item.title,
          description: item.description,
          sortOrder: index + 1,
          maxScore: item.maxScore,
          required: true,
        })),
      },
    },
    include: {
      questions: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  const now = new Date();
  const task = await prisma.evaluationTask.create({
    data: {
      templateId: template.id,
      name: "2026 春季学期课程评价",
      term: "2026 Spring",
      status: TaskStatus.OPEN,
      startsAt: now,
      endsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.evaluationAssignment.create({
    data: {
      taskId: task.id,
      evaluatorId: student.id,
      teachingClassId: teachingClass.id,
      status: AssignmentStatus.PENDING,
    },
  });

  const submittedAssignment = await prisma.evaluationAssignment.create({
    data: {
      taskId: task.id,
      evaluatorId: student2.id,
      teachingClassId: teachingClass.id,
      status: AssignmentStatus.SUBMITTED,
      submittedAt: now,
    },
  });

  await prisma.evaluationResponse.create({
    data: {
      assignmentId: submittedAssignment.id,
      status: ResponseStatus.SUBMITTED,
      submittedAt: now,
      answers: {
        create: template.questions.map((question, index) => ({
          questionId: question.id,
          score: question.type === QuestionType.SCALE ? Math.max(4, 5 - (index % 2)) : null,
          text:
            question.type === QuestionType.TEXT
              ? "课堂案例很贴近实践，希望增加更多项目复盘和阶段性反馈。"
              : null,
        })),
      },
    },
  });

  await prisma.improvementPlan.create({
    data: {
      teacherId: teacher.id,
      teachingClassId: teachingClass.id,
      title: "增加项目复盘与作业反馈频率",
      action: "每两周安排一次项目复盘课，并在作业提交后一周内完成重点问题反馈。",
      status: ImprovementStatus.OPEN,
      dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      evidence: "来源于 2026 春季学期课程评价的学生建议。",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "SEED_DEMO_DATA",
      entity: "DemoDataset",
      metadata: {
        users: [
          admin.email,
          teacher.email,
          student.email,
          student2.email,
          analyst.email,
        ],
        task: task.name,
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
