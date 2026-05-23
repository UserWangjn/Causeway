import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { createDtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { ArcProofScriptParamDto } from './dto/arc-proof-route.dto';
import { CompleteArcProofDto } from './dto/complete-arc-proof.dto';
import { ArcProofsService } from './arc-proofs.service';

@Controller('arc-proofs')
export class ArcProofsController {
  constructor(@Inject(ArcProofsService) private readonly arcProofsService: ArcProofsService) {}

  @Get('scripts/:scriptId')
  getScriptProof(
    @CurrentUser() user: CurrentUserType,
    @Param(createDtoValidationPipe(ArcProofScriptParamDto)) params: ArcProofScriptParamDto,
  ) {
    return this.arcProofsService.getScriptProof(user, params.scriptId);
  }

  @Post('scripts/:scriptId/complete')
  completeScriptProof(
    @CurrentUser() user: CurrentUserType,
    @Param(createDtoValidationPipe(ArcProofScriptParamDto)) params: ArcProofScriptParamDto,
    @Body(createDtoValidationPipe(CompleteArcProofDto)) dto: CompleteArcProofDto,
  ) {
    return this.arcProofsService.completeScriptProof(user, params.scriptId, dto);
  }
}
