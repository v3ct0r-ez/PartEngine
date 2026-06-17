import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateSupplierDto {
  @IsString() name: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() catalogUrl?: string;
  @IsOptional() @Type(() => Number) @IsInt() avgLeadTimeDays?: number;
  @IsOptional() @Type(() => Number) @IsNumber() reliability?: number;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateSupplierDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() catalogUrl?: string;
  @IsOptional() @Type(() => Number) @IsInt() avgLeadTimeDays?: number;
  @IsOptional() @Type(() => Number) @IsNumber() reliability?: number;
  @IsOptional() @IsString() notes?: string;
}

export class UpsertSupplierPartDto {
  @IsString() supplierId: string;
  @IsString() componentId: string;
  @IsOptional() @IsString() supplierSku?: string;
  @IsOptional() @Type(() => Number) @IsNumber() unitPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() moq?: number;
  @IsOptional() @Type(() => Number) @IsInt() leadTimeDays?: number;
}

export class PoLineDto {
  @IsString() componentId: string;
  @Type(() => Number) @IsNumber() quantity: number;
  @IsOptional() @Type(() => Number) @IsNumber() unitPrice?: number;
}

export class CreatePurchaseOrderDto {
  @IsString() code: string;
  @IsString() supplierId: string;
  @IsOptional() @IsString() expectedAt?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PoLineDto) lines: PoLineDto[];
}

export class SubmitOrderDto {
  /** Location the goods are expected to land in (used to track onOrder). */
  @IsString() receivingLocationId: string;
}

export class ReceiveLineDto {
  @IsString() lineId: string;
  @Type(() => Number) @IsNumber() quantity: number;
}

export class ReceiveOrderDto {
  @IsString() locationId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReceiveLineDto) lines: ReceiveLineDto[];
}
