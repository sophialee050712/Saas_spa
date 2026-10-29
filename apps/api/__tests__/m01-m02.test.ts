import { describe, expect, it } from 'vitest';
import { CoreService } from '../src/modules/core/core.service.js';
import { OrgFacade } from '../src/modules/org/org.facade.js';
import { OrgService } from '../src/modules/org/org.service.js';
import { PlatformService } from '../src/modules/platform/platform.service.js';
import { DomainError } from '../src/modules/core/domain-error.js';
import { store } from '../src/store.js';
import { totpCode } from '../src/modules/core/auth.js';

function setup(): {
  core: CoreService;
  org: OrgService;
  platform: PlatformService;
  tenantId: string;
} {
  // Reset store giữa các test (store là singleton in-memory).
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
  const facade = new OrgFacade();
  facade.onModuleInit();
  const org = new OrgService(facade, core);
  const platform = new PlatformService(facade, core);
  const created = platform.createStore({
    ownerPassword: 'mat-khau-dai-123',
    ownerPhone: '0905123456',
    slug: 'spa-hoi-an',
    spaName: 'Spa Hoi An',
  });
  return { core, org, platform, tenantId: created.tenantId };
}

describe('M01 platform', () => {
  it('[STORE] tạo store tạo tenant + branch + 4 vai trò + entitled trial', () => {
    const { tenantId } = setup();
    expect(store.branches.filter((b) => b.tenantId === tenantId)).toHaveLength(1);
    expect(store.roles.filter((r) => r.tenantId === tenantId)).toHaveLength(4);
    const modules = store.tenantModules.filter((m) => m.tenantId === tenantId);
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.every((m) => m.entitled)).toBe(true);
  });

  it('[STORE] slug trùng thì 409-tương đương, không tạo tenant mồ côi', () => {
    setup();
    const { platform } = setup();
    // setup lần 2 đã tạo lại cùng slug ở store mới; thử tạo trùng ngay:
    expect(() =>
      platform.createStore({
        ownerPassword: 'mat-khau-dai-123',
        ownerPhone: '0905123457',
        slug: 'spa-hoi-an',
        spaName: 'Khac',
      }),
    ).toThrow(DomainError);
    expect(store.tenants.filter((t) => t.slug === 'spa-hoi-an')).toHaveLength(1);
  });

  it('[BR-08] entitled AND enabled: trial entitled nhưng enabled=false thì module tắt', async () => {
    const { org } = setup();
    const tenantId = store.tenants[0]?.id as string;
    const facade = new OrgFacade();
    expect(await facade.isModuleActive(tenantId, 'commission')).toBe(false);
    const owner = store.users.find((u) => u.tenantId === tenantId);
    const rec = org.toggleModule(tenantId, owner?.id as string, 'commission', true);
    expect((rec as { enabled: boolean }).enabled).toBe(true);
    expect(await facade.isModuleActive(tenantId, 'commission')).toBe(true);
  });

  it('[ISOLATION] người spa B không thấy dữ liệu spa A', () => {
    const { platform } = setup();
    const tenantA = store.tenants[0]?.id as string;
    platform.createStore({
      ownerPassword: 'mat-khau-dai-123',
      ownerPhone: '0905999999',
      slug: 'spa-da-nang',
      spaName: 'Spa Da Nang',
    });
    const tenantB = store.tenants.find((t) => t.slug === 'spa-da-nang')?.id as string;
    const branchesA = store.branches.filter((b) => b.tenantId === tenantA);
    const branchesB = store.branches.filter((b) => b.tenantId === tenantB);
    expect(branchesA).toHaveLength(1);
    expect(branchesB).toHaveLength(1);
    expect(branchesA[0]?.id).not.toBe(branchesB[0]?.id);
  });
});

