// Máy trạng thái dòng lịch (BR-03, BR-05): hàm thuần, không IO.
// booked → arrived → in_progress → completed → paid (chỉ M08 qua
// markItemsPaid); nhánh phụ booked/arrived → cancelled/no_show. Walk-in
// tạo thẳng in_progress (BR-05) — ngoại lệ duy nhất, không đi qua hàm này.
// Trạng thái mã đặt lịch suy ra từ các dòng, không lưu riêng.
export type AppointmentItemStatus =
  'arrived' | 'booked' | 'cancelled' | 'completed' | 'in_progress' | 'no_show' | 'paid';

export const ACTIVE_ITEM_STATUSES: AppointmentItemStatus[] = [
  'arrived',
  'booked',
  'completed',
  'in_progress',
];

const ALLOWED_TRANSITIONS: Record<AppointmentItemStatus, AppointmentItemStatus[]> = {
  arrived: ['cancelled', 'in_progress', 'no_show'],
  booked: ['arrived', 'cancelled', 'no_show'],
  cancelled: [],
  completed: [],
  in_progress: ['completed'],
  no_show: [],
  paid: [],
};

export function canTransition(from: AppointmentItemStatus, to: AppointmentItemStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function deriveAppointmentStatus(statuses: AppointmentItemStatus[]): AppointmentItemStatus {
  if (statuses.length === 0) return 'booked';
  if (statuses.some((s) => s === 'in_progress')) return 'in_progress';
  if (statuses.some((s) => s === 'arrived')) return 'arrived';
  if (statuses.some((s) => s === 'completed')) return 'completed';
  if (statuses.every((s) => s === 'paid')) return 'paid';
  if (statuses.every((s) => s === 'cancelled' || s === 'no_show')) return 'cancelled';
  if (statuses.some((s) => s === 'paid')) return 'completed';
  return 'booked';
}
