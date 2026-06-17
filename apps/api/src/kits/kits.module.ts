import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KitsController } from './kits.controller';
import { KitsService } from './kits.service';

@Module({
  imports: [AuthModule], // per-warehouse access check on build
  controllers: [KitsController],
  providers: [KitsService],
  exports: [KitsService],
})
export class KitsModule {}
