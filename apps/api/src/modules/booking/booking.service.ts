// Service M07 booking (tạo lịch, walk-in, đọc lịch). BR-01 (chống trùng gồm
// cleanup mặc định 10 phút), BR-02 (thời lượng = dịch vụ lúc đặt), BR-05
// (walk-in thẳng in_progress), BR-07 (nhóm/cặp đôi), BR-52 (bảo trì chặn
// xếp lịch → 409). Vòng đời (BR-03/BR-04) ở BookingLifecycleService.
// KHÔNG thu deposit trong MVP (spec §11).
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { store, uuid7 } from '../../store.js';
import { DomainError } from '../core/domain-error.js';
import { CoreService } from '../core/core.service.js';
import { OrgFacade } from '../org/org.facade.js';
import { CatalogFacade } from '../catalog/catalog.facade.js';
import { CustomerFacade } from '../customer/customer.facade.js';
import { FacilityFacade } from '../facility/facility.facade.js';
import type { StaffPort } from '../staff/staff.facade.js';
import { StaffFacade } from '../staff/staff.facade.js';
import { deriveAppointmentStatus, type AppointmentItemStatus } from './domain/state-machine.js';
import { addMinutes, dayRange } from './domain/tenant-time.js';
import {
  BookingRepository,
  type AppointmentItemRecord,
  type AppointmentRecord,
  type AssignmentType,
} from './booking.repository.js';

export const DEFAULT_CLEANUP_MINUTES = 10;

export interface BookingItemInput {
  assignmentType: AssignmentType;
  bedId?: string;
  customerId?: string;
  serviceId: string;
  staffId?: string;
  startAt: string;
}

export interface CreateAppointmentInput {
  branchId: string;
  customerId?: string;
  items: BookingItemInput[];
  note?: string;
  pickupAddress?: string;
  pickupHotelName?: string;
  pickupTime?: string;
  sourceChannel?: string;
}

export interface AppointmentWithItems {
  appointment: AppointmentRecord;
  derivedStatus: AppointmentItemStatus;
  items: AppointmentItemRecord[];
  warnings: string[];
}

// BookingServicePort — interface de Facade/Controller phu thuoc ma khong
// tao vong import gia tri voi StaffModule (giong StaffPort o M06).
// M07 <-> M06 co vong: booking.service -> staff.facade ->
// staff.queue.service -> booking.facade -> booking.service. Neu Facade
// dung kieu lop BookingService truc tiep, `design:paramtypes` cua TS
// danh gia BookingService luc module load (TDZ) va `node dist/main.js`
// chet ReferenceError truoc ca khi Nest khoi dong.
export interface BookingServicePort {
  createAppointment(
    tenantId: string,
    actorId: string,
    input: CreateAppointmentInput,
  ): AppointmentWithItems;
  getAppointment(
    tenantId: string,
    id: string,
    viewerStaffId?: string | null,
  ): AppointmentWithItems;
  listTimeline(
    tenantId: string,
    branchId: string,
    dateStr: string,
    viewerStaffId?: string | null,
  ): AppointmentItemRecord[];
}

@Injectable()
export class BookingService implements BookingServicePort {
  constructor(
    private readonly repo: BookingRepository,
    private readonly core: CoreService,
    private readonly org: OrgFacade,
    private readonly catalog: CatalogFacade,
    private readonly facility: FacilityFacade,
    private readonly customer: CustomerFacade,
    @Inject(forwardRef(() => StaffFacade)) private readonly staff: StaffPort,
  ) {}

  // KTV (data_scope own_only) chỉ thấy dòng của mình; không có hồ sơ staff
  // thì không thấy dòng nào. Quản lý/owner (scope khác) thấy toàn bộ.
  async resolveViewerStaffId(
    tenantId: string,
    userId: string,
    branchId: string | null,
  ): Promise<string | null | undefined> {
    const ability = await this.org.checkAbility(tenantId, userId, branchId, 'booking.view');
    if (ability.conditions['data_scope'] !== 'own_only') return undefined;
    return this.staff.getStaffByUser(tenantId, userId)?.id ?? null;
  }

