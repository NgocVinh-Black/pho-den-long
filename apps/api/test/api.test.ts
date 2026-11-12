import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CATALOG, shopMap, type EndDayResult, type PlayerState, type ServeResult } from '@pdl/shared';
import { buildApp } from '../src/app';
import { GameError } from '../src/lib/errors';

let app: FastifyInstance;
const prisma = new PrismaClient();

const fakeGoogle = async (token: string) => {
  if (!token.startsWith('valid-token-')) throw new GameError('Đăng nhập Google không hợp lệ', 401);
  const who = token.slice('valid-token-'.length);
  return { sub: `sub-${who}`, email: `${who}@example.com`, name: `Người ${who}` };
};

beforeAll(async () => {
  app = await buildApp({
    prisma,
    cookieSecret: 'test-secret-test-secret-test-secret-1234',
    googleClientId: 'test-client-id',
    verifyGoogle: fakeGoogle,
  });
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const post = (url: string, payload?: object) => app.inject({ method: 'POST', url, payload: payload ?? {} });

async function newPlayer(shopId: string): Promise<PlayerState> {
  const res = await post('/api/players', { name: 'Cô Ba', shopId });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe('catalog', () => {
  it('có 20 quán, mỗi quán ≥ 3 món, món nào cũng lời', async () => {
    const res = await app.inject('/api/catalog');
    expect(res.statusCode).toBe(200);
    expect(CATALOG.shops).toHaveLength(20);
    for (const shop of CATALOG.shops) {
      expect(shop.recipes.length).toBeGreaterThanOrEqual(3);
      for (const r of shop.recipes) expect(r.price).toBeGreaterThan(r.cost);
    }
  });
});

describe('vòng chơi một ngày', () => {
  it('mua → nấu → kết thúc ngày', async () => {
    const p = await newPlayer('pho');
    const recipe = shopMap.get('pho')!.recipes[0]!;
    expect(p.learned).toEqual([recipe.id]);

    const buy = await post(`/api/players/${p.id}/buy`, {
      items: recipe.ingredients.map((i) => ({ id: i.id, qty: 2 })),
    });
    expect(buy.statusCode).toBe(200);
    const { spent, player, shipment } = buy.json();
    expect(player.money).toBe(300 - spent);
    expect(shipment.mode).toBe('carry');
    expect(player.pantry).toEqual({});
    expect(player.shipments).toHaveLength(1);

    // Chưa cất hàng lên kệ thì chưa nấu được
    const early = await post(`/api/players/${p.id}/serve`, { recipeId: recipe.id, quality: 1 });
    expect(early.statusCode).toBe(409);

    const recv = await post(`/api/players/${p.id}/receive`, { mode: 'carry' });
    expect(recv.json().player.shipments).toHaveLength(0);
    expect(recv.json().player.pantry[recipe.ingredients[0]!.id]).toBe(2);

    const s1 = await post(`/api/players/${p.id}/serve`, {
      recipeId: recipe.id,
      quality: 1,
      customerType: 'local',
    });
    const r1: ServeResult = s1.json();
    expect(r1.pay).toBeGreaterThan(0);
    expect(r1.repDelta).toBe(1);
    expect(r1.stars).toBe(3);

    await post(`/api/players/${p.id}/serve`, { recipeId: recipe.id, quality: 0.5, customerType: 'student' });
    const s3 = await post(`/api/players/${p.id}/serve`, { recipeId: recipe.id, quality: 1 });
    expect(s3.statusCode).toBe(409);

    const notLearned = await post(`/api/players/${p.id}/serve`, { recipeId: 'pho_ga', quality: 1 });
    expect(notLearned.json().error).toMatch(/Chưa học/);

    const end: EndDayResult = (await post(`/api/players/${p.id}/end-day`)).json();
    expect(end.summary.served).toBe(2);
    expect(end.summary.dishes[recipe.id]).toBe(2);
    expect(end.player.day).toBe(2);
    expect(end.player.today.served).toBe(0);
    expect(end.player.totals.served).toBe(2);
  });

  it('gọi giao hàng: tính phí, nhận đúng đơn', async () => {
    const p = await newPlayer('pho');
    const buy = await post(`/api/players/${p.id}/buy`, {
      items: [{ id: 'thit_bo', qty: 10 }],
      mode: 'delivery',
    });
    const { spent, shipment, player } = buy.json();
    expect(shipment.mode).toBe('delivery');
    expect(shipment.fee).toBeGreaterThanOrEqual(5);
    expect(spent).toBe(300 - player.money);
    const recv = await post(`/api/players/${p.id}/receive`, { shipmentId: shipment.id });
    expect(recv.json().player.pantry.thit_bo).toBe(10);
    const again = await post(`/api/players/${p.id}/receive`, { shipmentId: shipment.id });
    expect(again.statusCode).toBe(404);
  });

  it('gánh quá sức thì bị từ chối; cuối ngày tự cất hàng', async () => {
    const p = await newPlayer('pho');
    const heavy = await post(`/api/players/${p.id}/buy`, { items: [{ id: 'hanh_la', qty: 21 }] });
    expect(heavy.json().error).toMatch(/Gánh không nổi/);
    await post(`/api/players/${p.id}/buy`, { items: [{ id: 'nuoc_mam', qty: 3 }] });
    const end: EndDayResult = (await post(`/api/players/${p.id}/end-day`)).json();
    expect(end.summary.autoStocked).toEqual([{ id: 'nuoc_mam', qty: 3 }]);
    expect(end.player.pantry.nuoc_mam).toBe(3);
  });

  it('đổi ngoại hình nhân vật', async () => {
    const res = await post('/api/players', {
      name: 'Anh Tư',
      shopId: 'hutieu',
      avatar: { skin: '#c68642', shirt: '#2a9d8f', hat: 'khan' },
    });
    const p: PlayerState = res.json();
    expect(p.avatar.hat).toBe('khan');
    const up = await post(`/api/players/${p.id}/avatar`, { skin: '#f1c27d', shirt: '#c0392b', hat: 'nonla' });
    expect(up.json().player.avatar).toEqual({ skin: '#f1c27d', shirt: '#c0392b', hat: 'nonla' });
    const bad = await post(`/api/players/${p.id}/avatar`, { skin: 'red', shirt: '#c0392b', hat: 'nonla' });
    expect(bad.statusCode).toBe(400);
  });

  it('hàng tươi hư một nửa sau đêm', async () => {
    const p = await newPlayer('caphe');
    await post(`/api/players/${p.id}/buy`, {
      items: [
        { id: 'trung_ga', qty: 4 },
        { id: 'ca_phe', qty: 4 },
      ],
    });
    await post(`/api/players/${p.id}/receive`, { mode: 'carry' });
    const end: EndDayResult = (await post(`/api/players/${p.id}/end-day`)).json();
    expect(end.player.pantry.trung_ga).toBe(2);
    expect(end.player.pantry.ca_phe).toBe(4);
    expect(end.summary.spoiled).toEqual([{ id: 'trung_ga', qty: 2 }]);
    expect(end.summary.autoStocked).toEqual([]);
  });
});

describe('kiểm tra dữ liệu & luật', () => {
  it('chợ bán nguyên liệu của cả 20 quán; không mua đồ lạ, không mua quá tiền', async () => {
    const p = await newPlayer('caphe');
    const market = (await app.inject(`/api/players/${p.id}/market`)).json();
    expect(market.items).toHaveLength(CATALOG.ingredients.length);
    const thitBo = market.items.find((i: { id: string }) => i.id === 'thit_bo');
    expect(thitBo.forMyShop).toBe(false);
    expect(thitBo.usedBy).toContain('Phở Gánh Đầu Ngõ');
    expect((await post(`/api/players/${p.id}/buy`, { items: [{ id: 'thit_bo', qty: 1 }] })).statusCode).toBe(
      200,
    );
    const unknown = await post(`/api/players/${p.id}/buy`, { items: [{ id: 'kim_cuong', qty: 1 }] });
    expect(unknown.statusCode).toBe(400);
    const tooMuch = await post(`/api/players/${p.id}/buy`, {
      items: [{ id: 'ca_phe', qty: 500 }],
      mode: 'delivery',
    });
    expect(tooMuch.json().error).toMatch(/Không đủ tiền/);
  });

  it('mua bàn ghế: có bộ khởi đầu, giới hạn số bàn, khách trả thêm tiền', async () => {
    const p = await newPlayer('pho');
    expect(p.furniture).toEqual({ ban_inox: 1 });
    const buy = await post(`/api/players/${p.id}/furniture`, { itemId: 'ban_inox' });
    expect(buy.json().player.furniture.ban_inox).toBe(2);
    expect(buy.json().player.money).toBe(300 - 120);
    const bad = await post(`/api/players/${p.id}/furniture`, { itemId: 'ban_vang' });
    expect(bad.statusCode).toBe(400);
    const poor = await post(`/api/players/${p.id}/furniture`, { itemId: 'ban_go' });
    expect(poor.json().error).toMatch(/Không đủ tiền/);
  });

  it('đồ quán xá theo kiểu quán: bộ khởi đầu riêng, không mua được đồ của kiểu khác', async () => {
    expect(shopMap.get('gom')?.interior).toBe('nghe');
    expect(shopMap.get('roinuoc')?.interior).toBe('sankhau');
    const gom = await newPlayer('gom');
    expect(gom.furniture).toEqual({ nghe_cho: 1 });
    const wrong = await post(`/api/players/${gom.id}/furniture`, { itemId: 'ban_inox' });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json().error).toMatch(/không hợp với/);
    const ok = await post(`/api/players/${gom.id}/furniture`, { itemId: 'nghe_cho' });
    expect(ok.json().player.furniture.nghe_cho).toBe(2);
    const show = await newPlayer('roinuoc');
    expect(show.furniture).toEqual({ sk_ghe_go: 1 });
    // mỗi kiểu quán đủ 7 vai, mỗi vai đúng một món
    for (const kind of ['an', 'nuoc', 'ghe', 'nghe', 'sankhau'] as const) {
      const roles = CATALOG.furniture.filter((f) => f.interior === kind).map((f) => f.role);
      expect(new Set(roles).size).toBe(7);
      expect(roles).toHaveLength(7);
    }
  });

  it('bản lưu cũ có đồ quán ăn ở xưởng gốm: tự đổi sang món cùng vai, giữ giới hạn chỗ', async () => {
    const p = await newPlayer('gom');
    await prisma.playerFurniture.deleteMany({ where: { playerId: p.id } });
    await prisma.playerFurniture.createMany({
      data: [
        { playerId: p.id, itemId: 'ban_inox', qty: 2 },
        { playerId: p.id, itemId: 'ban_go', qty: 3 },
        { playerId: p.id, itemId: 'quat_may', qty: 1 },
      ],
    });
    const res = await app.inject({ method: 'GET', url: `/api/players/${p.id}` });
    // chỗ sang giữ trước (3), chỗ thường còn 1 để không quá 4 cụm
    expect((res.json() as PlayerState).furniture).toEqual({ nghe_cho_sang: 3, nghe_cho: 1, nghe_quat: 1 });
  });

  it('thuê máy bay quảng cáo: mỗi ngày một gói, trừ tiền, sang ngày mới thì hết', async () => {
    const plans = CATALOG.adPlans;
    expect(plans.map((p) => p.id)).toEqual(['nho', 'vua', 'lon']);
    const p = await newPlayer('pho');
    expect(p.adPlan).toBeNull();
    const vua = plans.find((x) => x.id === 'vua')!;
    const ok = await post(`/api/players/${p.id}/ad`, { planId: 'vua' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().player.adPlan).toBe('vua');
    expect(ok.json().player.money).toBe(300 - vua.price);
    expect(ok.json().player.today.spent).toBe(vua.price);
    const again = await post(`/api/players/${p.id}/ad`, { planId: 'nho' });
    expect(again.statusCode).toBe(400);
    expect(again.json().error).toMatch(/đã thuê/);
    const unknown = await post(`/api/players/${p.id}/ad`, { planId: 'tau_vu_tru' });
    expect(unknown.statusCode).toBe(400);
    const next = await post(`/api/players/${p.id}/end-day`);
    expect((next.json() as EndDayResult).player.adPlan).toBeNull();
    // ngày mới: còn 180k, không đủ thuê gói lớn (200k) nhưng thuê lại được gói nhỏ
    expect((next.json() as EndDayResult).player.money).toBe(300 - vua.price);
    const poor = await post(`/api/players/${p.id}/ad`, { planId: 'lon' });
    expect(poor.json().error).toMatch(/Không đủ tiền/);
    const small = await post(`/api/players/${p.id}/ad`, { planId: 'nho' });
    expect(small.json().player.adPlan).toBe('nho');
  });

  it('sổ ghi chú: tạo, ghim (chỉ 1 trang), sửa, xóa', async () => {
    const p = await newPlayer('pho');
    const a = (
      await post(`/api/players/${p.id}/notes`, {
        title: 'Đi chợ sáng',
        items: [{ text: 'Thịt bò', ingredientId: 'thit_bo', qty: 5 }],
        pinned: true,
      })
    ).json();
    expect(a.items[0]).toMatchObject({ ingredientId: 'thit_bo', qty: 5, done: false });
    const b = (await post(`/api/players/${p.id}/notes`, { title: 'Ý tưởng món mới' })).json();
    const pinB = await app.inject({
      method: 'PATCH',
      url: `/api/players/${p.id}/notes/${b.id}`,
      payload: { pinned: true },
    });
    expect(pinB.json().pinned).toBe(true);
    const list = (await app.inject(`/api/players/${p.id}/notes`)).json();
    expect(list.filter((n: { pinned: boolean }) => n.pinned)).toHaveLength(1);
    const done = await app.inject({
      method: 'PATCH',
      url: `/api/players/${p.id}/notes/${a.id}`,
      payload: { items: [{ ...a.items[0], done: true }] },
    });
    expect(done.json().items[0].done).toBe(true);
    const del = await app.inject({ method: 'DELETE', url: `/api/players/${p.id}/notes/${a.id}` });
    expect(del.statusCode).toBe(200);
    expect((await app.inject(`/api/players/${p.id}/notes`)).json()).toHaveLength(1);
  });

  it('học món cần đủ danh tiếng; nâng cấp trừ tiền', async () => {
    const p = await newPlayer('gom');
    const learn = await post(`/api/players/${p.id}/learn`, { recipeId: 'chen_tra' });
    expect(learn.json().error).toMatch(/danh tiếng/);
    const up = await post(`/api/players/${p.id}/upgrade`, { type: 'shop' });
    expect(up.json().player).toMatchObject({ shopLevel: 2, money: 50 });
  });

  it('validate đầu vào', async () => {
    expect((await post('/api/players', { name: '', shopId: 'pho' })).statusCode).toBe(400);
    expect((await post('/api/players', { name: 'A', shopId: 'khong-co' })).statusCode).toBe(400);
    expect((await app.inject('/api/players/not-a-uuid')).statusCode).toBe(400);
    expect((await app.inject('/api/players/00000000-0000-4000-8000-000000000000')).statusCode).toBe(404);
  });

  it('bảng vàng', async () => {
    const res = await app.inject('/api/leaderboard?limit=3');
    expect(res.json().length).toBeLessThanOrEqual(3);
  });
});

describe('nhân viên', () => {
  it('thuê phục vụ & phụ bếp, giới hạn số lượng, món phụ bếp nấu bị giới hạn chất lượng', async () => {
    const p = await newPlayer('pho');
    const w1 = (await post(`/api/players/${p.id}/staff`, { role: 'waiter' })).json();
    expect(w1.player.staff).toHaveLength(1);
    expect(w1.player.money).toBe(300 - 40);
    await post(`/api/players/${p.id}/staff`, { role: 'waiter' });
    const w3 = await post(`/api/players/${p.id}/staff`, { role: 'waiter' });
    expect(w3.json().error).toMatch(/tối đa 2/);

    const recipe = shopMap.get('pho')!.recipes[0]!;
    await post(`/api/players/${p.id}/buy`, { items: recipe.ingredients.map((i) => ({ id: i.id, qty: 2 })) });
    await post(`/api/players/${p.id}/receive`, { mode: 'carry' });
    const noCook = await post(`/api/players/${p.id}/serve`, {
      recipeId: recipe.id,
      quality: 1,
      cookedBy: 'staff',
    });
    expect(noCook.json().error).toMatch(/phụ bếp/);
    await post(`/api/players/${p.id}/staff`, { role: 'cook' });
    const byCook = (
      await post(`/api/players/${p.id}/serve`, { recipeId: recipe.id, quality: 1, cookedBy: 'staff' })
    ).json();
    expect(byCook.stars).toBeLessThan(3);
  });

  it('cuối ngày trả lương; thiếu tiền thì nhân viên nghỉ; cho nghỉ việc', async () => {
    const p = await newPlayer('caphe');
    const hired = (await post(`/api/players/${p.id}/staff`, { role: 'cook' })).json().player;
    await post(`/api/players/${p.id}/staff`, { role: 'waiter' });
    const end: EndDayResult = (await post(`/api/players/${p.id}/end-day`)).json();
    expect(end.summary.wagesPaid).toBe(100);
    expect(end.player.money).toBe(300 - 60 - 40 - 100);

    const fire = await app.inject({
      method: 'DELETE',
      url: `/api/players/${p.id}/staff/${hired.staff[0].id}`,
    });
    expect(fire.json().player.staff.map((s: { role: string }) => s.role)).toEqual(['waiter']);

    // tiêu hết tiền rồi qua ngày: phục vụ nghỉ việc
    await post(`/api/players/${p.id}/buy`, { items: [{ id: 'ca_phe', qty: 19 }], mode: 'delivery' });
    const end2: EndDayResult = (await post(`/api/players/${p.id}/end-day`)).json();
    expect(end2.summary.staffQuit.map((s) => s.role)).toEqual(['waiter']);
    expect(end2.player.staff).toHaveLength(0);
  });
});

describe('đăng nhập Google & lưu theo tài khoản', () => {
  async function login(who: string) {
    const res = await post('/api/auth/google', { credential: `valid-token-${who}-xxxxxxxxxxxxxxxx` });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((c) => c.name === 'pdl_session');
    expect(cookie?.httpOnly).toBe(true);
    return { cookie: `pdl_session=${cookie!.value}`, user: res.json().user };
  }
  const as = (cookie: string, method: 'GET' | 'POST', url: string, payload?: object) =>
    app.inject({
      method,
      url,
      headers: { cookie },
      ...(method === 'POST' ? { payload: payload ?? {} } : {}),
    });

  it('cấu hình & token sai', async () => {
    expect((await app.inject('/api/auth/config')).json()).toEqual({ googleClientId: 'test-client-id' });
    expect(
      (await post('/api/auth/google', { credential: 'bad-token-xxxxxxxxxxxxxxxxxxxx' })).statusCode,
    ).toBe(401);
    expect((await app.inject('/api/auth/me')).json()).toEqual({ user: null });
  });

  it('quán tạo khi đăng nhập thuộc tài khoản, người khác không vào được', async () => {
    const a = await login('an');
    expect((await as(a.cookie, 'GET', '/api/auth/me')).json().user.email).toContain('an-');
    const created = await as(a.cookie, 'POST', '/api/players', { name: 'Chị An', shopId: 'pho' });
    const pid = created.json().id;
    const list = (await as(a.cookie, 'GET', '/api/me/players')).json();
    expect(list.map((p: { id: string }) => p.id)).toContain(pid);

    expect((await app.inject(`/api/players/${pid}`)).statusCode).toBe(403);
    const b = await login('binh');
    expect((await as(b.cookie, 'GET', `/api/players/${pid}`)).statusCode).toBe(403);
    expect((await as(a.cookie, 'GET', `/api/players/${pid}`)).statusCode).toBe(200);
  });

  it('gắn quán chơi khách vào tài khoản, đăng xuất thì mất phiên', async () => {
    const guest = await newPlayer('com');
    const c = await login('cuong');
    expect((await as(c.cookie, 'POST', `/api/me/claim/${guest.id}`)).statusCode).toBe(200);
    expect((await app.inject(`/api/players/${guest.id}`)).statusCode).toBe(403);
    const d = await login('dung');
    expect((await as(d.cookie, 'POST', `/api/me/claim/${guest.id}`)).statusCode).toBe(403);

    await as(c.cookie, 'POST', '/api/auth/logout');
    expect((await as(c.cookie, 'GET', '/api/auth/me')).json().user).toBeNull();
    expect((await as(c.cookie, 'GET', '/api/me/players')).statusCode).toBe(401);
  });
});
