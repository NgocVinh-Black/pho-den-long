# Phố Đèn Lồng — bản thử Godot

## Cảnh chính: `street3p` (góc nhìn thứ ba)

Góc phố dựng trong Blender (`tools/blender/build_corner.py --export3d`) được xuất nguyên thành cảnh 3D có màu (`scene_full.glb`),
hiển thị thật trong Godot với tô bóng hai tông và viền mực. Camera đi sau lưng nhân vật (SpringArm, không xuyên tường).

Điều khiển: WASD đi, Shift chạy, **Space** nhảy, **E** tương tác, giữ chuột phải để xoay camera (hoặc Q/R), lăn chuột gần/xa,
F món ăn, Tab túi đồ, J sổ tay, M bản đồ, Esc cài đặt / đóng bảng, H ẩn hướng dẫn, N ngày/đêm.

**Vòng chơi** (số liệu trong `data/gameplay.json`, giá và công thức lấy từ `packages/shared`):
1. **Chợ** (bên phải ngã tư): đứng cạnh người bán, bấm E mở sạp (bánh phở / thịt / rau / đồ khô), mua 1 hoặc 5 phần.
2. **Quán Phở Gánh** (dãy phố trái, vòng đỏ, biển "★ Quán của bạn"): khách tự vào ngồi, có "! Gọi món" → E nhận order.
3. **Bếp**: E chọn món (phở bò tái, phở gà, phở cuốn), thiếu nguyên liệu thì báo thiếu gì; nấu xong nhân vật bưng bát.
4. **Bưng ra** đúng khách → khách ăn rồi trả tiền (+bo nếu phục vụ nhanh, +uy tín). Chờ quá lâu khách bỏ về (−uy tín).
5. **Người đi đường**: E để nói chuyện; người có dấu **!** nhờ mang đồ tới một quán (hiện trên bản đồ), giao xong được thưởng.
6. **Quán khác**: ngồi vào ghế trống hoặc tới quầy để ăn uống / dùng dịch vụ (hồi thể lực, máu; nhà nghỉ ngủ tới sáng).
Khách (và người ngồi quán, vỉa hè) có động tác ăn: cầm đũa gắp từ bát, đưa lên miệng, nhai (`Chibi.set_eating`).
Đi lại hao thể lực (chạy hao gấp 2,5); mệt thì đi chậm, không nhảy được. Đồng hồ chạy, tối tự bật đèn lồng.

**Dễ bấm:** phím đọc theo vị trí vật lý (không bị bộ gõ tiếng Việt chặn), vòng tương tác rộng, người đi đường đứng lại khi
mình tới gần; click vào ô nhắc [E] thay cho phím E; trong bảng bấm phím **1–9** thay cho chuột.
Ô **"Việc cần làm"** góc trên trái luôn chỉ bước tiếp theo.

**Va chạm** kiểu trượt (vòng tròn đẩy khỏi khối chữ nhật, góc bo tròn) nên đi sát tường, góc bàn không bị kẹt.
**Nội thất** (`scripts/interior.gd`): phòng 14 × 10 m, lối giữa rộng 3 m từ cửa tới quầy, bàn ghế dạt hai bên;
không tường trước, camera trong phòng luôn ở phía cửa nhìn vào.

Giao diện `scripts/hud_game.gd`: neo theo góc, co giãn theo màn hình, các khối không chồng nhau; bảng giữa màn hình
(chợ, thực đơn, bếp, túi đồ, sổ tay, bản đồ, cài đặt) và hộp thoại người đi đường. Chữ MSDF, biểu tượng SVG.

Kiểm thử:

```bash
godot --headless --path godot -s res://tests/unit/game_state_economy_test.gd     # tiền, nấu, mua, đồng hồ
godot --headless --path godot -s res://tests/integration/pho_shop_loop_test.gd   # cả vòng quán phở + va chạm
godot --headless --path godot -s res://tests/integration/input_controls_test.gd  # giả lập phím/chuột: đi, nhảy, vào quán, việc vặt, mua
```

Chụp kiểm tra: `godot --path godot -- --shot=x.png [--own|--serve|--eat|--jump|--enter=CAFE|--panel=map|--talk|--night] [--frame=N]`.

```bash
blender -b -P tools/blender/build_corner.py -- godot/assets/models godot/assets/scenes/corner --export3d
blender -b -P tools/blender/render_portrait.py -- godot/assets/models /tmp/pdl-sprites godot/assets/ui/portrait.png
godot --headless --path godot --import
```

Giao diện `scripts/hud_game.gd`: chữ MSDF (nét ở mọi độ phân giải), biểu tượng SVG trong `assets/ui/`, ảnh chân dung render từ Blender.

---


## Cảnh chính: `corner` (tranh nền vẽ sẵn, kiểu Nobody)

Cả góc phố được dựng trong Blender rồi render thành **một bức tranh nền** (nét mực vẽ tay, vết ố, màu trầm ấm, bản ngày và đêm)
bằng camera phối cảnh nhìn chéo vào ngã tư. Godot đặt camera **đúng vị trí, góc của camera Blender** và chiếu tranh lên khối che
(`proxy.glb`), nên **nhân vật chibi và xe máy 3D** đi ra sau nhà, cột điện thì bị che đúng chỗ. Mỗi khu là một khung hình cố định.

Dựng và render lại góc phố (khoảng 3 phút):

```bash
blender -b -P tools/blender/build_corner.py -- godot/assets/models godot/assets/scenes/corner
godot --headless --path godot --import
```

