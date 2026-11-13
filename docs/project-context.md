# Phố Đèn Lồng · Tổng hợp context dự án

> Cập nhật 2026-11-13 (thêm bản Godot góc nhìn thứ ba). Đây là bản tóm tắt để người (hoặc agent) mới vào nắm nhanh dự án đang ở đâu.
> Nguồn sự thật vẫn là code và các tài liệu trong `design/`.

## Game là gì

Game kinh doanh nhẹ nhàng trên trình duyệt. Người chơi làm chủ 1 trong 20 quán (ăn uống, lưu niệm, vui chơi) của ba miền trên một con phố đêm. Sáng ra chợ đầu mối mua nguyên liệu, tối nấu món qua trò chơi nhỏ và phục vụ khách tại chỗ, đêm học món mới và nâng cấp quán. Chơi vô tận, đua bảng vàng; hướng tương lai là nhiều người chơi trên một phố, mỗi người một quán.

## Công nghệ

| Phần | Công nghệ |
|---|---|
| `apps/web` | React 19, TypeScript, Vite 6, Zustand, Canvas 2D |
| `apps/api` | Node.js, Fastify 5, Prisma 6 (SQLite khi dev), Zod, đăng nhập Google |
| `packages/shared` | Kiểu dữ liệu, dữ liệu 20 quán / 60 món / 80 nguyên liệu, luật chơi |
| Kiểm tra | Vitest (API), ESLint, Prettier, `npm run typecheck` |
| `godot/` | **Bản thử 3D góc nhìn thứ ba**: Godot 4.7.2 (Forward+), GDScript; mô hình và cảnh dựng bằng Blender 5.2 |
| `tools/blender/` | Script Blender chạy không giao diện: dựng mô hình, góc phố, render sprite, ảnh chân dung |

Chạy bản web: `npm run setup`, `cp apps/api/.env.example apps/api/.env`, `npm run dev` → http://localhost:5173.
Chạy bản Godot: `godot --path godot` (chi tiết trong `godot/README.md`).

## Bản Godot góc nhìn thứ ba (nhánh `art/concept-goc-nhin-3-4`)

Chủ dự án muốn chuyển đồ hoạ sang **3D góc nhìn thứ ba, phong cách chibi hoạt hình phố Việt** (sáng, nét viền).
Hướng đã thử theo thứ tự: chibi nhìn từ trên → isometric → 2.5D kiểu Nobody → tranh nền vẽ sẵn (`corner`) →
**cảnh 3D đầy đủ góc nhìn thứ ba (`street3p`, hiện là cảnh chính)**. Các cảnh cũ (`main`, `town`, `corner`) còn giữ để tham khảo.

| Phần | Nơi |
|---|---|
| Cảnh chính | `godot/scenes/street3p.tscn` + `scripts/street3p.gd` (camera, va chạm trượt, tương tác E, khách, chợ, việc vặt) |
| Nội thất 18 quán | `scripts/interior.gd` (phòng 14×10 m, lối giữa 3 m, theo nghề) |
| Giao diện | `scripts/hud_game.gd` (thẻ nhân vật, 5 nút có bảng, hộp thoại, bản đồ, "Việc cần làm") |
| Logic tiền / nấu / đồng hồ | `scripts/game_state.gd` (không chạm cảnh, có test) |
| Nhân vật | `scripts/chibi.gd` (đi, ngồi, bưng, **ăn bằng đũa**, **nhảy**) |
| Số liệu chơi | `godot/data/gameplay.json` (giá + công thức phở lấy từ `packages/shared`) |
| Cảnh 3D | `tools/blender/build_corner.py --export3d` → `godot/assets/scenes/corner/scene_full.glb`, `scene3d.json` |

Vòng chơi: chợ mua nguyên liệu → quán **Phở Gánh** (quán của người chơi, dãy phố trái) nhận order → bếp nấu →
bưng ra → khách ăn, trả tiền (+bo, +uy tín). Phụ: nói chuyện / việc vặt với người đi đường có dấu **!**, ăn uống
và dịch vụ ở 17 quán khác, đồng hồ ngày–đêm, thể lực.

Quyết định đã chốt với chủ dự án: giữ ngã tư hiện tại nhưng nới chỗ chật; đủ 4 tương tác (quán phở, chợ, nói chuyện,
ăn ở quán khác); phím E tương tác, Space nhảy, phím 1–9 chọn trong bảng; phím đọc theo vị trí vật lý để không bị
bộ gõ tiếng Việt chặn.

Kiểm thử (đều qua):

```bash
godot --headless --path godot -s res://tests/unit/game_state_economy_test.gd      # 15 phép
godot --headless --path godot -s res://tests/integration/pho_shop_loop_test.gd    # 12 bước vòng quán phở + va chạm
godot --headless --path godot -s res://tests/integration/input_controls_test.gd   # 15 bước giả lập phím/chuột
```

Chưa cài gdUnit4: test là script `SceneTree` tự chạy, chưa đúng chuẩn đặt tên `test_*` của `.claude/rules/test-standards.md`.
Sau khi đổi `scene_full.glb` phải chạy `godot --headless --path godot --import`, nếu không game dùng bản cũ trong cache.

