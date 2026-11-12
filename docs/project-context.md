# Phố Đèn Lồng · Tổng hợp context dự án

> Cập nhật 2026-11-13. Đây là bản tóm tắt để người (hoặc agent) mới vào nắm nhanh dự án đang ở đâu.
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

Chạy: `npm run setup`, `cp apps/api/.env.example apps/api/.env`, `npm run dev` → http://localhost:5173.

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