describe('M02 org + M00 auth', () => {
  it('[BR-61] PIN sai 5 lần thì khóa 15 phút, PIN scrypt cũ vô hiệu', async () => {
    const { core, tenantId } = setup();
    const owner = store.users.find((u) => u.tenantId === tenantId) as typeof store.users[number];
    core.resetPinByOwner(tenantId, owner.id, '123456', owner.id);
    const branchId = store.branches.find((b) => b.tenantId === tenantId)?.id as string;
    // PIN scrypt cũ (định dạng GĐ0) phải thất bại, không chuyển đổi hash.
    owner.pinHash = 'scrypt:abcd:1234';
    expect(() => core.verifyPin(tenantId, owner.id, branchId, '123456', 'core.pin.verify')).toThrow();
    core.resetPinByOwner(tenantId, owner.id, '123456', owner.id);
    for (let i = 0; i < 4; i += 1) {
      expect(() => core.verifyPin(tenantId, owner.id, branchId, '000000', 'core.pin.verify')).toThrow();
    }
    expect(() => core.verifyPin(tenantId, owner.id, branchId, '000000', 'core.pin.verify')).toThrow(
      'PIN_LOCKED',
    );
  });

  it('[BR-62] đăng nhập sai 10 lần thì khóa, đúng mật khẩu vẫn bị khóa', () => {
    const { core, tenantId } = setup();
    for (let i = 0; i < 10; i += 1) {
      expect(() => core.login(tenantId, '0905123456', 'sai-mat-khau-1')).toThrow('UNAUTHORIZED');
    }
    expect(() => core.login(tenantId, '0905123456', 'mat-khau-dai-123')).toThrow('UNAUTHORIZED');
  });

  it('[LAST-OWNER] không xóa/hạ quyền owner cuối cùng', () => {
    const { org, tenantId } = setup();
    const owner = store.users.find((u) => u.tenantId === tenantId) as typeof store.users[number];
    const branchId = store.branches.find((b) => b.tenantId === tenantId)?.id as string;
    const ownerRole = store.roles.find((r) => r.tenantId === tenantId && r.code === 'owner');
    expect(() =>
      org.removeUserRole(tenantId, owner.id, owner.id, branchId, ownerRole?.id as string),
    ).toThrow('LAST_OWNER_PROTECTION');
  });

  it('[INVITE] link mời hết hạn 72h và dùng một lần', () => {
    const { org, tenantId } = setup();
    const owner = store.users.find((u) => u.tenantId === tenantId) as typeof store.users[number];
    const branchId = store.branches.find((b) => b.tenantId === tenantId)?.id as string;
    const role = store.roles.find((r) => r.tenantId === tenantId && r.code === 'receptionist');
    const invite = org.createInvite(tenantId, owner.id, {
      branchId,
      phone: '0905111222',
      roleId: role?.id as string,
    });
    const accepted = org.acceptInvite(invite.token, 'mat-khau-moi-123', '654321');
    expect(accepted.userId).toBe(invite.userId);
    expect(() => org.acceptInvite(invite.token, 'mat-khau-moi-123', '654321')).toThrow();
    const invite2 = org.createInvite(tenantId, owner.id, {
      branchId,
      phone: '0905111333',
      roleId: role?.id as string,
    });
    const user2 = store.users.find((u) => u.id === invite2.userId);
    if (user2) user2.inviteExpiresAt = new Date(Date.now() - 1000).toISOString();
    expect(() => org.acceptInvite(invite2.token, 'mat-khau-moi-123', '654321')).toThrow();
  });

  it('[IDEMPOTENCY] gửi lại cùng key cùng nội dung trả response cũ, khác nội dung thì 409', () => {
    const { core, tenantId } = setup();
    const owner = store.users.find((u) => u.tenantId === tenantId) as typeof store.users[number];
    expect(core.checkIdempotency(tenantId, owner.id, 'key-1', 'createStore', 'hash-a')).toBeNull();
    core.saveIdempotency(tenantId, owner.id, 'key-1', { ok: true });
    expect(core.checkIdempotency(tenantId, owner.id, 'key-1', 'createStore', 'hash-a')).toEqual({
      ok: true,
    });
    expect(() => core.checkIdempotency(tenantId, owner.id, 'key-1', 'createStore', 'hash-khac')).toThrow(
      'IDEMPOTENCY_CONFLICT',
    );
  });

  it('[REFRESH] refresh quay vòng: token cũ vô hiệu ngay sau khi đổi mới', () => {
    const { core, tenantId } = setup();
    const session = core.login(tenantId, '0905123456', 'mat-khau-dai-123');
    const rotated = core.refresh(session.refreshToken);
    expect(rotated.accessToken).toBeTruthy();
    expect(rotated.refreshToken).not.toBe(session.refreshToken);
    expect(() => core.refresh(session.refreshToken)).toThrow('UNAUTHORIZED');
  });

  it('[2FA] admin platform đăng nhập cần TOTP đúng', () => {
    const { platform } = setup();
    platform.seedPlatformAdmin('admin@webgool.test', 'admin-mat-khau-123', 'totp-secret-demo');
    const code = totpCode('totp-secret-demo');
    expect(platform.adminLogin('admin@webgool.test', 'admin-mat-khau-123', code)).toHaveProperty(
      'accessToken',
    );
    expect(() =>
      platform.adminLogin('admin@webgool.test', 'admin-mat-khau-123', '000000'),
    ).toThrow('UNAUTHORIZED');
  });
});
