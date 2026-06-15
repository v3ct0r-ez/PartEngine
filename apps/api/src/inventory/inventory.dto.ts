import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export const MOVEMENT_TYPES = ['INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT'] as const;

export class CreateMovementDto {
  @IsIn(MOVEMENT_TYPES) type: (typeof MOVEMENT_TYPES)[number];
  @IsString() componentId: string;
  /** Positive for IN/OUT/TRANSFER; signed delta for ADJUSTMENT. */
  @Type(() => Number) @IsNumber() quantity: number;

  @IsOptional() @IsString() fromLocationId?: string;
  @IsOptional() @IsString() toLocationId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() unitPrice?: number;
  @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional({ description: 'Required for ADJUSTMENT; audited.' })
  @IsOptional() @IsString() reason?: string;
}

export class ReservationDto {
  @IsString() componentId: string;
  @IsString() locationId: string;
  @Type(() => Number) @IsNumber() quantity: number;
}

export class CreateLocationDto {
  @IsString() warehouseId: string;
  @IsIn(['zone', 'shelf', 'cabinet', 'drawer', 'box']) kind: string;
  @IsString() code: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsString() barcode?: string;
}