Bố cục (dãy quán, biển hiệu, bàn ghế, cột điện, dây đèn lồng, sạp chợ, camera) nằm trong `tools/blender/build_corner.py`;
chỗ ngồi, khu đi bộ, làn xe, chân nhà được ghi ra `assets/scenes/corner/scene.json` cho `scripts/corner.gd`.
Giao diện: `scripts/hud_street.gd` (chân dung tròn, thanh máu đỏ, ba nút vuông).

Hai cảnh thử trước vẫn giữ: `scenes/town.tscn` (ảnh 2D rời từng nhà) và `scenes/main.tscn` (3D toàn phần).

---


## Cảnh chính: `town` (2.5D)

Nhà cửa, cây cối và đồ vỉa hè là **ảnh 2D** render từ Blender (`tools/blender/render_sprites.py`): viền nét, bóng đổ, có bản ngày và bản đêm.
Chỉ **nhân vật chibi và xe máy là 3D**. Camera trực giao nhìn cao 50°, mọi mặt tiền quay về người xem.
Đường **uốn lượn**: phố chính và phố trước lượn sóng, hai đường ngang cong nối thành vòng, hẻm uốn khúc. Nhà xếp so le theo mép đường.
Xe máy chạy theo làn đường cong (có xe chạy vòng quanh khu), người đi bộ đi dọc vỉa hè.
Nhà nào che người chơi thì mờ đi; trong quán mở thì lớp mái hiên/tầng trên mờ để thấy người bên trong.

Render lại ảnh 2D (mất khoảng 8 phút cho cả bộ; ghi thêm tên để render riêng vài ảnh):

```bash
blender -b -P tools/blender/render_sprites.py -- godot/assets/models godot/assets/sprites [h_pho s_cafe …]
godot --headless --path godot --import
```

Góc camera `PITCH` trong script render phải khớp `CAM_PITCH` trong `scripts/town.gd`.

Cảnh 3D cũ (`scenes/main.tscn`) vẫn giữ để so sánh: `godot --path godot scenes/main.tscn`.

---

## Cảnh cũ: phố 3D

Đây là đoạn phố mẫu để duyệt đồ hoạ trước khi chuyển cả game sang Godot. Đồ hoạ: camera nhìn thẳng từ phía trước, cao khoảng 36°, mọi nhà và cửa quay ra người xem; nhà có vân vữa, cột trụ, vòm cửa sổ, hộp hoa, mái ngói từng hàng như tiểu cảnh; bóng mềm ở góc khuất (SSAO), mờ xa gần như chụp mô hình thu nhỏ, nhân vật chibi, tô bóng kiểu hoạt hình, có ngày và đêm (mặc định là ban ngày, `--night` để chụp ban đêm).
Bản này chưa có lối chơi (chợ, nấu món, gọi món, server). Những phần đó vẫn nằm trong `apps/` (React + Canvas).

- Engine: **Godot 4.7.2** (Forward+)
- Mô hình 3D: **Blender 5.2.3**, dựng bằng script nên chạy lại là ra y hệt

## Chạy

```bash
godot --path godot
```

Phím: `WASD` hoặc phím mũi tên để đi, bấm chuột trái để đi tới chỗ đó, `N` đổi ngày/đêm, lăn chuột để phóng to/thu nhỏ.

Chụp màn hình không cần bấm gì: `godot --path godot -- --shot=screenshots/x.png [--day] [--at=x,z] [--zoom=13]`

## Dựng lại mô hình từ Blender

```bash
blender -b -P tools/blender/build_assets.py -- godot/assets/models
godot --headless --path godot --import
```

Tên vật liệu trong Blender (`Shirt`, `Facade`, `Awning`, `LanternSilk`, `BikeBody`…) là khoá để Godot đổi màu từng bản sao, xem `Toon.recolor`.

## Trong đoạn phố có gì

Một dãy phố dài khoảng 80 m, mọi mặt tiền quay ra camera. Từ tây sang đông:

Tạp hóa Cô Ba · **Xưởng Gốm Bát Tràng** (vào được) · Sửa xe máy · Cắt tóc nam · Nhà thuốc Bình An · **Phở Gánh Đầu Ngõ** (vào được) · **Hẻm 12** · **Đồn công an phường** · **Cà Phê Trứng Gác Mái** (vào được) · **Bún Chả Than Hồng** (vào được) · Hoa tươi · Điện thoại · Sim · **Chè Ba Miền** (vào được) · Tiệm vàng Kim Phát · Gạo ngon miền Tây.

- Vỉa hè trước nhà: dù, biển đứng chữ A, chậu cây, thùng hàng, bàn ghế nhựa, xe giao hàng, cột loa phường.
- Phía gần camera không có nhà, chỉ có xe hàng rong, trạm xe buýt, quảng trường cây đa (ghế đá, cờ tướng) và xe máy đỗ.
- Khoảng 36 người đi bộ và 16 xe máy chạy.

**Hạ tường:** nhà hoặc tường nào nằm giữa camera và người chơi sẽ tự hạ thấp hoặc ẩn đi. Khi vào quán mở mặt tiền, tầng trên của quán cũng ẩn. Xem `update_occluders` trong `scripts/main.gd`.

## Tệp

- `scripts/main.gd`: dựng khu phố, camera, ánh sáng, người đi lại, xe máy, HUD
- `scripts/chibi.gd`: nhân vật (đổi màu, nón/mũ, đi, ngồi, chớp mắt, vẫy tay)
- `scripts/toon.gd`: chuyển vật liệu sang kiểu toon và vẽ viền
- `shaders/spatial_env_street.gdshader`: mặt đường, vỉa hè, hẻm, sân
- `assets/models/*.glb`: 54 mô hình xuất từ Blender
