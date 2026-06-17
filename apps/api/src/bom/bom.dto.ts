import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

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
  @IsArray() @ValidateNested({ each: true }) @Type(() => BomLineDto) lines: BomLineDto[];
}

export class ImportCsvDto {
  @IsString() csv: string;
  /** Replace existing lines (default) vs append. */
  @IsOptional() @IsBoolean() replace?: boolean;
}
