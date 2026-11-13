extends Node3D
## Góc phố ở chế độ góc nhìn thứ ba: cả cảnh 3D (xuất từ Blender bằng build_corner.py --export3d),
## camera đi sau lưng nhân vật. Vòng chơi: ra chợ mua nguyên liệu → về quán Phở Gánh nhận order,
## nấu ở bếp, bưng ra cho khách → thu tiền. Ngoài ra: nói chuyện, nhận việc vặt của người đi đường,
## vào quán khác ngồi ăn / mua dịch vụ để hồi thể lực.
##
## Toạ độ trong scene.json / scene3d.json là toạ độ Blender: Godot = (x, z, -y).
## Số liệu chơi: data/gameplay.json. Logic tiền/nấu/đồng hồ: GameState (có kiểm thử).
## Tham số dòng lệnh (sau `--`), dùng để chụp ảnh kiểm tra:
##   --shot=ảnh.png  --night  --yaw=độ  --at=x,y (Blender)  --enter=tên quán  --own (vào quán mình)
##   --panel=food|bag|book|map|gear|market  --talk (mở hộ thoại việc vặt)  --serve (dựng sẵn cảnh có khách)

const DIR := "res://assets/scenes/corner/"
const DATA := "res://data/gameplay.json"
const OWN_SHOP := "PHỞ GÁNH"
const WALK_SPEED := 3.6
const RUN_SPEED := 6.2
const HERO_RADIUS := 0.3
const STREET_SHADER := preload("res://shaders/spatial_env_street.gdshader")
const ROOM_Y := -200.0

var data := {}
var data3d := {}
var cfg := {}
var state: GameState
var solids: Array[Rect2] = []
var bounds := Rect2(-24, -48, 70, 64)
var walkers: Array = []
var bikes: Array = []
var sellers: Array = []
var night_lights: Array[Light3D] = []
var night := false

var hero: Chibi
var pivot: Node3D
var arm: SpringArm3D
var cam: Camera3D
var sun: DirectionalLight3D
var env: Environment
var sky_mat: ProceduralSkyMaterial
var hud: HudGame
var yaw := -30.0
var pitch := -22.0
var arm_len := 6.5
var sensitivity := 0.25

## Cửa quán: {shop, ring, door: Vector3, own: bool}
var shop_marks: Array = []
## Phòng đang ở trong (null = ngoài phố): kết quả Interior.build + "mark"
var room = null
var rooms := {}
## Điểm tương tác gần nhất: {pos, r, text, act: Callable, h}
var focus = null
var float_label: Label3D
var fade: ColorRect
var busy := false
var _ring_t := 0.0
var _was_tired := false

# quán phở của mình
var customers: Array = []
var cust_timer := 3.0
var carrying := ""
var bowl_node: Node3D
var cooking := {}
var sitting_seat = null
## Nhảy: vận tốc đứng (m/s) và độ cao so với mặt sàn
var jump_v := 0.0
var jump_h := 0.0
const JUMP_SPEED := 5.2
const GRAVITY := 15.0

var _goal_t := 0.0
var _shot_path := ""
var _shot_frames := 0
var _shot_at := 70
var _shot_jump := false


static func b2g(x: float, y: float, z := 0.0) -> Vector3:
	return Vector3(x, z, -y)


static func rect_b2g(r: Array) -> Rect2:
	return Rect2(r[0], -r[3], r[2] - r[0], r[3] - r[1])


static func flat(v: Vector3) -> Vector2:
	return Vector2(v.x, v.z)


func _ready() -> void:
	randomize()
	data = JSON.parse_string(FileAccess.get_file_as_string(DIR + "scene.json"))
	data3d = JSON.parse_string(FileAccess.get_file_as_string(DIR + "scene3d.json"))
	cfg = JSON.parse_string(FileAccess.get_file_as_string(DATA))
	state = GameState.new(cfg)
	cust_timer = float(cfg["customers"]["first_after_sec"])
	var start := Vector2(1.5, 2.0)
	var args := OS.get_cmdline_user_args()
	for a in args:
		if a.begins_with("--shot="):
			_shot_path = a.substr(7)
		elif a == "--night":
			state.minute = 1170.0
		elif a.begins_with("--yaw="):
			yaw = float(a.substr(6))
		elif a.begins_with("--at="):
			var p := a.substr(5).split(",")
			start = Vector2(float(p[0]), float(p[1]))
	hud = HudGame.new()
	add_child(hud)
	hud.bind(state)
	_build_environment()
	_build_world()
	for r in data3d["solids"]:
		var rr := rect_b2g(r)
		if rr.size.x < 30 and rr.size.y < 30:  # bỏ khối sông (đã chặn bằng giới hạn)
			if rr.get_area() < 6.0 and rr.size.x > 0.3 and rr.size.y > 0.3:
				rr = rr.grow(-0.06)
			solids.append(rr)
	_build_people()
	_build_traffic()
	hero = _person(b2g(start.x, start.y), {"shirt": "#4f7fa8", "pants": "#3c4a5b", "skin": "#f1c9a5", "hair": "#2b1a12", "hat": "nonla", "belt": "#2b3a4a"})
	var hp2 := _slide(flat(hero.position), HERO_RADIUS)
	hero.position = Vector3(hp2.x, 0, hp2.y)
	_build_camera()
	hud.map_source = _map_data
	hud.setting_changed.connect(_on_setting)
	hud.prompt_clicked.connect(_interact)
	_build_marks()
	_build_float_label()
	_build_fade()
	set_night(state.is_night())
	_shot_setup(args)


# ================================================================ cảnh
func _build_environment() -> void:
	sky_mat = ProceduralSkyMaterial.new()
	var sky := Sky.new()
	sky.sky_material = sky_mat
	env = Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.ssao_enabled = true
	env.ssao_radius = 1.2
	env.ssao_intensity = 1.2
	env.glow_enabled = true
	env.glow_intensity = 0.5
	env.glow_hdr_threshold = 1.2
	env.fog_enabled = true
	env.fog_density = 0.0015
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.18
	env.adjustment_contrast = 1.06
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	sun = DirectionalLight3D.new()
	sun.shadow_enabled = true
	sun.shadow_blur = 1.6
	sun.directional_shadow_max_distance = 80.0
	add_child(sun)
	sun.basis = Basis.looking_at(Vector3(0.45, -0.72, -0.53), Vector3.UP)


