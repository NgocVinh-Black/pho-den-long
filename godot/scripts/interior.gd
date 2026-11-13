class_name Interior
extends RefCounted
## Dựng bên trong một quán (phòng 14 × 10 m) theo nghề của quán. Bố cục luôn chừa lối giữa rộng 3 m từ cửa
## tới quầy, bàn ghế dạt hai bên, lối giữa các bàn ≥ 1,6 m để không bị kẹt. Không có tường trước và trần
## (kiểu cắt ngang) để camera góc nhìn thứ ba nhìn thẳng vào phòng.
##
## Toạ độ phòng: cửa ở z = 0 (mép trước), phòng lùi về -z; x = 0 là giữa phòng.

const M := "res://assets/models/"
const W := 14.0
const D := 10.0
const H := 2.6
## Hai cột bàn ở x = ±TX, hai hàng ở z = ROWS
const TX := 4.0
const ROWS := [-3.6, -6.6]

const FLOOR := {"cafe": "6b4228", "che": "b87878", "bia": "7a5a3a", "food": "9a6232", "pho": "8a5a32", "hair": "8a8278",
	"grocery": "8a7250", "pharma": "9a9480", "bike": "5d5a56", "phone": "7d7668", "flower": "6f8a5a", "inn": "8a5a3a"}
const WALL := {"cafe": "c9a878", "che": "d89aa8", "bia": "c99a5a", "food": "d9a84a", "pho": "e0b45a", "hair": "8fb0c0",
	"grocery": "c9a86a", "pharma": "9fc0a0", "bike": "a8a090", "phone": "90a8c0", "flower": "d8a0b8", "inn": "c98a6a"}


## Tạo phòng tại `origin` (giữa mép cửa, sàn ở origin.y). `own` = quán của người chơi. Trả về
## {node, kind, solids: Array[Rect2], bounds: Rect2, spawn, exit, door: Vector3,
##  seats: [{pos: Vector3, face: độ, h, taken: bool}], service: Vector3 (chỗ đứng gọi ở quầy) hoặc null,
##  stove: Vector3 hoặc null}
static func build(parent: Node3D, shop: Dictionary, origin: Vector3, own := false) -> Dictionary:
	var room := Node3D.new()
	room.position = origin
	parent.add_child(room)
	var title: String = shop["title"]
	var kind := "pho" if own else kind_of(title)
	var out := {
		"node": room, "kind": kind, "solids": [] as Array[Rect2], "seats": [], "service": null, "stove": null,
		"bounds": Rect2(origin.x - W / 2 + 0.35, origin.z - D + 0.35, W - 0.7, D - 0.35 + 0.2),
		"spawn": origin + Vector3(0, 0, -1.8), "exit": origin + Vector3(0, 0, -0.7), "door": origin + Vector3(0, 0, -0.4),
	}
	_shell(room, kind, title)
	_furnish(room, kind, out)
	return out


static func kind_of(t: String) -> String:
	var u := t.to_upper()
	for pair in [["CAFE", "cafe"], ["CÀ PHÊ", "cafe"], ["CHÈ", "che"], ["BIA", "bia"], ["TÓC", "hair"], ["THUỐC", "pharma"],
			["SỬA XE", "bike"], ["ĐIỆN THOẠI", "phone"], ["HOA", "flower"], ["NHÀ NGHỈ", "inn"], ["TẠP HÓA", "grocery"],
			["GẠO", "grocery"]]:
		if u.contains(pair[0]):
			return pair[1]
	return "food"


