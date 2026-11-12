# 🏮 Phố Đèn Lồng: Ba Miền Tụ Hội

Game kinh doanh nhẹ nhàng về một khu phố ăn uống, vui chơi và đồ lưu niệm Việt Nam.
Người chơi chọn **1 trong 20 quán** của 4 khu phố. Sáng ra **chợ đầu mối** mua nguyên liệu, tối nấu món **theo công thức riêng** của quán, đêm học món mới và nâng cấp quán.

## Cách chơi

| Phím                | Tác dụng                                          |
| ------------------- | ------------------------------------------------- |
| `←` `→` / `A` `D`   | Nhân vật đi lại (hoặc bấm chuột vào chỗ muốn tới) |
| `E` / `↑` / `Space` | Tương tác với nơi đang đứng gần                   |
| `Esc`               | Đóng bảng                                         |

- **Con phố:** đầu phố bên trái là **Chợ đầu mối**, ở giữa là quán của bạn (🏮 trên bản đồ nhỏ), hai bên là 5 quán hàng xóm ghé vào trò chuyện được.
- **Trong quán:** 🚪 cửa ra phố, 📦 kệ hàng (cất hàng / xem kho), 🔥 bếp và sổ công thức, 🛎️ quầy (mở cửa / phục vụ khách).
- **Mua hàng:** 🧺 _tự gánh về_ thì miễn phí nhưng giới hạn số phần, phải mang về cất lên kệ. 🛵 _gọi xe ba gác_ thì tốn phí, hàng tự lên kệ khi xe tới.
- **Bán hàng:** khách xếp hàng trước quán. Bạn phải đứng ở quầy mới phục vụ được. Đi chợ giữa giờ bán thì khách vẫn đợi, nhưng sẽ mất kiên nhẫn.

## Đăng nhập Google

Quán được lưu theo tài khoản Google. Chưa cấu hình thì game vẫn chơi được ở chế độ khách, quán lưu trên máy.