func _build_world() -> void:
	var world: Node3D = (load(DIR + "scene_full.glb") as PackedScene).instantiate()
	add_child(world)
	Toon.apply(world)
	var road := StandardMaterial3D.new()
	road.albedo_color = Color("6a6a6c")
	road.roughness = 0.95
	var walk := ShaderMaterial.new()
	walk.shader = STREET_SHADER
	walk.set_shader_parameter("surface_kind", 1)
	var water := StandardMaterial3D.new()
	water.albedo_color = Color("4f9fa8")
	water.roughness = 0.08
	water.metallic_specular = 0.9
	for n in world.find_children("*", "MeshInstance3D", true, false):
		var mi := n as MeshInstance3D
		var nm := String(mi.name)
		if nm.begins_with("Ground"):
			mi.material_override = walk
		elif nm.begins_with("RoadA") or nm.begins_with("RoadB"):
			mi.material_override = road
		elif nm.begins_with("River"):
			mi.material_override = water
		# va chạm cho camera: chỉ thân nhà lớn, để cần camera không xuyên tường
		var ab := mi.get_aabb()
		if ab.size.y > 2.2 and (nm.begins_with("Shell") or nm.begins_with("UpShell") or nm.begins_with("Wall") or nm.begins_with("Body")):
			mi.create_convex_collision(true, true)
	for p in [[-6.5, -12], [-6.5, -4], [-6.5, 4], [-11, 20], [8, 20], [16, 20], [24, 20], [0, -8], [0, -2], [0, 3.5]]:
		var l := OmniLight3D.new()
		l.position = b2g(p[0], p[1], 3.2)
		l.light_color = Color("ffb46a")
		l.light_energy = 3.0
		l.omni_range = 9.0
		add_child(l)
		night_lights.append(l)


func set_night(on: bool) -> void:
	night = on
	if on:
		sky_mat.sky_top_color = Color("0b1030")
		sky_mat.sky_horizon_color = Color("2a2a55")
		sky_mat.ground_horizon_color = Color("1a1a30")
		sky_mat.ground_bottom_color = Color("0a0a14")
		env.ambient_light_energy = 0.55
		env.tonemap_exposure = 1.0
		sun.light_color = Color("8fa0ff")
		sun.light_energy = 0.25
		env.fog_light_color = Color("1a1a33")
	else:
		sky_mat.sky_top_color = Color("4f9ee8")
		sky_mat.sky_horizon_color = Color("cfe8f8")
		sky_mat.ground_horizon_color = Color("cfe0e8")
		sky_mat.ground_bottom_color = Color("8a9a90")
		env.ambient_light_energy = 0.8
		env.tonemap_exposure = 0.95
		sun.light_color = Color("fff1d8")
		sun.light_energy = 1.3
		env.fog_light_color = Color("cfe4f2")
	for l in night_lights:
		l.visible = on


func _on_setting(key: String, value) -> void:
	match key:
		"night":
			state.minute = 1140.0 if value else 420.0
			state.changed.emit()
		"sensitivity":
			sensitivity = float(value)


