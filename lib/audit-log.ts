import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

type AuditActor = { id: string } | null;

type SafeAuditLogInput = {
  action: string;
  actorId?: string | null;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export function resolveSafeAuditActorId(
  actorId: string | null | undefined,
  actor: AuditActor,
) {
  if (!actorId) {
    return null;
  }

  return actor ? actor.id : null;
}

export async function createSafeAuditLog(
  prisma: PrismaClient,
  { action, actorId, entity, entityId, metadata }: SafeAuditLogInput,
) {
  const actor = actorId
    ? await prisma.user.findUnique({
        select: { id: true },
        where: { id: actorId },
      })
    : null;

  return prisma.auditLog.create({
    data: {
      action,
      actorId: resolveSafeAuditActorId(actorId, actor),
      entity,
      entityId: entityId ?? undefined,
      metadata,
    },
  });
}
