import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '../../common/errors/api.exception';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { CreateInferenceRunDto } from './dto/create-inference-run.dto';

@Injectable()
export class InferenceService {
  constructor(private readonly prisma: PrismaService) {}

  createRun(_user: CurrentUser, _dto: CreateInferenceRunDto) {
    throw new ApiException(
      HttpStatus.SERVICE_UNAVAILABLE,
      'CAPABILITY_UNAVAILABLE',
      'AI inference worker is not configured yet',
    );
  }

  async getRun(user: CurrentUser, runId: string) {
    const run = await this.prisma.inferenceRun.findFirst({
      where: { id: runId, userId: user.id },
      include: {
        script: {
          select: { id: true },
        },
      },
    });
    if (!run) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'REQUEST_FAILED', 'Inference run was not found');
    }

    return {
      id: run.id,
      status: run.status,
      stage: run.stage,
      progress: run.progress,
      cacheHit: run.cacheHit,
      scriptId: run.script?.id ?? null,
      errorMessage: run.errorMessage,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
    };
  }
}
