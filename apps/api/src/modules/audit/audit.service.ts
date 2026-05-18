import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type AuditEventInput = {
  userId?: string | null;
  requestId?: string | null;
  actorType: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditEventInput) {
    await this.prisma.auditEvent.create({
      data: {
        userId: input.userId,
        requestId: input.requestId,
        actorType: input.actorType,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        before: input.before == null ? undefined : toJson(input.before),
        after: input.after == null ? undefined : toJson(input.after),
        reason: input.reason,
      },
    });
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
