import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export const MOVEMENT_TYPES = ['INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT'] as const;

export const LOCATION_KINDS = ['zone', 'shelf', 'cabinet', 'drawer', 'box'] as const;

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
  // Must be positive: a negative reserve/release would let a caller clear or
  // inflate other users' soft holds (the SQL availability guard is trivially
  // satisfied by a negative delta).
  @Type(() => Number) @IsNumber() @Min(1) quantity: number;
}

export class CreateLocationDto {
  @IsString() warehouseId: string;
  @IsIn(LOCATION_KINDS) kind: string;
  // Required for a main location (format "A-01"). For a slot it's derived from
  // the parent code + slot number, so it's optional there.
  @IsOptional() @IsString() code?: string;
  // Set when creating a slot inside a main location.
  @IsOptional() @IsString() parentId?: string;
  // Optional explicit slot number for a child; auto-assigned (next free) if omitted.
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) slot?: number;
  @IsOptional() @IsString() barcode?: string;
}

export class UpdateLocationDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsIn(LOCATION_KINDS) kind?: string;
  @IsOptional() @IsString() barcode?: string;
}

export class CreateWarehouseDto {
  @IsString() code: string;
  @IsString() name: string;
  @IsOptional() @IsString() address?: string;
}

export class UpdateWarehouseDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
}
