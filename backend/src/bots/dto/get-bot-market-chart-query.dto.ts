import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum PriceSource {
  MARK = 'mark',
  INDEX = 'index',
  LAST = 'last',
}

export enum ChartInterval {
  M1 = '1',
  M5 = '5',
  M15 = '15',
  M30 = '30',
  H1 = '60',
  H4 = '240',
  D1 = 'D',
}

export enum ChartRange {
  H1 = '1h',
  H4 = '4h',
  H12 = '12h',
  D1 = '1d',
  D3 = '3d',
  W1 = '1w',
}

export class GetBotMarketChartQueryDto {
  @ApiPropertyOptional({ enum: PriceSource, default: PriceSource.MARK })
  @IsOptional()
  @IsEnum(PriceSource)
  priceSource?: PriceSource;

  @ApiPropertyOptional({ enum: ChartRange, default: ChartRange.D1 })
  @IsOptional()
  @IsEnum(ChartRange)
  range?: ChartRange;

  @ApiPropertyOptional({ enum: ChartInterval })
  @IsOptional()
  @IsEnum(ChartInterval)
  interval?: ChartInterval;

  @ApiPropertyOptional({ description: 'Limit number of candles', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
