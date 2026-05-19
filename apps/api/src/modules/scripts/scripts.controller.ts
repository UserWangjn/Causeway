import { Body, Controller, Get, Inject, Param, Patch } from '@nestjs/common';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { createDtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { UpdateOutcomeSelectionDto } from './dto/update-outcome-selection.dto';
import { ScriptsService } from './scripts.service';

@Controller('scripts')
export class ScriptsController {
  constructor(@Inject(ScriptsService) private readonly scriptsService: ScriptsService) {}

  @Get(':scriptId')
  getScript(@CurrentUser() user: CurrentUserType, @Param('scriptId') scriptId: string) {
    return this.scriptsService.getScript(user, scriptId);
  }

  @Patch(':scriptId/outcome-selections/:selectionId')
  updateOutcomeSelection(
    @Param('scriptId') scriptId: string,
    @Param('selectionId') selectionId: string,
    @Body(createDtoValidationPipe(UpdateOutcomeSelectionDto)) dto: UpdateOutcomeSelectionDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.scriptsService.updateOutcomeSelection(user, scriptId, selectionId, dto);
  }
}
