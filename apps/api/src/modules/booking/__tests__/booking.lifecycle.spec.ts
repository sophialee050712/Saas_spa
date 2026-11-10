// Unit test M07 booking lifecycle: máy trạng thái, walk-in, no-show, lịch nhóm.
import { describe, expect, it } from 'vitest';
import { book, codeOf, isoPlus, makeStaffClockedIn, setup } from './booking.setup.js';

describe('M07 booking', () => {
  it('[BR-03] máy trạng thái một chiều; chuyển thẳng sang paid bị từ chối, chỉ markItemsPaid được', () => {
    const ctx = setup();
    const staffId = makeStaffClockedIn(ctx, 'K1');
    const created = book(ctx, staffId, ctx.bed1, isoPlus(300));
    const itemId = (created.items[0] as { id: string }).id;
    expect(
      codeOf(() => ctx.lifecycleA.transitionItem(ctx.tenantA, ctx.ownerA, itemId, 'completed')),
    ).toBe('INVALID_STATUS_TRANSITION');
    expect(
      codeOf(() => ctx.lifecycleA.transitionItem(ctx.tenantA, ctx.ownerA, itemId, 'paid')),
    ).toBe('INVALID_STATUS_TRANSITION');
    ctx.lifecycleA.transitionItem(ctx.tenantA, ctx.ownerA, itemId, 'arrived');
    ctx.lifecycleA.transitionItem(ctx.tenantA, ctx.ownerA, itemId, 'in_progress');
    ctx.lifecycleA.transitionItem(ctx.tenantA, ctx.ownerA, itemId, 'completed');
    expect(
      codeOf(() => ctx.lifecycleA.transitionItem(ctx.tenantA, ctx.ownerA, itemId, 'arrived')),
    ).toBe('INVALID_STATUS_TRANSITION');
    const paid = ctx.lifecycleA.markItemsPaid(ctx.tenantA, created.appointment.id, 'order-1');
    expect(paid).toHaveLength(1);
    expect(paid[0]?.status).toBe('paid');
  });

  it('[BR-05] walk-in thẳng in_progress và khoá KTV/giường ngay', () => {
    const ctx = setup();
    const staffId = makeStaffClockedIn(ctx, 'K1');
    const walkIn = ctx.bookingA.createWalkIn(ctx.tenantA, ctx.ownerA, {
      bedId: ctx.bed1,
      branchId: ctx.branchA,
      serviceId: ctx.service60,
      staffId,
      startAt: isoPlus(300),
    });
    expect(walkIn.items[0]?.status).toBe('in_progress');
    expect(walkIn.items[0]?.startedAt).not.toBeNull();
    expect(codeOf(() => book(ctx, staffId, ctx.bed2, isoPlus(330)))).toBe('BOOKING_SLOT_TAKEN');
  });

  it('[BR-04] quá giờ 30 phút chỉ gợi ý no-show, trạng thái vẫn booked cho tới khi lễ tân bấm', () => {
    const ctx = setup();
    const staffId = makeStaffClockedIn(ctx, 'K1');
    const created = book(ctx, staffId, ctx.bed1, isoPlus(-60));
    const itemId = (created.items[0] as { id: string }).id;
    const suggestions = ctx.lifecycleA.suggestNoShow(ctx.tenantA, ctx.branchA);
    expect(suggestions.map((i) => i.id)).toContain(itemId);
    expect(ctx.bookingA.getAppointment(ctx.tenantA, created.appointment.id).items[0]?.status).toBe(
      'booked',
    );
    ctx.lifecycleA.transitionItem(ctx.tenantA, ctx.ownerA, itemId, 'no_show', 'khách không đến');
    expect(ctx.bookingA.getAppointment(ctx.tenantA, created.appointment.id).items[0]?.status).toBe(
      'no_show',
    );
  });

  it('[BR-07] lịch nhóm/cặp đôi: một mã, 2 dòng song song; huỷ 1 dòng dòng còn lại giữ nguyên', () => {
    const ctx = setup();
    const s1 = makeStaffClockedIn(ctx, 'K1');
    const s2 = makeStaffClockedIn(ctx, 'K2');
    const startAt = isoPlus(300);
    const created = ctx.bookingA.createAppointment(ctx.tenantA, ctx.ownerA, {
      branchId: ctx.branchA,
      items: [
        {
          assignmentType: 'requested',
          bedId: ctx.bed1,
          serviceId: ctx.service60,
          staffId: s1,
          startAt,
        },
        {
          assignmentType: 'requested',
          bedId: ctx.bed2,
          serviceId: ctx.service60,
          staffId: s2,
          startAt,
        },
      ],
      pickupAddress: '118 Nguyễn Phúc Tần, Hội An',
      pickupHotelName: 'Khách sạn hẻm nhỏ',
      pickupTime: isoPlus(270),
    });
    expect(created.items).toHaveLength(2);
    expect(created.appointment.pickupHotelName).toBe('Khách sạn hẻm nhỏ');
    ctx.lifecycleA.transitionItem(
      ctx.tenantA,
      ctx.ownerA,
      (created.items[0] as { id: string }).id,
      'cancelled',
    );
    const after = ctx.bookingA.getAppointment(ctx.tenantA, created.appointment.id);
    expect(after.items.map((i) => i.status).sort()).toEqual(['booked', 'cancelled']);
    expect(after.derivedStatus).toBe('booked');
  });
});