## Sàn, tường sau và hai tường bên (thấp hơn để camera nhìn qua), biển tên, đèn.
static func _shell(room: Node3D, kind: String, title: String) -> void:
	_box(room, Vector3(W, 0.2, D + 0.4), Vector3(0, -0.1, -D / 2 + 0.2), FLOOR.get(kind, "c98a4b"), false)
	_box(room, Vector3(W - 1.0, 0.02, 2.4), Vector3(0, 0.011, -D / 2 - 0.5), "b5322a", false)  # thảm lối giữa
	var wc: String = WALL.get(kind, "f3d27a")
	_box(room, Vector3(W, H + 0.6, 0.2), Vector3(0, (H + 0.6) / 2, -D), wc, true)
	for side in [-1.0, 1.0]:
		_box(room, Vector3(0.2, H, D), Vector3(side * W / 2, H / 2, -D / 2), wc, true)
		_box(room, Vector3(0.06, 1.1, 2.2), Vector3(side * (W / 2 - 0.13), 1.6, -D * 0.5), "ffd88a", false, 0.8)  # cửa sổ
		_box(room, Vector3(0.3, 0.25, 0.3), Vector3(side * (W / 2 - 0.15), 0.12, 0.0), "6b4a2a", false)  # bậu cửa
	_box(room, Vector3(W - 0.4, 0.9, 0.05), Vector3(0, 0.45, -D + 0.13), "9b6a3e", false)  # ốp chân tường
	_box(room, Vector3(6.4, 0.9, 0.08), Vector3(0, H + 0.1, -D + 0.16), "c0392b", false)
	var l := Label3D.new()
	l.text = title
	l.font = load("res://assets/fonts/NotoSans-Bold.ttf")
	l.font_size = 72
	l.pixel_size = 0.0048
	l.outline_size = 10
	l.modulate = Color("ffe7a8")
	l.position = Vector3(0, H + 0.1, -D + 0.22)
	room.add_child(l)
	for x in [-3.5, 3.5]:
		var lamp := OmniLight3D.new()
		lamp.position = Vector3(x, 2.6, -D / 2)
		lamp.light_color = Color("ffd8a0")
		lamp.light_energy = 1.2
		lamp.omni_range = 9.0
		room.add_child(lamp)


