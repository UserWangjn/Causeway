import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { CreateInferenceRunDto } from './dto/create-inference-run.dto';
import { InferenceService } from './inference.service';

@Controller('inference-runs')
export class InferenceController {
  constructor(private readonly inferenceService: InferenceService) {}

  @Post()
  createRun(@CurrentUser() user: CurrentUserType, @Body() dto: CreateInferenceRunDto) {
    return this.inferenceService.createRun(user, dto);
  }

  @Get(':runId')
  getRun(@CurrentUser() user: CurrentUserType, @Param('runId') runId: string) {
    return this.inferenceService.getRun(user, runId);
  }
}
