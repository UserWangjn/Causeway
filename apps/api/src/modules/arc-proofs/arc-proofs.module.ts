import { Module } from '@nestjs/common';
import { ArcProofsController } from './arc-proofs.controller';
import { ArcProofsService } from './arc-proofs.service';

@Module({
  controllers: [ArcProofsController],
  providers: [ArcProofsService],
})
export class ArcProofsModule {}