# ---------------------------------------------------------------- bày đồ
static func _furnish(room: Node3D, kind: String, out: Dictionary) -> void:
	var o: Vector3 = room.position
	var solids: Array[Rect2] = out["solids"]
	match kind:
		"pho":
			_put(room, solids, "counter", -1.6, -D + 1.1)
			_put(room, solids, "pot_big", 1.2, -D + 0.9)
			_put(room, solids, "grill", 2.6, -D + 0.9)
			_put(room, null, "bowl", -2.0, -D + 1.1, 0, 0.95)
			_put(room, null, "bowl", -1.4, -D + 1.1, 30, 0.95)
			out["stove"] = o + Vector3(1.6, 0, -D + 2.3)
			_dining(room, out, "table_low", "stool_red", 0.32, 0.0)
			_put(room, solids, "altar", W / 2 - 0.2, -D + 1.6, -90)
			_put(room, solids, "fan", -W / 2 + 0.6, -1.2, 150)
			_put(room, solids, "plant_pot", W / 2 - 0.6, -1.0)
			_lanterns(room)
		"cafe":
			_service(room, out, "coffee_bar", {"shirt": "#3a2a22", "apron": true})
			_dining(room, out, "round_table", "armchair", 0.42, 0.5)
			_put(room, solids, "bookshelf", -W / 2 + 0.45, -D + 1.6, 90)
			_lanterns(room)
		"che":
			_service(room, out, "jar_counter", {"shirt": "#e85d9a", "apron": true, "long": true})
			_dining(room, out, "table_low", "stool_blue", 0.32, 0.5)
			_lanterns(room)
		"bia":
			_service(room, out, "counter", {"apron": true, "hat": "nonla"})
			_dining(room, out, "long_table", "", 0.44, 0.6)
			_put(room, solids, "basin_stack", W / 2 - 0.8, -D + 0.8)
			_put(room, solids, "crate", -W / 2 + 0.8, -D + 0.8)
			_lanterns(room)
		"food":
			_service(room, out, "counter", {"shirt": "#f5f0e6", "apron": true, "hat": "khan"})
			_put(room, solids, "pot_big", 2.2, -D + 0.9)
			_dining(room, out, "table_low", "stool_red", 0.32, 0.5)
			_put(room, solids, "fan", W / 2 - 0.6, -1.2, -150)
			_lanterns(room)
		"hair":
			_service(room, out, "counter", {"shirt": "#e9e1d0", "apron": true})
			for z in [-3.0, -5.6]:
				for side in [-1.0, 1.0]:
					var x: float = side * (W / 2 - 0.9)
					_box(room, Vector3(0.06, 1.3, 1.1), Vector3(side * (W / 2 - 0.13), 1.5, z), "bfe6f2", false, 0.2)
					_put(room, solids, "armchair", x, z, -90 * side)
			_guest(room, -(W / 2 - 0.9), -3.0, 90, 0.42)
			_staff(room, -(W / 2 - 1.7), -3.0, {"shirt": "#e9e1d0", "apron": true, "face": -90})
			_put(room, solids, "sofa", 3.4, -1.6, 180)
		"pharma":
			_service(room, out, "counter", {"shirt": "#f5f0e6", "apron": true})
			for x in [-5.0, 5.0]:
				_put(room, solids, "bookshelf", x, -D + 0.45)
			for z in [-3.0, -5.5]:
				_put(room, solids, "bookshelf", -W / 2 + 0.45, z, 90)
				_put(room, solids, "bookshelf", W / 2 - 0.45, z, -90)
		"bike":
			_service(room, out, "shelf", {"shirt": "#3c4f6b", "hat": "khan"})
			for p in [Vector2(-4.2, -4.0), Vector2(4.2, -5.6)]:
				var b := _put(room, solids, "motorbike", p.x, p.y, 90)
				Toon.recolor(b, "BikeBody", Color(["#1d3557", "#e8573c"].pick_random()))
			_staff(room, -4.2, -2.8, {"shirt": "#3c4f6b", "hat": "khan", "sit": 0.15, "face": 180})
			for i in 3:
				_put(room, solids, "carton", W / 2 - 0.9, -2.0 - i * 1.0)
		"phone":
			_service(room, out, "counter", {"shirt": "#3f8fd2"})
			for x in [-5.0, 5.0]:
				_put(room, solids, "bookshelf", x, -D + 0.45)
			_put(room, null, "stool_blue", -4.0, -4.0)
			_guest(room, -4.0, -4.0, 90, 0.32)
		"flower":
			_service(room, out, "counter", {"shirt": "#e85d9a", "apron": true, "long": true})
			for i in 10:
				var side := -1.0 if i < 5 else 1.0
				_put(room, solids, "plant_pot", side * (W / 2 - 0.7), -1.6 - (i % 5) * 1.5)
			for x in [-3.6, 3.6]:
				_put(room, solids, "topiary", x, -4.5)
		"inn":
			_service(room, out, "counter", {"shirt": "#c0392b"})
			_put(room, solids, "sofa", -W / 2 + 1.0, -4.0, 90)
			_put(room, solids, "plant_pot", W / 2 - 0.6, -1.0)
			_put(room, solids, "bed", W / 2 - 1.4, -5.0, -90)
		_:  # tạp hoá, gạo
			_service(room, out, "counter", {"hat": "nonla", "long": true, "apron": true})
			for x in [-5.0, 5.0]:
				_put(room, solids, "shelf", x, -D + 0.45)
			for z in [-3.0, -5.6]:
				_put(room, solids, "shelf", -W / 2 + 0.45, z, 90)
			for i in 4:
				_put(room, solids, "basin_stack" if i % 2 else "crate", 4.4 + (i % 2) * 1.0, -3.0 - (i / 2) * 1.2)


## Quầy ở giữa tường sau, người bán đứng sau quầy; chỗ đứng gọi món ở trước quầy.
static func _service(room: Node3D, out: Dictionary, model: String, staff: Dictionary) -> void:
	_put(room, out["solids"], model, 0, -D + 1.1)
	var o := staff.duplicate()
	if not o.has("face"):
		o["face"] = 0.0
	_staff(room, 0, -D + 0.45, o)
	out["service"] = room.position + Vector3(0, 0, -D + 2.4)