# ================================================================ vòng tròn cửa quán, nhãn nổi
func _ring_mesh(radius: float, color: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = radius - 0.1
	t.outer_radius = radius
	t.rings = 48
	mi.mesh = t
	mi.scale = Vector3(1, 0.15, 1)
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.emission_enabled = true
	m.emission = color
	m.emission_energy_multiplier = 2.0
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var disc := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = radius - 0.08
	cm.bottom_radius = radius - 0.08
	cm.height = 0.02
	disc.mesh = cm
	var dm := StandardMaterial3D.new()
	dm.albedo_color = Color(color, 0.18)
	dm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	dm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	disc.material_override = dm
	disc.scale = Vector3(1, 6.6, 1)
	mi.add_child(disc)
	return mi


func _label3d(text: String, size := 44, color := Color("ffe7a8")) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font = hud.font
	l.font_size = size
	l.pixel_size = 0.0038
	l.outline_size = 12
	l.outline_modulate = Color("1d140e")
	l.modulate = color
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.render_priority = 10
	return l


func _build_marks() -> void:
	for sh in data3d["shops"]:
		var own := String(sh["title"]) == OWN_SHOP
		var door := b2g(sh["door"][0], sh["door"][1])
		var ring := _ring_mesh(0.7, Color("ff6a4a") if own else Color("f2c84b"))
		ring.position = door + Vector3(0, 0.06, 0)
		add_child(ring)
		if own:  # biển nổi "Quán của bạn" luôn hiện để dễ tìm
			var tag := _label3d("★ Quán của bạn", 40, Color("ffb09a"))
			tag.position = door + Vector3(0, 3.4, 0)
			add_child(tag)
		shop_marks.append({"shop": sh, "ring": ring, "door": door, "own": own})


func _build_float_label() -> void:
	float_label = _label3d("", 46)
	float_label.visible = false
	add_child(float_label)


func _build_fade() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 20
	add_child(layer)
	fade = ColorRect.new()
	fade.color = Color(0, 0, 0, 0)
	fade.set_anchors_preset(Control.PRESET_FULL_RECT)
	fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(fade)


# ================================================================ điểm tương tác
## Danh sách điểm tương tác trong khu đang đứng (ngoài phố hoặc trong phòng).
func _candidates() -> Array:
	var out: Array = []
	if room == null:
		for m in shop_marks:
			var t := "Vào quán của bạn" if m["own"] else "Vào " + String(m["shop"]["title"]).capitalize()
			out.append({"pos": m["door"], "r": 2.2, "text": t, "act": _go.bind(m), "h": 2.4})
		for s in sellers:
			out.append({"pos": s["pos"], "r": 2.6, "text": "Mua ở " + String(s["section"]["name"]), "act": _open_market.bind(s), "h": 2.5})
		for w in walkers:
			var c: Chibi = w["c"]
			var t2 := "Nhận việc vặt" if w.has("errand") else "Nói chuyện"
			out.append({"pos": c.position, "r": 2.2, "text": t2, "act": _talk.bind(w), "h": 2.3})
		return out
	out.append({"pos": room["exit"], "r": 1.8, "text": "Ra phố", "act": _go.bind(null), "h": 2.7})
	if room["service"] != null:
		var t3 := "Gọi món" if room["kind"] in ["food", "bia", "cafe", "che"] else "Mua / dùng dịch vụ"
		out.append({"pos": room["service"], "r": 2.4, "text": t3, "act": _open_menu, "h": 2.6})
	if room["kind"] == "pho":
		var st := "Nấu phở" if carrying == "" else "Đang bưng " + _dish(carrying)
		out.append({"pos": room["stove"], "r": 2.2, "text": st, "act": _open_stove, "h": 2.6})
		for cu in customers:
			var ct := _customer_text(cu)
			if ct != "":
				out.append({"pos": cu["seat"]["pos"], "r": 2.0, "text": ct, "act": _customer_act.bind(cu), "h": 0.0, "nolabel": true})
	else:
		for s in room["seats"]:
			if not s["taken"]:
				out.append({"pos": s["pos"], "r": 1.4, "text": "Ngồi gọi món", "act": _sit.bind(s), "h": 2.4})
	return out


func _update_focus(delta: float) -> void:
	_ring_t += delta
	var pulse := 1.0 + sin(_ring_t * 4.0) * 0.08
	for m in shop_marks:
		(m["ring"] as Node3D).scale = Vector3(pulse, 0.15, pulse)
	focus = null
	var hp := flat(hero.position)
	var best := 1e9
	if not (busy or hud.modal_open() or not cooking.is_empty() or sitting_seat != null):
		for c in _candidates():
			var d := hp.distance_to(flat(c["pos"]))
			if d < float(c["r"]) and d < best:
				best = d
				focus = c
	if focus != null:
		float_label.text = "E · " + String(focus["text"])
		float_label.position = (focus["pos"] as Vector3) + Vector3(0, float(focus["h"]), 0)
		float_label.visible = not focus.get("nolabel", false)
		hud.set_prompt(String(focus["text"]))
	else:
		float_label.visible = false
		hud.set_prompt("Nhấn E để đứng dậy" if sitting_seat != null and not hud.modal_open() else "")


func _interact() -> void:
	if hud.dialog_open():
		hud.dialog_key(true)
	elif hud.modal_open() or busy or not cooking.is_empty():
		return
	elif sitting_seat != null:
		_stand()
	elif focus != null:
		(focus["act"] as Callable).call()


# ================================================================ vào / ra quán
## Chuyển cảnh mờ dần; mark = null là ra phố.
func _go(mark) -> void:
	if busy:
		return
	busy = true
	var tw := create_tween()
	tw.tween_property(fade, "color:a", 1.0, 0.22)
	tw.tween_callback(func():
		if mark == null:
			_exit_now()
		else:
			_enter_now(mark))
	tw.tween_property(fade, "color:a", 0.0, 0.28)
	tw.tween_callback(func(): busy = false)


func _enter_now(mark: Dictionary) -> void:
	var title: String = mark["shop"]["title"]
	if not rooms.has(title):
		var origin := Vector3(rooms.size() * 30.0, ROOM_Y, 0)
		var r: Dictionary = Interior.build(self, mark["shop"], origin, mark["own"])
		var ring := _ring_mesh(0.55, Color("6ad0ff"))
		ring.position = (r["exit"] as Vector3) + Vector3(0, 0.06, 0)
		add_child(ring)
		rooms[title] = r
	room = rooms[title]
	room["mark"] = mark
	hero.position = room["spawn"]
	hero.facing = PI
	hero.rotation.y = PI
	yaw = 0.0
	pitch = -38.0
	arm_len = 7.0
	arm.collision_mask = 0  # trong phòng cắt ngang: camera không bị tường đẩy sát lưng
	pivot.position = hero.position + Vector3(0, 1.35, 0)
	hud.area.text = "Quán của bạn · Phở Gánh" if mark["own"] else title.capitalize()
	if mark["own"]:
		cust_timer = minf(cust_timer, float(cfg["customers"]["first_after_sec"]))
	_check_errand(title)


func _exit_now() -> void:
	var mark: Dictionary = room["mark"]
	if sitting_seat != null:
		_stand()
	room = null
	var door: Vector3 = mark["door"]
	var rot := float(mark["shop"]["rot"])
	var out := Vector3(sin(deg_to_rad(rot)), 0, cos(deg_to_rad(rot)))
	var p := _slide(flat(door + out * 0.9), HERO_RADIUS)
	hero.position = Vector3(p.x, 0, p.y)
	hero.facing = deg_to_rad(rot)
	hero.rotation.y = hero.facing
	yaw = rot + 180.0
	pitch = -22.0
	arm_len = 6.5
	arm.collision_mask = 1
	pivot.position = hero.position + Vector3(0, 1.35, 0)
	hud.area.text = "Ngõ Phố Cổ · Góc chợ đêm"


# ================================================================ chợ, quán khác
func _open_market(s: Dictionary) -> void:
	var sec: Dictionary = s["section"]
	var body := hud.open_panel(String(sec["name"]), "market")
	hud.note(body, "“%s”" % sec["call"], Color("ffe08a"))
	hud.note(body, "Tiền: " + GameState.money_text(state.money))
	for id in sec["items"]:
		var ing: Dictionary = cfg["ingredients"][id]
		var price := int(ing["price"])
		hud.row(body, String(ing["name"]), "%s / phần · trong túi: %d" % [GameState.money_text(price), state.count(id)],
			"Mua 1", state.money >= price, _buy.bind(s, id, 1), Color(ing["color"]))
		hud.row(body, String(ing["name"]) + " × 5", GameState.money_text(price * 5),
			"Mua 5", state.money >= price * 5, _buy.bind(s, id, 5))
	(s["c"] as Chibi).facing = atan2(hero.position.x - s["pos"].x, hero.position.z - s["pos"].z)


func _buy(s: Dictionary, id: String, qty: int) -> void:
	if state.buy(id, qty):
		_open_market(s)


func _open_menu() -> void:
	var kind: String = room["kind"]
	var items: Array = cfg["menus"].get(kind, [])
	var body := hud.open_panel(String(room["mark"]["shop"]["title"]).capitalize(), "menu")
	hud.note(body, "Tiền: %s · Thể lực %d · Máu %d" % [GameState.money_text(state.money), state.energy, state.hp])
	for e in items:
		var bits: Array[String] = []
		if e.get("energy", 0):
			bits.append("%+d thể lực" % int(e["energy"]))
		if e.get("hp", 0):
			bits.append("%+d máu" % int(e["hp"]))
		if e.get("rep", 0):
			bits.append("%+d uy tín" % int(e["rep"]))
		if e.has("item"):
			bits.append("vào túi đồ")
		hud.row(body, String(e["name"]), " · ".join(bits), "Mua " + GameState.money_text(int(e["price"])),
			state.money >= int(e["price"]), _consume.bind(e))


func _consume(e: Dictionary) -> void:
	if state.consume(e):
		hud.close_panel()
		hud.toast("%s · -%s" % [e["name"], GameState.money_text(int(e["price"]))])


func _sit(seat: Dictionary) -> void:
	sitting_seat = seat
	seat["taken"] = true
	hero.position = seat["pos"]
	hero.sit(float(seat["h"]))
	hero.facing = deg_to_rad(float(seat["face"]))
	hero.moving = false
	_open_menu()


func _stand() -> void:
	sitting_seat["taken"] = false
	sitting_seat = null
	hero.stand()


# ================================================================ người đi đường: nói chuyện, việc vặt
func _talk(w: Dictionary) -> void:
	var c: Chibi = w["c"]
	w["wait"] = 6.0
	c.moving = false
	c.face_dir(flat(hero.position - c.position))
	var who := "Người đi đường"
	if w.has("errand"):
		var e: Dictionary = w["errand"]
		if not state.errand.is_empty():
			hud.show_dialog(who, "Cháu đang bận việc khác à? Xong việc thì quay lại giúp cô nhé.")
			return
		hud.show_dialog(who, String(e["ask"]) + "  (Thưởng %s)" % GameState.money_text(int(e["reward"])), [
			["Nhận việc", _accept_errand.bind(w, e)], ["Để sau", func(): pass]])
	else:
		hud.show_dialog(who, String(cfg["talk"].pick_random()))


func _accept_errand(w: Dictionary, e: Dictionary) -> void:
	state.errand = e.duplicate()
	state.errand["target_title"] = _shop_title(String(e["target"]))
	w.erase("errand")
	(w["mark"] as Node3D).queue_free()
	w.erase("mark")
	state.changed.emit()
	hud.toast("Nhận việc: mang %s" % e["item"])


func _shop_title(key: String) -> String:
	for sh in data3d["shops"]:
		if String(sh["title"]).contains(key):
			return sh["title"]
	return key


func _check_errand(title: String) -> void:
	if state.errand.is_empty() or state.errand["target_title"] != title:
		return
	var reward := int(state.errand["reward"])
	hud.toast("Giao xong %s · +%s" % [state.errand["item"], GameState.money_text(reward)], Color("9ff08a"))
	state.errand = {}
	state.earn(reward, false)
	state.add_rep(1)
	_give_errand()


## Gắn một việc vặt mới cho một người đi đường chưa có việc (dấu ! trên đầu).
func _give_errand() -> void:
	var free := walkers.filter(func(w): return not w.has("errand"))
	if free.is_empty():
		return
	var w: Dictionary = free.pick_random()
	w["errand"] = cfg["errands"].pick_random()
	var m := _label3d("!", 90, Color("ffd23a"))
	m.position = Vector3(0, 2.25, 0)
	(w["c"] as Node3D).add_child(m)
	w["mark"] = m


# ================================================================ việc cần làm
## Gợi ý bước tiếp theo cho người chơi, theo tình hình hiện tại.
func _goal() -> String:
	if sitting_seat != null:
		return "Chọn món trong bảng (phím 1–9), E để đứng dậy"
	if room != null and room["kind"] == "pho":
		for cu in customers:
			if cu["state"] == "order":
				return "Tới khách có \"! Gọi món\", bấm E nhận order"
		if carrying != "":
			return "Bưng %s ra cho khách đang chờ" % _dish(carrying)
		for cu in customers:
			if cu["state"] == "wait":
				var miss := state.missing_for(cu["order"])
				if not miss.is_empty():
					return "Thiếu %s — ra chợ mua" % state.item_name(miss[0])
				return "Tới bếp (sau quầy) bấm E nấu %s" % _dish(cu["order"])
		return "Chờ khách vào quán… (hoặc ra chợ mua thêm đồ)"
	if room != null:
		return "Tới quầy hoặc ghế trống bấm E để gọi món / dịch vụ"
	if not state.errand.is_empty():
		return "Mang %s tới %s (xem bản đồ M)" % [state.errand["item"], String(state.errand["target_title"]).capitalize()]
	var can_cook := false
	for r in cfg["recipes"]:
		if state.missing_for(r["id"]).is_empty():
			can_cook = true
	if not can_cook:
		return "Ra chợ (sạp bên phải ngã tư) mua nguyên liệu"
	return "Về quán Phở Gánh (vòng đỏ, dãy phố trái) bán phở"


# ================================================================ quán phở của mình
func _dish(id: String) -> String:
	return String(state.recipe(id).get("name", id))


func _open_stove() -> void:
	if carrying != "":
		hud.toast("Đang bưng %s — mang ra cho khách đã" % _dish(carrying))
		return
	var body := hud.open_panel("Bếp phở", "stove")
	var waiting: Array[String] = []
	for cu in customers:
		if cu["state"] == "wait":
			waiting.append(_dish(cu["order"]))
	hud.note(body, "Khách đang chờ: " + (", ".join(waiting) if not waiting.is_empty() else "chưa có order"), Color("ffe08a"))
	for r in cfg["recipes"]:
		var miss := state.missing_for(r["id"])
		var names: Array[String] = []
		for id in miss:
			names.append(state.item_name(id))
		var sub := "Đủ nguyên liệu" if miss.is_empty() else "Thiếu: " + ", ".join(names) + " (ra chợ mua)"
		hud.row(body, "%s · %s" % [r["name"], GameState.money_text(int(r["price"]))], sub, "Nấu", miss.is_empty(),
			_cook.bind(r), HudGame.GOOD if miss.is_empty() else HudGame.BAD)


func _cook(r: Dictionary) -> void:
	hud.close_panel()
	if state.cook(r["id"]):
		cooking = {"id": r["id"], "t": 0.0, "total": float(r["cook_sec"])}
		hero.face_dir(flat(room["stove"] - hero.position))


func _update_cooking(delta: float) -> void:
	if cooking.is_empty():
		return
	cooking["t"] = float(cooking["t"]) + delta
	var v := float(cooking["t"]) / float(cooking["total"])
	hud.set_progress("Đang nấu %s…" % _dish(cooking["id"]), clampf(v, 0, 1))
	if v >= 1.0:
		_set_carry(cooking["id"])
		hud.toast("Xong %s! Bưng ra cho khách" % _dish(cooking["id"]), Color("9ff08a"))
		cooking = {}
		hud.set_progress("", -1)


func _set_carry(id: String) -> void:
	carrying = id
	hero.carrying = id != ""
	hud.set_carry(_dish(id) if id != "" else "")
	if bowl_node:
		bowl_node.queue_free()
		bowl_node = null
	if id != "":
		bowl_node = (load("res://assets/models/bowl.glb") as PackedScene).instantiate()
		Toon.apply(bowl_node)
		bowl_node.position = Vector3(0, 0.72, 0.34)
		bowl_node.scale = Vector3.ONE * 1.3
		hero.add_child(bowl_node)


func _customer_text(cu: Dictionary) -> String:
	match cu["state"]:
		"order":
			return "Nhận order"
		"wait":
			if carrying == cu["order"]:
				return "Bưng %s ra" % _dish(carrying)
			return "Khách chờ %s" % _dish(cu["order"])
	return ""


func _customer_act(cu: Dictionary) -> void:
	match cu["state"]:
		"order":
			var r: Dictionary = cfg["recipes"].pick_random()
			cu["order"] = r["id"]
			cu["state"] = "wait"
			cu["patience"] = float(cfg["customers"]["patience_sec"])
			hud.toast("Khách gọi: %s" % r["name"])
		"wait":
			if carrying == cu["order"]:
				_set_carry("")
				_place_bowl(cu)
				cu["state"] = "eat"
				(cu["c"] as Chibi).set_eating(true)
				cu["t"] = float(cfg["customers"]["eat_sec"])
				cu["fast"] = float(cfg["customers"]["patience_sec"]) - float(cu["patience"]) < float(cfg["customers"]["fast_below_sec"])
			elif carrying == "":
				hud.toast("Vào bếp nấu %s cho khách" % _dish(cu["order"]))
			else:
				hud.toast("Khách gọi %s, không phải %s" % [_dish(cu["order"]), _dish(carrying)])


## Đặt bát phở lên bàn trước mặt khách.
func _place_bowl(cu: Dictionary) -> void:
	var b: Node3D = (load("res://assets/models/bowl.glb") as PackedScene).instantiate()
	Toon.apply(b)
	var f := deg_to_rad(float(cu["seat"]["face"]))
	b.position = (cu["seat"]["pos"] as Vector3) + Vector3(sin(f), 0, cos(f)) * 0.45 + Vector3(0, 0.46, 0)
	add_child(b)
	cu["bowl"] = b


func _spawn_customer() -> void:
	var free: Array = room["seats"].filter(func(s): return not s["taken"])
	if free.is_empty():
		return
	var seat: Dictionary = free.pick_random()
	seat["taken"] = true
	var c := Chibi.new()
	add_child(c)
	c.setup({"hat": "nonla" if randf() < 0.3 else "", "long": randf() < 0.4})
	var door: Vector3 = room["door"]
	c.position = door
	var aisle := Vector3(door.x, door.y, (seat["pos"] as Vector3).z)
	var bubble := _label3d("", 34)
	bubble.position = Vector3(0, 1.75, 0)
	c.add_child(bubble)
	customers.append({"c": c, "seat": seat, "state": "in", "path": [aisle, seat["pos"]], "order": "",
		"patience": float(cfg["customers"]["patience_sec"]), "t": 0.0, "bubble": bubble})


func _update_customers(delta: float) -> void:
	var own: bool = room != null and room["kind"] == "pho"
	if own:
		cust_timer -= delta
		var seated := customers.filter(func(cu): return cu["state"] != "out").size()
		if cust_timer <= 0.0:
			var ev: Array = cfg["customers"]["every_sec"]
			cust_timer = randf_range(float(ev[0]), float(ev[1]))
			if seated < int(cfg["customers"]["max_seated"]):
				_spawn_customer()
	for cu in customers.duplicate():
		var c: Chibi = cu["c"]
		var bubble: Label3D = cu["bubble"]
		match cu["state"]:
			"in", "out":
				var path: Array = cu["path"]
				if path.is_empty():
					if cu["state"] == "in":
						c.moving = false
						c.position = cu["seat"]["pos"]
						c.sit(float(cu["seat"]["h"]))
						c.facing = deg_to_rad(float(cu["seat"]["face"]))
						cu["state"] = "order"
					else:
						cu["seat"]["taken"] = false
						c.queue_free()
						customers.erase(cu)
					continue
				var tgt: Vector3 = path[0]
				var d := flat(tgt - c.position)
				var step := 1.6 * delta
				if d.length() <= step:
					c.position = tgt
					path.pop_front()
				else:
					c.position += Vector3(d.x, 0, d.y).normalized() * step
					c.face_dir(d)
					c.moving = true
				bubble.text = ""
			"order", "wait":
				if own:  # khách chỉ sốt ruột khi chủ quán có mặt
					cu["patience"] = float(cu["patience"]) - delta
				var frac := float(cu["patience"]) / float(cfg["customers"]["patience_sec"])
				bubble.text = "! Gọi món" if cu["state"] == "order" else _dish(cu["order"])
				bubble.modulate = Color("ffe7a8").lerp(Color("ff6a5a"), clampf(1.0 - frac * 2.0, 0, 1))
				if cu["patience"] <= 0.0:
					hud.toast("Khách chờ lâu quá, bỏ về rồi…", HudGame.BAD)
					state.walkouts += 1
					state.add_rep(int(cfg["customers"]["rep_per_walkout"]))
					_leave(cu)
			"eat":
				cu["t"] = float(cu["t"]) - delta
				# "Ngon quá!" chỉ hiện lúc mới ăn, sau đó để động tác ăn tự nói
				bubble.text = "Ngon quá!" if float(cfg["customers"]["eat_sec"]) - float(cu["t"]) < 1.5 else ""
				bubble.modulate = Color("9ff08a")
				if cu["t"] <= 0.0:
					var r := state.recipe(cu["order"])
					var tip := int(cfg["customers"]["tip_if_fast"]) if cu.get("fast", false) else 0
					state.earn(int(r["price"]) + tip)
					state.add_rep(int(cfg["customers"]["rep_per_serve"]))
					hud.toast("+%s%s" % [GameState.money_text(int(r["price"])), (" · bo %s" % GameState.money_text(tip)) if tip > 0 else ""], Color("ffe08a"))
					(cu["bowl"] as Node3D).queue_free()
					_leave(cu)


func _leave(cu: Dictionary) -> void:
	var c: Chibi = cu["c"]
	c.stand()
	var door: Vector3 = rooms[OWN_SHOP]["door"]
	cu["state"] = "out"
	cu["path"] = [Vector3(door.x, door.y, c.position.z), door]


# ================================================================ camera góc nhìn thứ ba
func _build_camera() -> void:
	pivot = Node3D.new()
	add_child(pivot)
	arm = SpringArm3D.new()
	arm.spring_length = arm_len
	arm.margin = 0.3
	var shape := SphereShape3D.new()
	shape.radius = 0.3
	arm.shape = shape
	pivot.add_child(arm)
	cam = Camera3D.new()
	cam.fov = 60.0
	cam.near = 0.1
	cam.far = 400.0
	arm.add_child(cam)
	cam.make_current()
	_update_pivot(1.0)


func _update_pivot(t: float) -> void:
	if room != null:  # trong phòng: camera luôn ở phía cửa nhìn vào
		yaw = clampf(wrapf(yaw, -180.0, 180.0), -60.0, 60.0)
		pitch = clampf(pitch, -70.0, -20.0)
	pivot.position = pivot.position.lerp(hero.position + Vector3(0, 1.35, 0), t)
	pivot.rotation_degrees = Vector3(pitch, yaw, 0)
	arm.spring_length = lerpf(arm.spring_length, arm_len, minf(t * 2.0, 1.0))


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo:
		var k: Key = e.physical_keycode if e.physical_keycode != KEY_NONE else e.keycode
		if hud.modal_open() and not hud.dialog_open() and k >= KEY_1 and k <= KEY_9:
			hud.press_row(k - KEY_1)  # phím số chọn dòng trong bảng (không cần chuột)
			return
		match k:
			KEY_E, KEY_SPACE, KEY_ENTER:
				if k == KEY_E or hud.dialog_open():
					_interact()
				elif k == KEY_SPACE:
					_jump()
			KEY_ESCAPE:
				if hud.dialog_open():
					hud.dialog_key(false)
				elif hud.modal_open():
					hud.close_panel()
					if sitting_seat != null:
						_stand()
				else:
					hud.open_named("gear")
			KEY_N:
				_on_setting("night", not night)
			KEY_H:
				hud.toggle_hints()
			KEY_F:
				hud.open_named("food")
			KEY_TAB:
				hud.open_named("bag")
			KEY_J:
				hud.open_named("book")
			KEY_M:
				hud.open_named("map")
	elif e is InputEventMouseMotion and (e.button_mask & MOUSE_BUTTON_MASK_RIGHT):
		yaw -= e.relative.x * sensitivity
		pitch = clampf(pitch - e.relative.y * sensitivity * 0.8, -65.0, 5.0)
	elif e is InputEventMouseButton and e.pressed:
		if e.button_index == MOUSE_BUTTON_WHEEL_UP:
			arm_len = clampf(arm_len - 0.6, 3.0, 14.0)
		elif e.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			arm_len = clampf(arm_len + 0.6, 3.0, 14.0)


# ================================================================ người, xe
const ROLES := {
	"cook": {"shirt": "#e9e1d0", "apron": true, "hat": "khan", "hat_color": "#3d4a5c"},
	"seller": {"apron": true, "hat": "nonla"},
	"police": {"shirt": "#5f7f45", "pants": "#4d6b3a", "hat": "police"},
}


func _person(pos: Vector3, o: Dictionary = {}) -> Chibi:
	var c := Chibi.new()
	add_child(c)
	c.setup(o)
	c.position = pos
	return c


func _build_people() -> void:
	for s in data3d["seats"]:
		var g := _person(b2g(s[0], s[1]), {"sit": float(s[3]), "face": float(s[2])})
		if randf() < 0.6:
			g.set_eating(true)
	var secs: Array = cfg["market"]["sections"]
	for p in data3d["people"]:
		var o: Dictionary = ROLES.get(p[4], {}).duplicate()
		o["face"] = float(p[2])
		if float(p[3]) >= 0.0:
			o["sit"] = float(p[3])
		var c := _person(b2g(p[0], p[1]), o)
		if p[4] == "seller":  # người bán: sạp chợ theo thứ tự các khu
			var sec: Dictionary = secs[sellers.size() % secs.size()]
			var tag := _label3d(String(sec["name"]), 34, Color("bff0a8"))
			tag.position = Vector3(0, 2.15, 0)
			tag.visibility_range_end = 14.0
			c.add_child(tag)
			sellers.append({"c": c, "pos": c.position, "section": sec})
	var walk: Array = data["walk"]
	for i in 26:
		var r := rect_b2g(walk[i % walk.size()]).grow(-0.4)
		var c := _person(Vector3(randf_range(r.position.x, r.end.x), 0, randf_range(r.position.y, r.end.y)),
			{"hat": "nonla" if randf() < 0.25 else "", "long": randf() < 0.4})
		var p2 := _slide(flat(c.position), 0.25)
		c.position = Vector3(p2.x, 0, p2.y)
		walkers.append({"c": c, "area": r, "target": p2, "wait": randf() * 2.0, "speed": randf_range(1.0, 1.5)})
	for i in 3:
		_give_errand()


const BIKE_COLS := ["#c0533c", "#3f7fc8", "#efe6d0", "#d99a3b", "#3f9f7a", "#2f3a4a", "#c8607f"]


func _bike() -> Node3D:
	var b: Node3D = (load("res://assets/models/motorbike.glb") as PackedScene).instantiate()
	Toon.apply(b)
	Toon.recolor(b, "BikeBody", Color(BIKE_COLS.pick_random()))
	add_child(b)
	var rider := Chibi.new()
	b.add_child(rider)
	var green := randf() < 0.3
	rider.setup({"sit": 0.66, "face": 90, "hat": "helmet",
		"hat_color": "#3f8f4f" if green else ["#d99a3b", "#c8607f", "#3f7fc8", "#efe6d0"].pick_random(),
		"shirt": "#3f8f4f" if green else Chibi.SHIRTS.pick_random()})
	rider.position = Vector3(-0.15, 0, 0)
	if green:
		var box: Node3D = (load("res://assets/models/delivery_box.glb") as PackedScene).instantiate()
		Toon.apply(box)
		Toon.recolor(box, "DeliveryRed", Color("3f8f4f"))
		b.add_child(box)
		box.position = Vector3(-0.55, 0.66, 0)
	var l := OmniLight3D.new()
	l.position = Vector3(0.9, 0.8, 0)
	l.light_color = Color("fff6c8")
	l.light_energy = 1.5
	l.omni_range = 4.0
	b.add_child(l)
	night_lights.append(l)
	return b


## Xe chạy theo làn, cách đều nhau, cùng tốc độ trong một làn (không chồng lên nhau); dừng khi có người phía trước.
func _build_traffic() -> void:
	for lane in data["lanes"]:
		var pts := PackedVector3Array()
		for p in lane:
			pts.append(b2g(p[0], p[1]))
		var acc := PackedFloat32Array([0.0])
		for i in range(1, pts.size()):
			acc.append(acc[i - 1] + pts[i].distance_to(pts[i - 1]))
		var path := {"pts": pts, "acc": acc, "len": acc[acc.size() - 1]}
		var speed := randf_range(4.2, 5.6)
		var n := 3
		var off := randf() * float(path["len"])
		for i in n:
			bikes.append({"n": _bike(), "path": path, "s": fmod(off + i * float(path["len"]) / n, float(path["len"])), "speed": speed})


func _update_bikes(delta: float) -> void:
	for b in bikes:
		var path: Dictionary = b["path"]
		var acc: PackedFloat32Array = path["acc"]
		var pts: PackedVector3Array = path["pts"]
		var n: Node3D = b["n"]
		var ahead := n.position + Vector3(cos(n.rotation.y), 0, -sin(n.rotation.y)) * 1.6
		if room == null and flat(ahead).distance_to(flat(hero.position)) < 1.2:
			continue  # nhường người đi bộ
		var jam := false
		for o in bikes:
			var on: Node3D = o["n"]
			if o != b and absf(angle_difference(on.rotation.y, n.rotation.y)) < 1.0 \
					and flat(ahead).distance_to(flat(on.position)) < 1.1:
				jam = true
				break
		if jam:
			continue  # giữ khoảng cách với xe phía trước
		b["s"] = fmod(float(b["s"]) + float(b["speed"]) * delta, float(path["len"]))
		var i := clampi(acc.bsearch(b["s"]) - 1, 0, pts.size() - 2)
		var t := (float(b["s"]) - acc[i]) / maxf(acc[i + 1] - acc[i], 0.001)
		n.position = pts[i].lerp(pts[i + 1], t)
		var d := pts[i + 1] - pts[i]
		n.rotation.y = lerp_angle(n.rotation.y, atan2(-d.z, d.x), clampf(delta * 8.0, 0, 1))


# ================================================================ va chạm trượt
## Đẩy vòng tròn bán kính r ra khỏi các khối chữ nhật và giữ trong giới hạn. Trượt dọc mép thay vì
## đứng khựng, góc khối được bo tròn nên đi vòng qua góc không bị kẹt.
func _slide(p: Vector2, r: float) -> Vector2:
	var list: Array[Rect2] = solids if room == null else room["solids"]
	var b: Rect2 = bounds if room == null else room["bounds"]
	for _it in 3:
		for s in list:
			var q := Vector2(clampf(p.x, s.position.x, s.end.x), clampf(p.y, s.position.y, s.end.y))
			var d := p - q
			var l := d.length()
			if l >= r:
				continue
			if l > 0.0001:
				p = q + d / l * r
			else:  # tâm nằm trong khối: đẩy ra cạnh gần nhất
				var dl := p.x - s.position.x
				var dr := s.end.x - p.x
				var dt := p.y - s.position.y
				var db := s.end.y - p.y
				var m := minf(minf(dl, dr), minf(dt, db))
				if m == dl:
					p.x = s.position.x - r
				elif m == dr:
					p.x = s.end.x + r
				elif m == dt:
					p.y = s.position.y - r
				else:
					p.y = s.end.y + r
		p.x = clampf(p.x, b.position.x + r, b.end.x - r)
		p.y = clampf(p.y, b.position.y + r, b.end.y - r)
	return p


# ================================================================ vòng lặp
func _process(delta: float) -> void:
	var rot := 0.0
	if not hud.modal_open():
		if Input.is_physical_key_pressed(KEY_Q):
			rot += 1.0
		if Input.is_physical_key_pressed(KEY_R):
			rot -= 1.0
	yaw += rot * 90.0 * delta
	var frozen := busy or hud.modal_open() or not cooking.is_empty() or sitting_seat != null
	if frozen:
		hero.moving = false
	else:
		_move_hero(delta)
	if not hud.modal_open():
		state.tick(delta, hero.moving, Input.is_physical_key_pressed(KEY_SHIFT))
	if state.is_night() != night:
		set_night(state.is_night())
	if state.is_tired() and not _was_tired:
		hud.toast("Mệt quá! Vào quán ăn gì đó hoặc về nhà nghỉ", HudGame.BAD)
	_was_tired = state.is_tired()
	_update_jump(delta)
	_update_cooking(delta)
	_update_customers(delta)
	_update_focus(delta)
	_goal_t -= delta
	if _goal_t <= 0.0:
		_goal_t = 0.4
		hud.set_goal(_goal())
	for w in walkers:
		_update_walker(w, delta)
	_update_bikes(delta)
	_update_pivot(clampf(delta * 10.0, 0.0, 1.0))
	_shot_tick()


func _jump() -> void:
	if jump_h > 0.0 or busy or hud.modal_open() or not cooking.is_empty() or sitting_seat != null:
		return
	if state.is_tired():
		hud.toast("Mệt quá, không nhảy nổi…", HudGame.BAD)
		return
	jump_v = JUMP_SPEED
	jump_h = 0.001
	hero.airborne = true


## Độ cao nhảy: bay lên, rơi xuống, chạm đất thì nhún.
func _update_jump(delta: float) -> void:
	if jump_h <= 0.0:
		return
	jump_v -= GRAVITY * delta
	jump_h += jump_v * delta
	if jump_h <= 0.0:
		jump_h = 0.0
		jump_v = 0.0
		hero.land()
	hero.position.y = (ROOM_Y if room != null else 0.0) + jump_h


func _move_hero(delta: float) -> void:
	var inp := Vector2(
		Input.get_axis("ui_left", "ui_right") + float(Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_A)),
		Input.get_axis("ui_up", "ui_down") + float(Input.is_physical_key_pressed(KEY_S)) - float(Input.is_physical_key_pressed(KEY_W)))
	hero.moving = inp.length() > 0.1
	if not hero.moving:
		return
	var f := -cam.global_transform.basis.z
	var r := cam.global_transform.basis.x
	var fwd := Vector2(f.x, f.z).normalized()
	var right := Vector2(r.x, r.z).normalized()
	var move := (right * inp.x - fwd * inp.y).normalized()
	hero.face_dir(move)
	var speed := WALK_SPEED
	if Input.is_physical_key_pressed(KEY_SHIFT) and not state.is_tired():
		speed = RUN_SPEED
	if state.is_tired():
		speed *= 0.65
	var old := flat(hero.position)
	var p := _slide(old + move * speed * delta, HERO_RADIUS)
	if _overlaps(p, HERO_RADIUS - 0.02):  # bị đẩy vào khối bên cạnh: đứng yên chứ không lọt vào trong
		p = old
	hero.position = Vector3(p.x, hero.position.y, p.y)


