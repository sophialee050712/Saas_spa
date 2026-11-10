// Repository M07 booking — lớp thay thế tạm cho Prisma adapter.
// Cùng seam như M03/M04/M06: store.ts đang bị đóng băng (adapter agent giữ
// packages/db, chưa có migration cho M07) nên collection in-memory sống ở
// đây. Mọi truy vấn lọc theo tenantId từ TenantContext.
// LƯU Ý CHO ADAPTER: exclusion constraint excl_staff_overlap /
// excl_bed_overlap + trigger occupied_until (master plan §5) nằm ở
// migration, không có ở lớp in-memory này — service chỉ check-then-insert.
import { Injectable } from '@nestjs/common';
import { store, uuid7 } from '../../store.js';
import {
  ACTIVE_ITEM_STATUSES,
  rangesOverlap,
  type AppointmentItemStatus,
} from './domain/state-machine.js';

export type AssignmentType = 'auto' | 'requested';

interface BaseRecord {
  createdAt: string;
  createdBy: string | null;
  id: string;
  tenantId: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface AppointmentRecord extends BaseRecord {
  branchId: string;
  code: string;
  customerId: string | null;
  note: string | null;
  pickupAddress: string | null;
  pickupHotelName: string | null;
  pickupTime: string | null;
  sourceChannel: string;
}

export interface AppointmentItemRecord extends BaseRecord {
  appointmentId: string;
  assignmentType: AssignmentType;
  bedId: string | null;
  branchId: string;
  checkedInAt: string | null;
  cleanupMinutes: number;
  completedAt: string | null;
  customerId: string | null;
  endAt: string;
  noShowReason: string | null;
  occupiedUntil: string;
  serviceId: string;
  staffId: string | null;
  startAt: string;
  startedAt: string | null;
  status: AppointmentItemStatus;
}

function base(tenantId: string, actorId: string | null): BaseRecord {
  const now = store.now();
  return {
    createdAt: now,
    createdBy: actorId,
    id: uuid7(),
    tenantId,
    updatedAt: now,
    updatedBy: actorId,
  };
}

@Injectable()
export class BookingRepository {
  private appointments: AppointmentRecord[] = [];
  private items: AppointmentItemRecord[] = [];

  createAppointment(
    tenantId: string,
    actorId: string,
    input: {
      branchId: string;
      code: string;
      customerId?: string;
      note?: string;
      pickupAddress?: string;
      pickupHotelName?: string;
      pickupTime?: string;
      sourceChannel?: string;
    },
  ): AppointmentRecord {
    const rec: AppointmentRecord = {
      ...base(tenantId, actorId),
      branchId: input.branchId,
      code: input.code,
      customerId: input.customerId ?? null,
      note: input.note ?? null,
      pickupAddress: input.pickupAddress ?? null,
      pickupHotelName: input.pickupHotelName ?? null,
      pickupTime: input.pickupTime ?? null,
      sourceChannel: input.sourceChannel ?? 'other',
    };
    this.appointments.push(rec);
    return rec;
  }

  countAppointments(tenantId: string): number {
    return this.appointments.filter((a) => a.tenantId === tenantId).length;
  }

  getAppointment(tenantId: string, id: string): AppointmentRecord | undefined {
    return this.appointments.find((a) => a.tenantId === tenantId && a.id === id);
  }

  createItem(
    tenantId: string,
    actorId: string,
    input: {
      appointmentId: string;
      assignmentType: AssignmentType;
      bedId?: string;
      branchId: string;
      cleanupMinutes: number;
      customerId?: string;
      endAt: string;
      occupiedUntil: string;
      serviceId: string;
      staffId?: string;
      startAt: string;
      startedAt?: string;
      status: AppointmentItemStatus;
    },
  ): AppointmentItemRecord {
    const rec: AppointmentItemRecord = {
      ...base(tenantId, actorId),
      appointmentId: input.appointmentId,
      assignmentType: input.assignmentType,
      bedId: input.bedId ?? null,
      branchId: input.branchId,
      checkedInAt: null,
      cleanupMinutes: input.cleanupMinutes,
      completedAt: null,
      customerId: input.customerId ?? null,
      endAt: input.endAt,
      noShowReason: null,
      occupiedUntil: input.occupiedUntil,
      serviceId: input.serviceId,
      staffId: input.staffId ?? null,
      startAt: input.startAt,
      startedAt: input.startedAt ?? null,
      status: input.status,
    };
    this.items.push(rec);
    return rec;
  }

  getItem(tenantId: string, id: string): AppointmentItemRecord | undefined {
    return this.items.find((i) => i.tenantId === tenantId && i.id === id);
  }

  listItems(
    tenantId: string,
    filter: {
      appointmentId?: string;
      branchId?: string;
      staffId?: string;
      startFrom?: string;
      startTo?: string;
      status?: AppointmentItemStatus;
    },
  ): AppointmentItemRecord[] {
    return this.items.filter(
      (i) =>
        i.tenantId === tenantId &&
        (!filter.appointmentId || i.appointmentId === filter.appointmentId) &&
        (!filter.branchId || i.branchId === filter.branchId) &&
        (!filter.staffId || i.staffId === filter.staffId) &&
        (!filter.status || i.status === filter.status) &&
        (!filter.startFrom || i.startAt >= filter.startFrom) &&
        (!filter.startTo || i.startAt < filter.startTo),
    );
  }

  updateItem(
    tenantId: string,
    id: string,
    actorId: string,
    patch: Partial<AppointmentItemRecord>,
  ): AppointmentItemRecord | undefined {
    const rec = this.getItem(tenantId, id);
    if (!rec) return undefined;
    Object.assign(rec, patch, { updatedAt: store.now(), updatedBy: actorId });
    return rec;
  }

  // Chống trùng ở service (BR-01): dòng đang hoạt động (không cancelled /
  // no_show) có [startAt, occupiedUntil) giao nhau. Đây là check-then-insert
  // — lớp chặn cuối là exclusion constraint ở DB (xem ghi chú đầu file).
  findOverlapping(
    tenantId: string,
    staffId: string | null,
    bedId: string | null,
    startAt: string,
    occupiedUntil: string,
  ): AppointmentItemRecord[] {
    return this.items.filter(
      (i) =>
        i.tenantId === tenantId &&
        ACTIVE_ITEM_STATUSES.includes(i.status) &&
        rangesOverlap(i.startAt, i.occupiedUntil, startAt, occupiedUntil) &&
        ((staffId !== null && i.staffId === staffId) || (bedId !== null && i.bedId === bedId)),
    );
  }
}
