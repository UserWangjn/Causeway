import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../../common/decorators/trim-string.decorator';

export class ScriptIdParamDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  scriptId!: string;
}

export class ScriptSelectionParamDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  scriptId!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  selectionId!: string;
}