func _update_walker(w: Dictionary, delta: float) -> void:
	var c: Chibi = w["c"]
	if room == null and flat(c.position).distance_to(flat(hero.position)) < 2.6:
		# người chơi lại gần: đứng lại, quay sang nhìn để dễ bắt chuyện
		c.moving = false
		c.face_dir(flat(hero.position - c.position))
		w["wait"] = maxf(float(w["wait"]), 0.8)
	if w["wait"] > 0.0:
		w["wait"] -= delta
		c.moving = false
		return
	var p := flat(c.position)
	var d: Vector2 = w["target"] - p
	var a: Rect2 = w["area"]
	if d.length() < 0.2:
		w["target"] = Vector2(randf_range(a.position.x, a.end.x), randf_range(a.position.y, a.end.y))
		w["wait"] = randf_range(0.5, 3.0)
		c.moving = false
		return
	var np := p + d.normalized() * minf(float(w["speed"]) * delta, d.length())
	# nhường đường người chơi
	if room == null:
		var to_hero := np - flat(hero.position)
		if to_hero.length() < 0.75:
			np = flat(hero.position) + to_hero.normalized() * 0.75
	np = _slide_street(np, 0.25)
	if np.distance_to(p) < float(w["speed"]) * delta * 0.2:  # bị chặn: chọn đích khác
		w["target"] = Vector2(randf_range(a.position.x, a.end.x), randf_range(a.position.y, a.end.y))
	c.moving = true
	c.face_dir(np - p)
	c.position = Vector3(np.x, 0, np.y)


