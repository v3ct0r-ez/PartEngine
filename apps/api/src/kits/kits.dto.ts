import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class KitLineDto {
  @IsString() componentId: string;
  @Type(() => Number) @IsNumber() quantity: number;
}

export class CreateKitDto {
  @IsString() code: string;
  @IsString() name: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => KitLineDto) lines: KitLineDto[];
}

export class BuildKitDto {
  @IsString() locationId: string;
  /** How many kits to build (each consumes line.quantity × this). */
  @Type(() => Number) @IsNumber() quantity: number;
}