  private assertCustomer(tenantId: string, actorId: string, customerId: string): void {
    this.customer.getCustomer(tenantId, actorId, customerId, {
      canManageHealth: false,
      canViewHealth: false,
      maskPhone: true,
    });
  }

  private prepareItem(
    tenantId: string,
    branchId: string,
    input: BookingItemInput,
  ): {
    bedId: string | null;
    cleanupMinutes: number;
    endAt: string;
    occupiedUntil: string;
    serviceId: string;
    staffId: string | null;
    startAt: string;
    warnings: string[];
  } {
    const service = this.catalog.getService(tenantId, input.serviceId);
    const cleanup = service.cleanupMinutes ?? DEFAULT_CLEANUP_MINUTES;
    const endAt = addMinutes(input.startAt, service.durationMinutes);
    const occupiedUntil = addMinutes(endAt, cleanup);
    const warnings: string[] = [];
    let staffId = input.staffId ?? null;
    if (staffId) {
      const staff = this.staff.getStaff(tenantId, staffId);
      if (staff.status !== 'active')
        throw new DomainError('VALIDATION_FAILED', { field: 'staffId' });
      if (
        input.assignmentType === 'requested' &&
        !this.staff.isOnShift(tenantId, staffId, input.startAt)
      ) {
        warnings.push('STAFF_NOT_ON_SHIFT');
      }
    } else if (input.assignmentType === 'auto') {
      const suggestion = this.staff.suggestNextStaff(
        tenantId,
        branchId,
        service,
        input.startAt,
        endAt,
      );
      if (suggestion.staff.length === 0)
        throw new DomainError('VALIDATION_FAILED', { reason: 'no_available_staff' });
      staffId = suggestion.staff[0]?.id ?? null;
      if (suggestion.noEnglishWarning) warnings.push('NO_ENGLISH_SPEAKING_STAFF');
    }
    return {
      bedId: input.bedId ?? null,
      cleanupMinutes: cleanup,
      endAt,
      occupiedUntil,
      serviceId: service.id,
      staffId,
      startAt: input.startAt,
      warnings,
    };
  }

  private checkSlot(
    tenantId: string,
    staffId: string | null,
    bedId: string | null,
    startAt: string,
    occupiedUntil: string,
  ): void {
    if (bedId) {
      const bed = this.facility.getBed(tenantId, bedId);
      if (bed.status !== 'available')
        throw new DomainError('BED_UNDER_MAINTENANCE', { bed: bed.name });
      if (this.facility.isUnderMaintenance(tenantId, 'bed', bedId, startAt, occupiedUntil)) {
        throw new DomainError('BED_UNDER_MAINTENANCE', { bed: bed.name });
      }
    }
    if (this.repo.findOverlapping(tenantId, staffId, bedId, startAt, occupiedUntil).length > 0) {
      throw new DomainError('BOOKING_SLOT_TAKEN');
    }
  }