## Vòng tròn (p, r) có chạm khối nào không.
func _overlaps(p: Vector2, r: float) -> bool:
	var list: Array[Rect2] = solids if room == null else room["solids"]
	for s in list:
		var q := Vector2(clampf(p.x, s.position.x, s.end.x), clampf(p.y, s.position.y, s.end.y))
		if p.distance_to(q) < r:
			return true
	return false


## Như _slide nhưng luôn dùng khối ngoài phố (người đi đường không vào phòng).
func _slide_street(p: Vector2, r: float) -> Vector2:
	var saved = room
	room = null
	var out := _slide(p, r)
	room = saved
	return out


# ================================================================ bản đồ cho HUD
func _map_data() -> Dictionary:
	var shops: Array = []
	var markers: Array = []
	for m in shop_marks:
		shops.append({"title": m["shop"]["title"], "pos": flat(m["door"]), "own": m["own"]})
		if m["own"]:
			markers.append({"pos": flat(m["door"]), "color": Color("e2412f"), "text": "Phở Gánh"})
		if not state.errand.is_empty() and m["shop"]["title"] == state.errand["target_title"]:
			markers.append({"pos": flat(m["door"]), "color": Color("6ad0ff"), "text": "Giao " + String(state.errand["item"])})
	var sum := Vector2.ZERO
	var n := 0
	for s in sellers:
		if (s["pos"] as Vector3).x > 0:
			sum += flat(s["pos"])
			n += 1
	if n > 0:
		markers.append({"pos": sum / n, "color": HudGame.GOOD, "text": "Chợ"})
	var hp := flat(hero.position) if room == null else flat(room["mark"]["door"])
	var roads: Array = []
	for lane in data["lanes"]:
		var pts := PackedVector2Array()
		for p in lane:
			pts.append(flat(b2g(p[0], p[1])))
		roads.append(pts)
	return {"bounds": bounds, "solids": solids, "shops": shops, "markers": markers, "hero": hp, "roads": roads}


