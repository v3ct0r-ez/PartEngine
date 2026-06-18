import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class BomLineDto {
  @IsOptional() @IsString() componentId?: string;
  @IsOptional() @IsString() rawMpn?: string;
  @IsOptional() @IsString() reference?: string;
  @Type(() => Number) @IsNumber() quantity: number;
}

export class CreateBomDto {
  @IsString() code: string;
  @IsString() name: string;
  @IsOptional() @IsString() version?: string;
  @IsOptional() @IsString() notes?: string;
  // Optional: a BOM can start empty and have lines added by hand or via CSV.
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BomLineDto) lines?: BomLineDto[];
}

export class ImportCsvDto {
  @IsString() csv: string;
  /** Replace existing lines (default) vs append. */
  @IsOptional() @IsBoolean() replace?: boolean;
}

export class AddBomLineDto {
  @IsString() componentId: string;
  @IsOptional() @IsString() reference?: string;
  @Type(() => Number) @IsNumber() @Min(1) quantity: number;
}
