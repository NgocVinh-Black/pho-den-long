---
status: designed-and-implemented
source: packages/shared/src/data/ads.ts, apps/web/src/game/World.ts, apps/web/src/store/game.ts, apps/api/src/services/game.service.ts
date: 2026-11-12
verified-by: chủ dự án (chọn phương án ngày 2026-11-12)
---

# Máy bay băng rôn: quảng cáo & thông báo (Sky Banners)

> Thiết kế được chủ dự án chọn ngày 2026-11-12 ("3 gói theo ngày"; máy bay thông báo chở
> quảng cáo hàng xóm và tin chợ), triển khai cùng ngày. Đây là tài liệu thiết kế viết trước code,
> **không** phải reverse-document.

## 1. Overview

Trên trời con phố có máy bay nhỏ kéo băng rôn bay ngang. Có ba loại:
- **Quảng cáo của quán mình:** người chơi thuê theo gói mỗi ngày, có tác dụng tăng khách.
- **Quảng cáo của quán hàng xóm:** chỉ trang trí.
- **Tin chợ:** món giảm hoặc tăng giá mạnh hôm nay, và lời rao của các khu chợ. Chỉ trang trí, nhưng có ích cho việc đi chợ.

## 2. Player Fantasy

Bỏ tiền thuê máy bay kéo băng rôn tên quán mình qua cả phố, rồi thấy khách kéo tới đông hơn. Bầu trời phố đêm lúc nào cũng nhộn nhịp quảng cáo.

## 3. Detailed Rules

**Thuê quảng cáo**
- Thuê ở bảng **Mở cửa** (quầy trong quán), trước khi lên đèn. Mỗi ngày tối đa **một gói**. Không hoàn tiền.
- Gói thuê có tác dụng tới hết ngày; cuối ngày (`end-day`) gói bị xoá.
- Server trừ tiền ngay và cộng vào chi phí trong ngày (`todaySpent`).

| Gói | Giá | Khách ghé thêm | Số vòng bay | Khách Tây |
|---|---|---|---|---|
| Máy bay nhỏ 🛩️ | 60k | +15% | 2 | ×1 |
| Máy bay vừa ✈️ | 120k | +30% | 4 | ×1 |
| Máy bay lớn 🛫 | 200k | +50% | 6 | ×2 trọng số |

**Bay quảng cáo của mình:** vòng thứ k (k = 0..n−1) cất cánh lúc `t = dayLen × 0.9 × (k + 0.25) / n` trong giờ bán. Bay ở độ cao logic y = 52, băng rôn vàng viền đỏ, ghi "{icon} {tên quán} · {một món đã học} · Ghé ngay!". Nếu người chơi đang ở trong quán hoặc ở chợ thì hiện thông báo "✈️ Máy bay quảng cáo của quán đang bay qua phố!".

**Máy bay trang trí:** chỉ bay vào buổi sáng và giờ bán, mỗi chiếc cách nhau 25–40 giây. Nếu đã có một máy bay trang trí trên trời thì bỏ lượt. Mỗi lượt 50% là tin chợ (nếu có) và 50% là quảng cáo hàng xóm. Bay ở độ cao y = 22–28, cao hơn quảng cáo của mình.
- **Tin chợ:** tối đa 3 món giảm giá mạnh nhất (≥ 10% so với giá gốc) và 1 món lên giá mạnh nhất, cùng lời rao của 8 khu chợ. Các câu được xoay vòng.
- **Quảng cáo hàng xóm:** ngẫu nhiên một quán khác và một món của quán đó, ghép vào 4 mẫu khẩu hiệu.

**Hiển thị:** máy bay chỉ vẽ ở cảnh phố, phía trên dây đèn lồng. Trời cuộn chậm hơn phố (hệ số 0.2 theo camera). Ban đêm băng rôn sáng nhẹ và đuôi máy bay có đèn đỏ nhấp nháy.

## 4. Formulas

- `spawnInterval = max(1.6, 5.6 × priceFactor / (boost × traffic × ad))`, với `ad = 1 + plan.traffic` (không thuê thì `ad = 1`). Các biến khác giữ nguyên như [dine-service](dine-service.md).
- `weight(tourist) × plan.touristMul` khi chọn loại khách.
- `due_k = dayLen × 0.9 × (k + 0.25) / flights`

Ví dụ: gói Vừa ở quán đang có khoảng cách giữa hai lượt khách là 4.0 giây → 4.0 / 1.3 ≈ 3.08 giây.

## 5. Edge Cases

- Thuê lần hai trong ngày bị từ chối: "Hôm nay đã thuê máy bay quảng cáo rồi".
- Không đủ tiền thì bị từ chối; nút gói đó bị mờ trong bảng.
- Thuê xong rồi mở cửa: hệ số khách được tính lúc mở cửa. Không thể thuê giữa giờ bán, vì bảng Mở cửa chỉ mở được buổi sáng.
- Khoảng cách giữa hai lượt khách không dưới 1.6 giây, nên quảng cáo không tăng khách vô hạn ở quán đã rất đông.
- Chưa tải được giá chợ: máy bay tin chợ chỉ chở lời rao của các khu.
- **Rủi ro cân bằng:** gói Nhỏ 60k cho +15% khách. Ở quán có lãi mỗi khách thấp, gói có thể lỗ. Đó là quyết định của người chơi; cần `/balance-check` xem gói nào luôn có lời.

## 6. Dependencies

[dine-service](dine-service.md) (nhịp khách, loại khách), [economy](economy.md) (tiền), [day-cycle](day-cycle.md) (xoá gói cuối ngày), [market-shipping](market-shipping.md) (tin giá chợ). Tương lai, chế độ nhiều người chơi: máy bay "hàng xóm" sẽ là quảng cáo thật của người chơi khác.

## 7. Tuning Knobs

`AD_PLANS` trong `packages/shared/src/data/ads.ts` (giá, traffic, flights, touristMul) · `AMBIENT_PLANE_GAP` [25, 40] · `PLANE_Y_OWN` 52 · `PLANE_Y_AMBIENT` [22, 28] · `PLANE_PARALLAX` 0.2 · ngưỡng tin chợ 10% · `NEIGHBOR_SLOGANS` (trong `World.ts`).

## 8. Acceptance Criteria

- `POST /api/players/:id/ad {planId:'vua'}` → tiền −120, `adPlan = 'vua'`; gọi lần hai → 400. Sang ngày mới → `adPlan = null`. (Test tự động: `apps/api/test/api.test.ts`.)
- Thuê gói n vòng → đúng n máy bay quảng cáo của quán bay trong giờ bán.
- Băng rôn không đè lên dây đèn lồng ở 1600×900, 2560×1080 và điện thoại ngang. (Ảnh bằng chứng: `production/qa/evidence/planes-street-*.png`, `ads-open-panel-1600x900.png`.)