# ================================================================ chụp ảnh kiểm tra
func _shot_setup(args: PackedStringArray) -> void:
	for a in args:
		if a == "--own" or a == "--serve":
			for m in shop_marks:
				if m["own"]:
					_enter_now(m)
			if a == "--serve":
				for i in 3:
					_spawn_customer()
				for cu in customers:
					cu["path"] = []
				_update_customers(0.0)
				customers[0]["state"] = "wait"
				customers[0]["order"] = "pho_bo_tai"
				_set_carry("pho_bo_tai")
				hero.position = (customers[0]["seat"]["pos"] as Vector3) + Vector3(-1.2 * signf((customers[0]["seat"]["pos"] as Vector3).x - room["node"].position.x), 0, 0)
				pivot.position = hero.position + Vector3(0, 1.35, 0)
		elif a.begins_with("--enter="):
			for m in shop_marks:
				if String(m["shop"]["title"]).contains(a.substr(8)):
					_enter_now(m)
					break
		elif a.begins_with("--panel="):
			var k := a.substr(8)
			if k == "market":
				_open_market(sellers[1])
			elif k == "stove":
				_open_stove()
			elif k == "menu":
				_open_menu()
			else:
				hud.open_named(k)
		elif a.begins_with("--frame="):
			_shot_at = int(a.substr(8))
		elif a == "--jump":
			_shot_jump = true
		elif a == "--eat":  # cận cảnh khách đang ăn
			for m in shop_marks:
				if m["own"]:
					_enter_now(m)
			seed(7)
			var back: Array = room["seats"].filter(func(st): return float(st["face"]) > 90.0)
			for st in back:
				st["taken"] = true  # chỉ cho khách ngồi ghế quay mặt về camera
			_spawn_customer()
			for st in back:
				st["taken"] = false
			for cu in customers:
				cu["path"] = []
			_update_customers(0.0)
			for cu in customers:
				cu["state"] = "eat"
				cu["order"] = "pho_bo_tai"
				cu["t"] = 999.0
				_place_bowl(cu)
				(cu["c"] as Chibi).set_eating(true)
			var front: Array = customers.filter(func(cu): return float(cu["seat"]["face"]) < 90.0)
			var who: Dictionary = front[0] if not front.is_empty() else customers[0]
			hero.visible = false  # chỉ để camera nhìn thẳng mặt khách
			hero.position = (who["seat"]["pos"] as Vector3) + Vector3(0, -0.5, 0.4)
			pivot.position = hero.position + Vector3(0, 1.35, 0)
			yaw = 10.0
			arm_len = 2.6
			arm.spring_length = 2.6
			pitch = -24.0
		elif a == "--talk":
			for w in walkers:
				if w.has("errand"):
					_talk(w)
					break


func _shot_tick() -> void:
	if _shot_path == "":
		return
	_shot_frames += 1
	if _shot_jump and _shot_frames == _shot_at - 9:
		_jump()
	if _shot_frames == _shot_at:
		var img := get_viewport().get_texture().get_image()
		DirAccess.make_dir_recursive_absolute(_shot_path.get_base_dir())
		img.save_png(_shot_path)
		print("đã chụp ", _shot_path)
		get_tree().quit()
