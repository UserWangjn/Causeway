import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { PublicRoute } from '../../common/decorators/public-route.decorator';
import { createDtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { CreateInferenceRunDto } from './dto/create-inference-run.dto';
import { InferenceRunParamDto } from './dto/inference-run-param.dto';
import { InferenceService } from './inference.service';

@Controller('inference-runs')
export class InferenceController {
  constructor(@Inject(InferenceService) private readonly inferenceService: InferenceService) {}

  @PublicRoute()
  @Get('capability')
  getCapability() {
    return this.inferenceService.getCapability();
  }

  @Post()
  createRun(@CurrentUser() user: CurrentUserType, @Body(createDtoValidationPipe(CreateInferenceRunDto)) dto: CreateInferenceRunDto) {
    return this.inferenceService.createRun(user, dto);
  }

  @Get(':runId')
  getRun(@CurrentUser() user: CurrentUserType, @Param(createDtoValidationPipe(InferenceRunParamDto)) params: InferenceRunParamDto) {
    return this.inferenceService.getRun(user, params.runId);
  }
}