## Bốn bàn ở hai bên lối giữa, mỗi bàn hai ghế (trước/sau). `fill` = tỉ lệ ghế đã có khách ngồi sẵn.
## Ghế trống được ghi vào out.seats để khách (quán của mình) hoặc người chơi ngồi.
static func _dining(room: Node3D, out: Dictionary, table: String, seat_model: String, h: float, fill: float) -> void:
	for z in ROWS:
		for side in [-1.0, 1.0]:
			var x: float = side * TX
			_put(room, out["solids"], table, x, z, 0.0, 0.0, 0.12)
			var offs := [-0.45, 0.45] if table == "long_table" else [0.0]
			for dz in [0.66, -0.66]:
				for dx in offs:
					var face := 180.0 if dz > 0 else 0.0
					var sx: float = x + dx
					var sz: float = z + dz * (1.25 if table == "long_table" else (1.15 if seat_model == "armchair" else 1.0))
					if seat_model != "":
						_put(room, null, seat_model, sx, sz, face)
					if randf() < fill:
						_guest(room, sx, sz, face, h, true)
						_put(room, null, "bowl", sx, z + dz * 0.3, 0, 0.46 if table == "table_low" else 0.74)
					else:
						out["seats"].append({"pos": room.position + Vector3(sx, 0, sz), "face": face, "h": h, "taken": false})


static func _box(room: Node3D, size: Vector3, pos: Vector3, col: String, collide: bool, emit := 0.0) -> void:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.material_override = Toon.colored("room", Color(col), emit)
	mi.position = pos
	room.add_child(mi)
	if collide:
		var body := StaticBody3D.new()
		var cs := CollisionShape3D.new()
		var sh := BoxShape3D.new()
		sh.size = size
		cs.shape = sh
		body.add_child(cs)
		mi.add_child(body)


## Đặt một mô hình. Nếu có `solids`, thêm hình chữ nhật chặn đường (thu nhỏ vào `inset` m cho đỡ vướng).
static func _put(room: Node3D, solids, name: String, x: float, z: float, rot := 0.0, y := 0.0, inset := 0.08) -> Node3D:
	var n: Node3D = (load(M + name + ".glb") as PackedScene).instantiate()
	Toon.apply(n)
	n.position = Vector3(x, y, z)
	n.rotation.y = deg_to_rad(rot)
	room.add_child(n)
	if solids != null:
		var first := true
		var box := AABB()
		for c in n.find_children("*", "MeshInstance3D", true, false):
			var mi := c as MeshInstance3D
			var ab: AABB = mi.global_transform * mi.get_aabb()
			box = ab if first else box.merge(ab)
			first = false
		if not first:
			var r := Rect2(box.position.x, box.position.z, box.size.x, box.size.z).grow(-inset)
			(solids as Array[Rect2]).append(r)
	return n


static func _guest(room: Node3D, x: float, z: float, face: float, sit: float, eat := false) -> void:
	var c := Chibi.new()
	room.add_child(c)
	c.setup({"sit": sit, "face": face})
	c.position = Vector3(x, 0, z)
	if eat:
		c.set_eating(true)


static func _staff(room: Node3D, x: float, z: float, o: Dictionary) -> void:
	var c := Chibi.new()
	room.add_child(c)
	var opts := o.duplicate()
	if not opts.has("face"):
		opts["face"] = 0.0
	c.setup(opts)
	c.position = Vector3(x, 0, z)


static func _lanterns(room: Node3D) -> void:
	var cols := ["#e2412f", "#f2b84b", "#e85d9a", "#e2412f", "#2fae8f", "#f2b84b"]
	for i in 6:
		var l: Node3D = (load(M + "lantern.glb") as PackedScene).instantiate()
		Toon.apply(l)
		Toon.recolor(l, "LanternSilk", Color(cols[i]), 2.5)
		l.position = Vector3(-5.0 + i * 2.0, 2.0, -D + 0.7)  # dọc tường sau, không che camera
		room.add_child(l)
