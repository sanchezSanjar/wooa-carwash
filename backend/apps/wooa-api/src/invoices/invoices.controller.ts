import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '@app/common/enums';
import { InvoiceStatus, PaymentMethod } from '@app/common/schemas/invoice.schema';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { CurrentUser, Roles, RolesGuard } from '../auth/roles';
import type { AuthUser } from '../auth/roles';
import { InvoicesService } from './invoices.service';

class SetInvoiceStatusDto {
  @ApiProperty({ enum: Object.values(InvoiceStatus) })
  @IsIn(Object.values(InvoiceStatus))
  status: InvoiceStatus;

  @ApiPropertyOptional({ enum: Object.values(PaymentMethod) })
  @IsOptional()
  @IsIn(Object.values(PaymentMethod))
  method?: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

/** Monthly bills. Issued by the batch server; paid outside the app; marked by admins. */
@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.invoices.listMine(user);
  }

  @Get()
  @Roles(Role.Admin)
  @ApiQuery({ name: 'month', required: false, example: '2026-11' })
  @ApiQuery({ name: 'status', required: false, enum: Object.values(InvoiceStatus) })
  list(@Query('month') month?: string, @Query('status') status?: string) {
    return this.invoices.list({ month, status });
  }

  @Get('overdue')
  @Roles(Role.Admin)
  overdue() {
    return this.invoices.overdue();
  }

  @Patch(':id')
  @Roles(Role.Admin)
  setStatus(@Param('id') id: string, @Body() dto: SetInvoiceStatusDto) {
    return this.invoices.setStatus(id, dto);
  }
}
