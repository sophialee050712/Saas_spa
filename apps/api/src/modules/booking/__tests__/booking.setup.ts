// Setup chung cho test M07 booking (service-level, store in-memory).
// Wiring thật: catalog + facility + customer + staff + booking; hai chiều
// M06↔M07 nối qua StaffPort/BookingPort (closure trỏ tới service thật).
import { CoreService } from '../../core/core.service.js';
import { DomainError } from '../../core/domain-error.js';
import { OrgFacade } from '../../org/org.facade.js';
import { PlatformService } from '../../platform/platform.service.js';
import { store } from '../../../store.js';
import { CatalogFacade } from '../../catalog/catalog.facade.js';
import { CatalogRepository } from '../../catalog/catalog.repository.js';
import { CatalogService } from '../../catalog/catalog.service.js';
import { CustomerFacade } from '../../customer/customer.facade.js';
import { CustomerRepository } from '../../customer/customer.repository.js';
import { CustomerService } from '../../customer/customer.service.js';
import { FacilityFacade } from '../../facility/facility.facade.js';
import { FacilityRepository } from '../../facility/facility.repository.js';
import { FacilityService } from '../../facility/facility.service.js';
import type { BookingPort } from '../booking.facade.js';
import type { StaffPort } from '../../staff/staff.facade.js';
import { StaffQueueService } from '../../staff/staff.queue.service.js';
import { StaffRepository } from '../../staff/staff.repository.js';
import { StaffService } from '../../staff/staff.service.js';
import { BookingLifecycleService } from '../booking.lifecycle.service.js';
import { BookingRepository } from '../booking.repository.js';
import { BookingService } from '../booking.service.js';

export function codeOf(fn: () => unknown): string {
  try {
    fn();
    return 'NO_THROW';
  } catch (e) {
    return (e as DomainError).code;
  }
}

export function todayHcm(): string {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).format(new Date());
}

export function isoPlus(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export interface BookingTestCtx {
  bookingA: BookingService;
  branchA: string;
  branchB: string;
  facilityA: FacilityService;
  lifecycleA: BookingLifecycleService;
  ownerA: string;
  staffA: StaffService;
  tenantA: string;
  tenantB: string;
  bed1: string;
  bed2: string;
  bed3: string;
  service60: string;
}

export function setup(): BookingTestCtx {
  store.tenants = [];
  store.branches = [];
  store.roles = [];
  store.rolePermissions = [];
  store.tenantModules = [];
  store.users = [];
  store.userBranchRoles = [];
  store.settings = [];
  store.audit = [];
  store.idempotency = [];
  store.refreshTokens = [];
  store.subscriptions = [];
  const core = new CoreService();
  const org = new OrgFacade();
  const platform = new PlatformService(org, core);
  const a = platform.createStore({
    ownerPassword: 'mat-khau-dai-123',
    ownerPhone: '0905123456',
    slug: 'spa-a',
    spaName: 'Spa A',
  });
  const b = platform.createStore({
    ownerPassword: 'mat-khau-dai-123',
    ownerPhone: '0905123457',
    slug: 'spa-b',
    spaName: 'Spa B',
  });
  const ownerA = store.users.find((u) => u.tenantId === a.tenantId)?.id ?? '';
  const branchA = store.branches.find((x) => x.tenantId === a.tenantId)?.id ?? '';
  const branchB = store.branches.find((x) => x.tenantId === b.tenantId)?.id ?? '';
  const catalogSvc = new CatalogService(new CatalogRepository(), core, org);
  const facilitySvc = new FacilityService(new FacilityRepository(), core);
  const customerSvc = new CustomerService(new CustomerRepository(), core, org);
  const catalogFacade = new CatalogFacade(catalogSvc);
  const facilityFacade = new FacilityFacade(facilitySvc);
  const customerFacade = new CustomerFacade(customerSvc);
  const bookingRepo = new BookingRepository();
  const lifecycleSvc = new BookingLifecycleService(bookingRepo, core);
  const bookingPort: BookingPort = {
    countTurnsToday: (t, s, d) => lifecycleSvc.countTurnsToday(t, s, d),
    isBedBusy: (t, bed, s, e) => lifecycleSvc.isBedBusy(t, bed, s, e),
    isStaffBusy: (t, s, a, e) => lifecycleSvc.isStaffBusy(t, s, a, e),
  };
  const staffRepo = new StaffRepository();
  const staffSvc = new StaffService(staffRepo, core, org);
  const queueSvc = new StaffQueueService(staffRepo, bookingPort);
  const staffPort: StaffPort = {
    getStaff: (t, id) => staffSvc.getStaff(t, id),
    getStaffByUser: (t, u) => staffSvc.getStaffByUser(t, u),
    isOnShift: (t, s, at) => queueSvc.isOnShift(t, s, at),
    suggestNextStaff: (t, br, svc, s, e, lang) => queueSvc.suggestNextStaff(t, br, svc, s, e, lang),
  };
  const bookingSvc = new BookingService(
    bookingRepo,
    core,
    org,
    catalogFacade,
    facilityFacade,
    customerFacade,
    staffPort,
  );
  const tenantA = a.tenantId;
  const cat = catalogSvc.createCategory(tenantA, ownerA, { code: 'CAT-1', nameVi: 'Massage' });
  const service60 = catalogSvc.createService(tenantA, ownerA, {
    categoryId: cat.id,
    code: 'SV-MASSAGE',
    durationMinutes: 60,
    nameVi: 'Massage Body',
    price: 500000,
  }).id;
  const room = facilitySvc.createRoom(tenantA, ownerA, {
    branchId: branchA,
    code: 'R1',
    name: 'Phòng 1',
  });
  const bed1 = facilitySvc.createBed(tenantA, ownerA, {
    code: 'B1',
    name: 'Giường 1',
    roomId: room.id,
  }).id;
  const bed2 = facilitySvc.createBed(tenantA, ownerA, {
    code: 'B2',
    name: 'Giường 2',
    roomId: room.id,
  }).id;
  const bed3 = facilitySvc.createBed(tenantA, ownerA, {
    code: 'B3',
    name: 'Giường 3',
    roomId: room.id,
  }).id;
  return {
    bed1,
    bed2,
    bed3,
    bookingA: bookingSvc,
    branchA,
    branchB,
    facilityA: facilitySvc,
    lifecycleA: lifecycleSvc,
    ownerA,
    service60,
    staffA: staffSvc,
    tenantA,
    tenantB: b.tenantId,
  };
}

export function makeStaffClockedIn(ctx: BookingTestCtx, code: string): string {
  const { branchA, ownerA, staffA, tenantA } = ctx;
  const id = staffA.createStaff(tenantA, ownerA, {
    branchId: branchA,
    employeeCode: code,
    fullName: `KTV ${code}`,
  }).id;
  staffA.addSkill(tenantA, ownerA, id, 'massage-body');
  staffA.createShift(tenantA, ownerA, {
    branchId: branchA,
    endTime: '21:00',
    staffId: id,
    startTime: '09:00',
    workDate: todayHcm(),
  });
  staffA.clockIn(tenantA, ownerA, id);
  return id;
}

export function book(
  ctx: BookingTestCtx,
  staffId: string,
  bedId: string,
  startAt: string,
  assignmentType: 'auto' | 'requested' = 'requested',
) {
  return ctx.bookingA.createAppointment(ctx.tenantA, ctx.ownerA, {
    branchId: ctx.branchA,
    items: [{ assignmentType, bedId, serviceId: ctx.service60, staffId, startAt }],
  });
}
