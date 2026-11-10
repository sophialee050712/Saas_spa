// Facade M07 — cổng công khai duy nhất cho module khác (M08 gọi
// markItemsPaid trong transaction đóng đơn; M06 đọc trạng thái lịch qua
// BookingPort để đếm tua/kiểm tra rảnh; M15 đọc lịch để nhắc). Spec §5.
// BookingPort là interface để StaffService phụ thuộc mà không tạo vòng
// import giá trị với StaffModule (module dùng forwardRef cả hai chiều).
// LƯU Ý: service booking từ chối chuyển paid trực tiếp (BR-03) — chỉ
// markItemsPaid() (M08 gọi) mới chuyển completed → paid.
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { BookingLifecycleService } from './booking.lifecycle.service.js';
import {
  BookingService,
  type AppointmentWithItems,
  type BookingServicePort,
  type CreateAppointmentInput,
} from './booking.service.js';
import type { AppointmentItemRecord } from './booking.repository.js';
import type { AppointmentItemStatus } from './domain/state-machine.js';

export interface BookingPort {
  countTurnsToday(tenantId: string, staffId: string, dateStr: string): number;
  isBedBusy(tenantId: string, bedId: string, startAt: string, endAt: string): boolean;
  isStaffBusy(tenantId: string, staffId: string, startAt: string, endAt: string): boolean;
}

@Injectable()
export class BookingFacade implements BookingPort {
  // forwardRef BookingService: M07 <-> M06 co vong import gia tri
  // (booking.service -> staff.facade -> staff.queue.service ->
  // booking.facade -> booking.service). Khong co forwardRef o day,
  // `design:paramtypes` cua TS danh gia BookingService luc module load
  // (TDZ) va `node dist/main.js` chet voi ReferenceError truoc ca khi
  // Nest khoi dong — chi vitest chiu duoc vong nay. Ben M06 da dung
  // forwardRef tuong tu (staff.queue.service).
  constructor(
    @Inject(forwardRef(() => BookingService)) private readonly service: BookingServicePort,
    private readonly lifecycle: BookingLifecycleService,
  ) {}

  createAppointment(
    tenantId: string,
    actorId: string,
    input: CreateAppointmentInput,
  ): AppointmentWithItems {
    return this.service.createAppointment(tenantId, actorId, input);
  }

  getAppointment(
    tenantId: string,
    appointmentId: string,
    viewerStaffId?: string | null,
  ): AppointmentWithItems {
    return this.service.getAppointment(tenantId, appointmentId, viewerStaffId);
  }

  transitionItem(
    tenantId: string,
    actorId: string,
    itemId: string,
    to: AppointmentItemStatus,
    reason?: string,
  ): AppointmentItemRecord {
    return this.lifecycle.transitionItem(tenantId, actorId, itemId, to, reason);
  }

  markItemsPaid(tenantId: string, appointmentId: string, orderId: string): AppointmentItemRecord[] {
    return this.lifecycle.markItemsPaid(tenantId, appointmentId, orderId);
  }

  listTimeline(
    tenantId: string,
    branchId: string,
    dateStr: string,
    viewerStaffId?: string | null,
  ): AppointmentItemRecord[] {
    return this.service.listTimeline(tenantId, branchId, dateStr, viewerStaffId);
  }

  suggestNoShow(tenantId: string, branchId: string): AppointmentItemRecord[] {
    return this.lifecycle.suggestNoShow(tenantId, branchId);
  }

  countTurnsToday(tenantId: string, staffId: string, dateStr: string): number {
    return this.lifecycle.countTurnsToday(tenantId, staffId, dateStr);
  }

  isStaffBusy(tenantId: string, staffId: string, startAt: string, endAt: string): boolean {
    return this.lifecycle.isStaffBusy(tenantId, staffId, startAt, endAt);
  }

  isBedBusy(tenantId: string, bedId: string, startAt: string, endAt: string): boolean {
    return this.lifecycle.isBedBusy(tenantId, bedId, startAt, endAt);
  }
}