Chủ dự án báo "không bấm được gì" ở bản trước; giả lập không tái hiện được, đã làm vòng tương tác rộng hơn,
click ô nhắc thay E, phím số trong bảng, dòng "Việc cần làm". **Chưa được chủ dự án xác nhận trên máy thật.**

## Tài liệu

| Nơi | Nội dung |
|---|---|
| `design/game-brief.md` | Tổng quan, trụ cột, phạm vi, rủi ro |
| `design/gdd/systems-index.md` | Danh sách hệ thống + phụ thuộc |
| `design/gdd/*.md` | GDD từng hệ thống (vòng ngày, kinh tế, chợ, nấu, phục vụ, tiến trình, nhân viên, nội thất, sổ tay, tài khoản, quảng cáo) |
| `design/narrative/` | Cốt truyện: brief, 20 hàng xóm, lời thoại, thư bà nội |
| `production/narrative/pho-den-long/` | Bản nháp cốt truyện của writer |
| `production/qa/evidence/` | Ảnh chụp bằng chứng giao diện |

Phần lớn GDD được **viết ngược từ code** (`/reverse-document`): chúng ghi lại code đang làm gì; chỗ ghi `INTENT UNKNOWN` là ý đồ chưa được xác nhận.

## Quyết định thiết kế đã chốt (với chủ dự án)

- Cốt truyện **nhẹ nhàng, không tuyến tính**, không phản diện, không kết thúc. Bà nội chỉ xuất hiện qua thư.
- Quy tắc **"giữ quầy"**: quán nào có người chơi nhận thì chủ quán NPC "về quê nghỉ một mùa" (an toàn cho chế độ nhiều người).
- Xưng hô với người chơi theo tuổi người nói (con/cháu, em/bạn/mình).
- Phụ bếp **cố ý** không bao giờ đạt 3 sao.
- **Dây đèn lồng** (thắp sáng con phố) và **chùm đèn lồng trần** (trang trí trong quán) là hai thứ khác nhau, cố ý.
- **Toàn màn hình responsive**: chiều cao logic 540, bề rộng logic theo tỉ lệ màn hình (720–1500).
- **Máy bay băng rôn**: thuê quảng cáo 3 gói theo ngày (60k/+15%, 120k/+30%, 200k/+50% và khách Tây ×2); máy bay trang trí chở quảng cáo hàng xóm và tin chợ.
- **5 kiểu bên trong quán**: quán ăn, quán nước & chè, ghe nổi, xưởng nghề & tiệm quà, sân khấu. Hình và chữ theo nghề; vòng chơi nhận → làm → mang ra giữ nguyên.
- **Đồ quán xá danh mục riêng từng kiểu quán**, mỗi kiểu 7 món theo 7 vai; bản lưu cũ tự chuyển 1:1.
- **Xe buýt**: 5 trạm (chợ + cổng 4 khu), **miễn phí**.

## Trạng thái

| Hạng mục | Trạng thái |
|---|---|
| Vòng chơi chính, chợ, nấu 7 kiểu, phục vụ, nhân viên, nội thất, sổ tay, đăng nhập | Đã làm |
| Toàn màn hình + máy bay quảng cáo | Đã làm, có test và ảnh bằng chứng |
| 5 kiểu bên trong quán + đồ quán xá riêng | Đã làm, có test; **chưa chạy game để chụp ảnh kiểm tra** |
| Xe buýt | **Chưa làm** (cờ gợi ý `farFromMarket` / `farFromShop` trong `World.ts` đang tắt) |
| Đưa lời thoại hàng xóm + thư bà nội vào game | Chưa làm (game vẫn dùng 8 câu mẹo cũ) |
| GDD `interiors.md`, `bus.md`; cập nhật `furniture.md` | Chưa viết |
| Bản Godot góc nhìn thứ ba: phố, 18 nội thất, vòng quán phở, chợ, việc vặt, HUD, ăn, nhảy | Đã làm, có test và ảnh `production/qa/evidence/godot-3p-*` |
| Godot: mini-game nấu như bản web, âm thanh, lưu tiến trình, khách né nhau | Chưa làm |
| `project.yaml` chưa ghi engine (web hay Godot) | Chưa quyết |

## Việc tiếp theo (theo thứ tự)

1. Làm xe buýt: trạm + xe + bảng chọn trạm + đi xe (`World.ts`, `store/game.ts`, `PanelHost`), rồi bật cờ gợi ý.
2. Chạy game, chụp bên trong 5 kiểu quán và xe buýt vào `production/qa/evidence/`.
3. Viết GDD `interiors.md`, `bus.md`; cập nhật `furniture.md`, `systems-index.md`.
4. `/balance-check` cho gói quảng cáo và danh mục đồ quán xá mới.
5. Đưa lời thoại và thư bà nội vào game.

## Rủi ro đã biết

- Server tin điểm chất lượng món do client gửi lên, nên có thể gian lận (cần sửa trước khi chơi nhiều người).
- Gọi API `end-day` liên tục là tua ngày được.
- Quán chơi khách không có bảo vệ truy cập (ai biết mã quán là vào được).
- README ghi 87 nguyên liệu, code có 80.
