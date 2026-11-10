import { Module, forwardRef } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { CoreModule } from '../core/core.module.js';
import { CustomerModule } from '../customer/customer.module.js';
import { FacilityModule } from '../facility/facility.module.js';
import { OrgModule } from '../org/org.module.js';
import { StaffModule } from '../staff/staff.module.js';
import { BookingController } from './booking.controller.js';
import { BookingFacade } from './booking.facade.js';
import { BookingLifecycleService } from './booking.lifecycle.service.js';
import { BookingRepository } from './booking.repository.js';
import { BookingService } from './booking.service.js';

// forwardRef StaffModule: M07 gọi StaffFacade (gợi ý KTV) trong khi M06
// đọc trạng thái lịch qua BookingFacade (đếm tua, kiểm tra rảnh).
@Module({
  controllers: [BookingController],
  exports: [BookingFacade, BookingService],
  imports: [
    CoreModule,
    OrgModule,
    CatalogModule,
    FacilityModule,
    CustomerModule,
    forwardRef(() => StaffModule),
  ],
  providers: [BookingRepository, BookingFacade, BookingLifecycleService, BookingService],
})
export class BookingModule {}