1. Vào [Google Cloud Console](https://console.cloud.google.com/apis/credentials), cấu hình **OAuth consent screen** (External, thêm email của bạn vào Test users).
2. **Create credentials → OAuth client ID → Web application**. Mục _Authorized JavaScript origins_ thêm `http://localhost:5173` và `http://localhost`.
3. Dán Client ID vào `apps/api/.env` ở dòng `GOOGLE_CLIENT_ID=...`, rồi chạy lại `npm run dev`.

Backend tự xác thực ID token với Google (`google-auth-library`), tạo phiên đăng nhập lưu trong CSDL và gửi về cookie httpOnly có ký. Quán đã gắn tài khoản thì chỉ chủ tài khoản truy cập được.

## Chợ đầu mối & sổ tay

- Chợ có 8 khu: rau củ, thịt & trứng, cá & hải sản, trái cây & nước đá, gạo bún bánh, đồ khô & gia vị, vải vóc & thủ công, đồ quán xá. Bán đủ nguyên liệu của cả 20 quán.
- Chọn hàng ở từng sạp cho vào **giỏ chợ**, rồi ra **quầy tính tiền** ở cổng chợ để chọn tự gánh hoặc gọi xe giao.
- **Sổ tay** (phím `N`): ghi danh sách đi chợ, tự lập danh sách từ công thức, ghim lên màn hình. Sạp có món trong ghi chú được đánh dấu 📌.
- **Đồ quán xá**: bàn inox, bàn gỗ (tối đa 4 bàn), quạt, cây cảnh, tranh, đèn lồng, loa nhạc. Mỗi món có hiệu ứng riêng.
- **7 kiểu trò chơi nấu món**: canh giờ, nhấn liên tục, nhớ hoa văn, rót/chan, thái/cắt, nướng/lật, theo nhịp. Mỗi quán có 3 kiểu khác nhau.

## Công nghệ

| Phần                           | Công nghệ                                                          |
| ------------------------------ | ------------------------------------------------------------------ |
| Frontend (`apps/web`)          | React 19, TypeScript, Vite 6, Zustand, Canvas 2D                   |
| Backend (`apps/api`)           | Node.js, Fastify 5, TypeScript, Prisma 6, SQLite, Zod              |
| Dùng chung (`packages/shared`) | Kiểu dữ liệu, dữ liệu 20 quán / 60 món / 87 nguyên liệu, luật chơi |
| Chất lượng                     | Vitest, ESLint (typescript-eslint), Prettier, npm workspaces       |

## Chạy lần đầu

Cần Node.js 20 trở lên.

```bash
npm run setup     # cài thư viện + tạo CSDL SQLite (apps/api/prisma/dev.db)
cp apps/api/.env.example apps/api/.env   # nếu chưa có file .env
npm run dev       # chạy API (:3000) và Web (:5173) cùng lúc
```

Sau đó mở **http://localhost:5173**. Vite tự chuyển các request `/api` sang backend.

## Lệnh hay dùng

| Lệnh                              | Tác dụng                                            |
| --------------------------------- | --------------------------------------------------- |
| `npm run dev`                     | Chạy API và Web ở chế độ phát triển (tự reload)     |
| `npm test`                        | Chạy test API (dùng CSDL test riêng)                |
| `npm run typecheck`               | Kiểm tra kiểu TypeScript cho cả 3 package           |
| `npm run lint` / `npm run format` | ESLint / Prettier                                   |
| `npm run build`                   | Build production (`apps/api/dist`, `apps/web/dist`) |
| `npm run db:studio -w @pdl/api`   | Mở Prisma Studio để xem dữ liệu                     |

## Cấu trúc

```
packages/shared/src/
  types.ts              Kiểu dữ liệu dùng chung FE/BE
  data/shops.ts         20 quán × 3 công thức  ← thêm/sửa quán, món ở đây
  data/ingredients.ts   Nguyên liệu ở chợ (giá, hàng tươi hay để lâu)
  rules.ts              Luật chơi & cân bằng kinh tế
  catalog.ts, logic.ts  Tính giá bán, số phần làm được, chấm sao…
apps/api/
  prisma/schema.prisma  Bảng Player, LearnedRecipe, PantryItem, DishSale, Shipment, ShipmentItem
  src/app.ts            Khởi tạo Fastify, CORS, xử lý lỗi
  src/routes/           Định tuyến + validate đầu vào bằng Zod
  src/services/         GameService: chợ, nấu món, kết thúc ngày, học món, nâng cấp
  test/                 Test API bằng Vitest + fastify.inject
apps/web/src/
  store/game.ts         Zustand store: toàn bộ luồng game
  game/World.ts         Engine canvas: phố dài + camera, chợ, trong quán, nhân vật, khách, xe giao hàng
  game/draw.ts          Vẽ nhân vật chủ quán (nón lá, quang gánh…)
  panels/               Bảng chợ, kệ hàng, sổ công thức, mở cửa, hàng xóm
  screens/              Tiêu đề, chọn quán, chợ, tổng kết đêm
  cooking/              Nấu món: chọn nguyên liệu, rồi canh giờ / nhấn liên tục / nhớ hoa văn
  api/client.ts         Gọi API có kiểu
```

## API

| Method | Đường dẫn                   | Mô tả                                       |
| ------ | --------------------------- | ------------------------------------------- |
| GET    | `/api/health`               | Kiểm tra server                             |
| GET    | `/api/catalog`              | Quán, công thức, nguyên liệu, luật chơi     |
| GET    | `/api/leaderboard?limit=10` | Bảng vàng                                   |
| POST   | `/api/players`              | Tạo người chơi `{name, shopId}`             |
| GET    | `/api/players/:id`          | Trạng thái người chơi                       |
| GET    | `/api/players/:id/market`   | Giá chợ hôm nay                             |
| POST   | `/api/players/:id/buy`      | Mua `{items:[{id, qty}]}`                   |
| POST   | `/api/players/:id/serve`    | Bán món `{recipeId, quality, customerType}` |
| POST   | `/api/players/:id/miss`     | Khách bỏ về                                 |
| POST   | `/api/players/:id/end-day`  | Đóng cửa, tổng kết, hàng tươi hư            |
| POST   | `/api/players/:id/learn`    | Học công thức `{recipeId}`                  |
| POST   | `/api/players/:id/upgrade`  | Nâng cấp `{type: "shop" \| "decor"}`        |

Server giữ quyền quyết định tiền, kho và danh tiếng. Client chỉ gửi điểm chất lượng món (0–1).

## Deploy

- Đổi `provider` trong `apps/api/prisma/schema.prisma` sang `postgresql` và đặt `DATABASE_URL`.
- `npm run build`, chạy API bằng `npm start -w @pdl/api`, phục vụ `apps/web/dist` qua CDN hoặc Nginx.
- Nếu Web và API khác domain: build Web với `VITE_API_BASE=https://api.example.com/api` và đặt `CORS_ORIGIN` cho API.
