// Vòng đời dòng lịch (BR-03/BR-04) + truy vấn phục vụ M06 (đếm tua, kiểm
// tra rảnh) — tách khỏi BookingService để mỗi file ≤ 300 dòng.
import { Injectable } from '@nestjs/common';
import { store } from '../../store.js';
import { DomainError } from '../core/domain-error.js';
import { CoreService } from '../core/core.service.js';
import { canTransition, type AppointmentItemStatus } from './domain/state-machine.js';
import { dayRange } from './domain/tenant-time.js';
import { BookingRepository, type AppointmentItemRecord } from './booking.repository.js';

export const NO_SHOW_THRESHOLD_MINUTES = 30;

@Injectable()
export class BookingLifecycleService {
  constructor(
    private readonly repo: BookingRepository,
    private readonly core: CoreService,
  ) {}

  transitionItem(
    tenantId: string,
    actorId: string,
    itemId: string,
    to: AppointmentItemStatus,
    reason?: string,
    viewerStaffId?: string | null,
  ): AppointmentItemRecord {
    // Chỉ M08 chuyển sang paid (qua markItemsPaid trong transaction đóng
    // đơn); API booking từ chối chuyển paid trực tiếp (BR-03).
    if (to === 'paid') throw new DomainError('INVALID_STATUS_TRANSITION', { to: 'paid' });
    const item = this.repo.getItem(tenantId, itemId);
    if (!item) throw new DomainError('NOT_FOUND');
    if (viewerStaffId !== undefined && item.staffId !== viewerStaffId) {
      throw new DomainError('NOT_FOUND');
    }
    if (item.status === 'paid') {
      throw new DomainError('INVALID_STATUS_TRANSITION', { from: 'paid' });
    }
    if (!canTransition(item.status, to)) {
      throw new DomainError('INVALID_STATUS_TRANSITION', { from: item.status, to });
    }
    const now = store.now();
    const patch: Partial<AppointmentItemRecord> = { status: to };
    if (to === 'arrived') patch.checkedInAt = now;
    if (to === 'in_progress') patch.startedAt = now;
    if (to === 'completed') patch.completedAt = now;
    if (to === 'no_show') patch.noShowReason = reason ?? null;
    const updated = this.repo.updateItem(tenantId, itemId, actorId, patch);
    if (!updated) throw new DomainError('NOT_FOUND');
    this.core.audit(
      tenantId,
      actorId,
      `booking.item.${to}`,
      'appointment_item',
      itemId,
      { status: item.status },
      { reason: reason ?? '', status: to },
    );
    return updated;
  }

  // Chỉ M08 gọi, trong transaction đóng đơn (BR-03): các dòng completed
  // sang paid. Ghi chú: APPOINTMENT_COMPLETED phát khi completed; ORDER_PAID
  // do M08 ghi outbox — M07 chỉ đổi trạng thái, không ghi outbox ở đây.
  markItemsPaid(tenantId: string, appointmentId: string, orderId: string): AppointmentItemRecord[] {
    const actorId = 'system';
    const paid: AppointmentItemRecord[] = [];
    for (const item of this.repo.listItems(tenantId, { appointmentId, status: 'completed' })) {
      const updated = this.repo.updateItem(tenantId, item.id, actorId, { status: 'paid' });
      if (updated) paid.push(updated);
    }
    if (paid.length > 0) {
      this.core.audit(tenantId, actorId, 'booking.items.paid', 'appointment', appointmentId, null, {
        orderId,
      });
    }
    return paid;
  }

  // BR-04: chỉ gợi ý — dòng vẫn booked cho tới khi lễ tân bấm no-show.
  suggestNoShow(tenantId: string, branchId: string, now?: string): AppointmentItemRecord[] {
    const at = new Date(now ?? store.now()).getTime() - NO_SHOW_THRESHOLD_MINUTES * 60 * 1000;
    return this.repo
      .listItems(tenantId, { branchId, status: 'booked' })
      .filter((i) => new Date(i.startAt).getTime() <= at);
  }

  countTurnsToday(tenantId: string, staffId: string, dateStr: string): number {
    const { endUtc, startUtc } = dayRange(dateStr, tenantId);
    return this.repo
      .listItems(tenantId, {
        staffId,
        startFrom: startUtc.toISOString(),
        startTo: endUtc.toISOString(),
      })
      .filter(
        (i) => i.assignmentType === 'auto' && i.status !== 'cancelled' && i.status !== 'no_show',
      ).length;
  }

  isStaffBusy(tenantId: string, staffId: string, startAt: string, endAt: string): boolean {
    return this.repo.findOverlapping(tenantId, staffId, null, startAt, endAt).length > 0;
  }

  isBedBusy(tenantId: string, bedId: string, startAt: string, endAt: string): boolean {
    return this.repo.findOverlapping(tenantId, null, bedId, startAt, endAt).length > 0;
  }
}
