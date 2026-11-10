import { Module } from '@nestjs/common';
import { CoreModule } from './modules/core/core.module.js';
import { CashierModule } from './modules/cashier/cashier.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { CommissionModule } from './modules/commission/commission.module.js';
import { CustomerModule } from './modules/customer/customer.module.js';
import { EInvoiceModule } from './modules/einvoice/einvoice.module.js';
import { FacilityModule } from './modules/facility/facility.module.js';
import { OrgModule } from './modules/org/org.module.js';
import { PackageModule } from './modules/package/package.module.js';
import { PlatformModule } from './modules/platform/platform.module.js';
import { ReceiptModule } from './modules/receipt/receipt.module.js';
import { ReportModule } from './modules/report/report.module.js';
import { SalesModule } from './modules/sales/sales.module.js';
import { StaffModule } from './modules/staff/staff.module.js';
import { BookingModule } from './modules/booking/booking.module.js';

@Module({
  imports: [
    CoreModule,
    OrgModule,
    PlatformModule,
    CatalogModule,
    FacilityModule,
    CustomerModule,
    StaffModule,
    BookingModule,
    CashierModule,
    PackageModule,
    ReceiptModule,
    SalesModule,
    CommissionModule,
    ReportModule,
    EInvoiceModule,
  ],
})
export class AppModule {}