  createAppointment(
    tenantId: string,
    actorId: string,
    input: CreateAppointmentInput,
  ): AppointmentWithItems {
    if (input.items.length === 0) throw new DomainError('VALIDATION_FAILED', { field: 'items' });
    if (input.customerId) this.assertCustomer(tenantId, actorId, input.customerId);
    const prepared = input.items.map((item) => this.prepareItem(tenantId, input.branchId, item));
    for (const p of prepared)
      this.checkSlot(tenantId, p.staffId, p.bedId, p.startAt, p.occupiedUntil);
    const code = `BK-${uuid7().slice(0, 8).toUpperCase()}`;
    const appointment = this.repo.createAppointment(tenantId, actorId, {
      branchId: input.branchId,
      code,
      customerId: input.customerId,
      note: input.note,
      pickupAddress: input.pickupAddress,
      pickupHotelName: input.pickupHotelName,
      pickupTime: input.pickupTime,
      sourceChannel: input.sourceChannel,
    });
    const items = prepared.map((p, i) => {
      const raw = input.items[i] as BookingItemInput;
      return this.repo.createItem(tenantId, actorId, {
        appointmentId: appointment.id,
        assignmentType: raw.assignmentType,
        bedId: p.bedId ?? undefined,
        branchId: input.branchId,
        cleanupMinutes: p.cleanupMinutes,
        customerId: raw.customerId ?? input.customerId,
        endAt: p.endAt,
        occupiedUntil: p.occupiedUntil,
        serviceId: p.serviceId,
        staffId: p.staffId ?? undefined,
        startAt: raw.startAt,
        status: 'booked',
      });
    });
    const warnings = prepared.flatMap((p) => p.warnings);
    this.core.audit(
      tenantId,
      actorId,
      'booking.appointment.created',
      'appointment',
      appointment.id,
    );
    return { appointment, derivedStatus: 'booked', items, warnings };
  }

  createWalkIn(
    tenantId: string,
    actorId: string,
    input: {
      bedId: string;
      branchId: string;
      customerId?: string;
      serviceId: string;
      staffId: string;
      startAt?: string;
    },
  ): AppointmentWithItems {
    const startAt = input.startAt ?? store.now();
    if (input.customerId) this.assertCustomer(tenantId, actorId, input.customerId);
    const prepared = this.prepareItem(tenantId, input.branchId, {
      assignmentType: 'requested',
      bedId: input.bedId,
      serviceId: input.serviceId,
      staffId: input.staffId,
      startAt,
    });
    this.checkSlot(tenantId, prepared.staffId, prepared.bedId, startAt, prepared.occupiedUntil);
    const code = `BK-${uuid7().slice(0, 8).toUpperCase()}`;
    const appointment = this.repo.createAppointment(tenantId, actorId, {
      branchId: input.branchId,
      code,
      customerId: input.customerId,
    });
    const item = this.repo.createItem(tenantId, actorId, {
      appointmentId: appointment.id,
      assignmentType: 'requested',
      bedId: prepared.bedId ?? undefined,
      branchId: input.branchId,
      cleanupMinutes: prepared.cleanupMinutes,
      customerId: input.customerId,
      endAt: prepared.endAt,
      occupiedUntil: prepared.occupiedUntil,
      serviceId: prepared.serviceId,
      staffId: prepared.staffId ?? undefined,
      startAt,
      startedAt: store.now(),
      status: 'in_progress',
    });
    this.core.audit(tenantId, actorId, 'booking.walk_in.created', 'appointment', appointment.id);
    return {
      appointment,
      derivedStatus: 'in_progress',
      items: [item],
      warnings: prepared.warnings,
    };
  }

  getAppointment(
    tenantId: string,
    id: string,
    viewerStaffId?: string | null,
  ): AppointmentWithItems {
    const appointment = this.repo.getAppointment(tenantId, id);
    if (!appointment) throw new DomainError('NOT_FOUND');
    let items = this.repo.listItems(tenantId, { appointmentId: id });
    if (viewerStaffId !== undefined) {
      items = items.filter((i) => i.staffId === viewerStaffId);
      if (items.length === 0) throw new DomainError('NOT_FOUND');
    }
    return {
      appointment,
      derivedStatus: deriveAppointmentStatus(items.map((i) => i.status)),
      items,
      warnings: [],
    };
  }

  listTimeline(
    tenantId: string,
    branchId: string,
    dateStr: string,
    viewerStaffId?: string | null,
  ): AppointmentItemRecord[] {
    const { endUtc, startUtc } = dayRange(dateStr, tenantId);
    let items = this.repo.listItems(tenantId, {
      branchId,
      startFrom: startUtc.toISOString(),
      startTo: endUtc.toISOString(),
    });
    if (viewerStaffId !== undefined) items = items.filter((i) => i.staffId === viewerStaffId);
    return items.sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
  }
}
