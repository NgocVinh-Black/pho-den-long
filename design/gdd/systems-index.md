# Systems Index — Phố Đèn Lồng

> Reverse-documented 2026-11-12 từ `apps/` và `packages/shared/`. Mọi GDD dưới đây có banner provenance.
> Tier dự án: `workflow: minimal`. Người dùng yêu cầu thêm GDD đầy đủ cho từng hệ thống.

| # | Hệ thống | GDD | Tầng | Code chính | Trạng thái |
|---|---|---|---|---|---|
| 1 | Vòng ngày | [day-cycle.md](day-cycle.md) | Foundation | `World.ts` (update), `store/game.ts` (openShop/endDay), `game.service.ts#endDay` | Đã làm |
| 2 | Kinh tế & giá | [economy.md](economy.md) | Foundation | `rules.ts`, `catalog.ts`, `game.service.ts#serve/marketPrice` | Đã làm |
| 3 | Chợ đầu mối & giao hàng | [market-shipping.md](market-shipping.md) | Core | `data/market.ts`, `data/ingredients.ts`, `MarketPanels.tsx`, `game.service.ts#buy/receive` | Đã làm |
| 4 | Nấu món | [cooking.md](cooking.md) | Core | `cooking/*` | Đã làm |
| 5 | Phục vụ & khách | [dine-service.md](dine-service.md) | Core | `game/service.ts`, `store/game.ts#makeCustomer/spawnInterval` | Đã làm |
| 6 | Tiến trình (danh tiếng, học món, nâng cấp) | [progression.md](progression.md) | Feature | `game.service.ts#learn/upgrade`, `NightScreen.tsx` | Đã làm |
| 7 | Nhân viên | [staff.md](staff.md) | Feature | `rules.ts#STAFF_ROLES`, `service.ts#updateStaff` | Đã làm |
| 8 | Đồ quán xá | [furniture.md](furniture.md) | Feature | `data/furniture.ts`, `logic.ts#furnitureEffects` | Đã làm |
| 9 | Sổ tay đi chợ | [notebook.md](notebook.md) | Feature | `NotebookPanel.tsx`, `game.service.ts#*Note` | Đã làm |
| 10 | Tài khoản, lưu trữ & bảng vàng | [accounts-save.md](accounts-save.md) | Foundation | `auth.service.ts`, `routes/auth.ts`, `schema.prisma` | Đã làm |
| 10b | Máy bay băng rôn (quảng cáo & tin chợ) | [ads.md](ads.md) | Feature | `data/ads.ts`, `World.ts#updatePlanes`, `game.service.ts#buyAd` | Đã làm 2026-11-12 |
| 10c | Màn hình toàn phần, responsive | — (ghi chú trong [ads.md](ads.md) phần Acceptance) | Presentation | `World.ts#resize`, `WorldCanvas.tsx`, `global.css` | Đã làm 2026-11-12 |
| 11 | Cốt truyện & hàng xóm | [brief](../narrative/pho-den-long-brief.md) · [hàng xóm](../narrative/lore/neighbors.md) · [thoại](../narrative/dialogue/neighbors.md) · [thư bà nội](../narrative/dialogue/ba-noi.md) | Presentation | `SimplePanels.tsx#NeighborPanel` (mới có 8 câu mẹo cũ) | Thiết kế xong 2026-11-12, chưa đưa vào game |
| 12 | Nhiều người chơi trên một phố | — | Feature | — | Hướng tương lai, chưa thiết kế |

## Phụ thuộc

```
accounts-save ─┐
economy ───────┼─> market-shipping ─> cooking ─> dine-service ─> day-cycle
               │                                   ↑      ↑
               └─> progression ─────────────────────┘      │
                   furniture ──────────────────────────────┤
                   staff ──────────────────────────────────┘
notebook ─> market-shipping (đánh dấu sạp)
```
