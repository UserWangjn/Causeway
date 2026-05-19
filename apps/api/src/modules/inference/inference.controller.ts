import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { createDtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { CreateInferenceRunDto } from './dto/create-inference-run.dto';
import { InferenceService } from './inference.service';

@Controller('inference-runs')
export class InferenceController {
  constructor(@Inject(InferenceService) private readonly inferenceService: InferenceService) {}

  @Post()
  createRun(@CurrentUser() user: CurrentUserType, @Body(createDtoValidationPipe(CreateInferenceRunDto)) dto: CreateInferenceRunDto) {
    return this.inferenceService.createRun(user, dto);
  }

  @Get(':runId')
  getRun(@CurrentUser() user: CurrentUserType, @Param('runId') runId: string) {
    return this.inferenceService.getRun(user, runId);
  }
}
