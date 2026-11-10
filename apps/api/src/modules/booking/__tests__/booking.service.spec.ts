// Unit + isolation test M07 booking: tạo lịch, chống trùng, bảo trì, gợi ý tua.
import { describe, expect, it } from 'vitest';
import { book, codeOf, isoPlus, makeStaffClockedIn, setup, todayHcm } from './booking.setup.js';

describe('M07 booking', () => {
  it('[BR-02] thời lượng = dịch vụ lúc đặt: 60 phút + cleanup 10 → occupied_until +70 phút', () => {
    const ctx = setup();
    const staffId = makeStaffClockedIn(ctx, 'K1');
    const startAt = isoPlus(300);
    const created = book(ctx, staffId, ctx.bed1, startAt);
    const item = created.items[0] as NonNullable<(typeof created.items)[number]>;
    expect(item.endAt).toBe(new Date(new Date(startAt).getTime() + 60 * 60000).toISOString());
    expect(item.occupiedUntil).toBe(
      new Date(new Date(startAt).getTime() + 70 * 60000).toISOString(),
    );
    expect(item.status).toBe('booked');
  });

  it('[BR-01] trùng KTV gồm cleanup: bắt đầu 15:05 sau lịch 14:00–15:00 thì 409, 15:10 thì được', () => {
    const ctx = setup();
    const staffId = makeStaffClockedIn(ctx, 'K1');
    const startAt = isoPlus(300);
    book(ctx, staffId, ctx.bed1, startAt);
    const clash = isoPlus(365);
    expect(codeOf(() => book(ctx, staffId, ctx.bed2, clash))).toBe('BOOKING_SLOT_TAKEN');
    const ok = isoPlus(370);
    expect(book(ctx, staffId, ctx.bed2, ok).items).toHaveLength(1);
  });

  it('[BR-01] trùng giường khác KTV cũng 409; huỷ lịch thì xếp lại được ngay', () => {
    const ctx = setup();
    const s1 = makeStaffClockedIn(ctx, 'K1');
    const s2 = makeStaffClockedIn(ctx, 'K2');
    const startAt = isoPlus(300);
    const created = book(ctx, s1, ctx.bed1, startAt);
    expect(codeOf(() => book(ctx, s2, ctx.bed1, isoPlus(330)))).toBe('BOOKING_SLOT_TAKEN');
    ctx.lifecycleA.transitionItem(
      ctx.tenantA,
      ctx.ownerA,
      (created.items[0] as { id: string }).id,
      'cancelled',
    );
    expect(book(ctx, s2, ctx.bed1, startAt).items).toHaveLength(1);
  });

  it('[BR-52] giường bảo trì hoặc out_of_service thì 409 BED_UNDER_MAINTENANCE', () => {
    const ctx = setup();
    const staffId = makeStaffClockedIn(ctx, 'K1');
    const startAt = isoPlus(300);
    ctx.facilityA.createMaintenance(ctx.tenantA, ctx.ownerA, {
      endAt: isoPlus(420),
      reason: 'Bảo trì định kỳ',
      startAt: isoPlus(240),
      targetId: ctx.bed3,
      targetType: 'bed',
    });
    expect(codeOf(() => book(ctx, staffId, ctx.bed3, startAt))).toBe('BED_UNDER_MAINTENANCE');
    ctx.facilityA.updateBed(ctx.tenantA, ctx.ownerA, ctx.bed2, { status: 'out_of_service' });
    expect(codeOf(() => book(ctx, staffId, ctx.bed2, startAt))).toBe('BED_UNDER_MAINTENANCE');
    expect(book(ctx, staffId, ctx.bed1, startAt).items).toHaveLength(1);
  });

  it('[BR-06] tạo lịch auto gợi ý KTV ít tua nhất; khách chỉ định KTV chưa vào ca thì cảnh báo nhưng vẫn tạo', () => {
    const ctx = setup();
    const busy = makeStaffClockedIn(ctx, 'K1');
    const free = makeStaffClockedIn(ctx, 'K2');
    const startAt = isoPlus(660);
    book(ctx, busy, ctx.bed1, isoPlus(480), 'auto');
    book(ctx, busy, ctx.bed1, isoPlus(560), 'auto');
    const created = ctx.bookingA.createAppointment(ctx.tenantA, ctx.ownerA, {
      branchId: ctx.branchA,
      items: [{ assignmentType: 'auto', bedId: ctx.bed2, serviceId: ctx.service60, startAt }],
    });
    expect(created.items[0]?.staffId).toBe(free);
    const notOnShift = ctx.staffA.createStaff(ctx.tenantA, ctx.ownerA, {
      branchId: ctx.branchA,
      employeeCode: 'K3',
      fullName: 'KTV K3',
    }).id;
    const requested = book(ctx, notOnShift, ctx.bed1, isoPlus(700));
    expect(requested.warnings).toContain('STAFF_NOT_ON_SHIFT');
  });

  it('[ISOLATION] spa B thao tác mã/dòng/dịch vụ của spa A thì 404, dữ liệu spa A không đổi', () => {
    const ctx = setup();
    const staffId = makeStaffClockedIn(ctx, 'K1');
    const created = book(ctx, staffId, ctx.bed1, isoPlus(300));
    const itemId = (created.items[0] as { id: string }).id;
    expect(codeOf(() => ctx.bookingA.getAppointment(ctx.tenantB, created.appointment.id))).toBe(
      'NOT_FOUND',
    );
    expect(
      codeOf(() => ctx.lifecycleA.transitionItem(ctx.tenantB, ctx.ownerA, itemId, 'arrived')),
    ).toBe('NOT_FOUND');
    expect(
      codeOf(() =>
        ctx.bookingA.createAppointment(ctx.tenantB, ctx.ownerA, {
          branchId: ctx.branchB,
          items: [
            {
              assignmentType: 'requested',
              bedId: ctx.bed1,
              serviceId: ctx.service60,
              staffId,
              startAt: isoPlus(300),
            },
          ],
        }),
      ),
    ).toBe('NOT_FOUND');
    expect(ctx.bookingA.getAppointment(ctx.tenantA, created.appointment.id).items[0]?.status).toBe(
      'booked',
    );
    expect(ctx.bookingA.listTimeline(ctx.tenantB, ctx.branchB, todayHcm())).toEqual([]);
  });
});
