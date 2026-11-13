extends Node3D
## Khu phố mẫu Phố Đèn Lồng (bản Godot): camera chéo isometric, nhà cửa và đồ đạc dựng
## bằng Blender (tools/blender/build_assets.py), nhân vật chibi, ngày/đêm, xe máy chạy.
##
## Trục: phố chạy theo X. Mặt đường z ∈ [-3.5, 3.5], vỉa hè tới ±6.5.
## Dãy bắc (z < -6.5) là mặt tiền đầy đủ; dãy nam (z > 6.5) là phòng cắt tường thấp
## để camera nhìn được vào trong.
##
## Tham số dòng lệnh (sau `--`): --shot=đường_dẫn.png  --day  --at=x,z  --zoom=số

const M := "res://assets/models/"
const FONT := preload("res://assets/fonts/NotoSans-Bold.ttf")
const STREET_SHADER := preload("res://shaders/spatial_env_street.gdshader")

const CAM_PITCH := -36.0
const CAM_YAW := 0.0
const CAM_FOV := 30.0
const HERO_SPEED := 4.2
const HERO_RADIUS := 0.25
const NORTH := -6.5  # mép trước dãy nhà phía bắc
const SOUTH := 6.5   # mép trước dãy nhà phía nam

var _scenes := {}
var solids: Array[Rect2] = []
## Khu vực có tên (quán, nhà, hẻm…): {name, rect, upper}
var zones: Array = []
var night_lights: Array[Light3D] = []
var swingers: Array[Node3D] = []
var walkers: Array = []
var bikes: Array = []
## Vật có thể che người chơi: {node, aabb, mode} — mode "squash" hạ thấp cả khối, "hide" ẩn hẳn
var occluders: Array = []
var night := false

var hero: Chibi
var cam: Camera3D
var sun: DirectionalLight3D
var env: Environment
var target = null
var hud_area: Label
var hud_clock: Label
## Khoảng cách camera tới người chơi (m), lăn chuột để đổi.
var cam_dist := 27.0

var _shot_path := ""
var _shot_frames := 0


func _ready() -> void:
	randomize()
	var args := OS.get_cmdline_user_args()
	var start := Vector2(-1.0, -4.4)
	for a in args:
		if a.begins_with("--shot="):
			_shot_path = a.substr(7)
		elif a == "--night":
			night = true
		elif a.begins_with("--at="):
			var p := a.substr(5).split(",")
			start = Vector2(float(p[0]), float(p[1]))
		elif a.begins_with("--zoom="):
			cam_dist = float(a.substr(7))
	build_environment()
	build_ground()
	build_north()
	build_south()
	build_street()
	build_people()
	dress_street()
	build_hud()
	hero = Chibi.new()
	add_child(hero)
	hero.setup({"shirt": "#e8573c", "pants": "#3c4f6b", "skin": "#ffd9b8", "hair": "#2b1a12", "hat": "nonla", "apron": true})
	hero.position = Vector3(start.x, 0, start.y)
	hero.facing = deg_to_rad(30)
	set_night(night)
	cam.global_position = _cam_pos()


# ================================================================ dựng cảnh: tiện ích
func model(name: String) -> Node3D:
	if not _scenes.has(name):
		_scenes[name] = load(M + name + ".glb")
	var n: Node3D = (_scenes[name] as PackedScene).instantiate()
	Toon.apply(n)
	return n


## Đặt một mô hình. solid: "" (không chặn), "all" (cả khối), hoặc các tiền tố tên mesh cách nhau bằng dấu phẩy.
func place(name: String, x: float, z: float, rot := 0.0, solid := "", y := 0.0, parent: Node = self) -> Node3D:
	var n := model(name)
	n.position = Vector3(x, y, z)
	n.rotation.y = deg_to_rad(rot)
	parent.add_child(n)
	if solid != "":
		add_solids(n, solid)
	return n


func add_solids(n: Node3D, filter: String, shrink := 0.0) -> void:
	var prefixes := filter.split(",")
	var merged := AABB()
	var first := true
	for c in n.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		var ab: AABB = mi.global_transform * mi.get_aabb()
		if filter == "all":
			merged = ab if first else merged.merge(ab)
			first = false
			continue
		for p in prefixes:
			if String(mi.name).begins_with(p) or String(mi.get_parent().name).begins_with(p):
				solids.append(Rect2(ab.position.x, ab.position.z, ab.size.x, ab.size.z))
				break
	if filter == "all" and not first:
		solids.append(Rect2(merged.position.x + shrink, merged.position.z + shrink,
			merged.size.x - shrink * 2.0, merged.size.z - shrink * 2.0))


func blocked(p: Vector2, r := HERO_RADIUS) -> bool:
	for s in solids:
		if p.x > s.position.x - r and p.x < s.end.x + r and p.y > s.position.y - r and p.y < s.end.y + r:
			return true
	return p.x < -29 or p.x > 52 or p.y < -26 or p.y > 9.5


func ground_box(x0: float, z0: float, x1: float, z1: float, kind: int, top := 0.0) -> void:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = Vector3(x1 - x0, 0.2, z1 - z0)
	mi.mesh = b
	var m := ShaderMaterial.new()
	m.shader = STREET_SHADER
	m.set_shader_parameter("surface_kind", kind)
	mi.material_override = m
	mi.position = Vector3((x0 + x1) / 2.0, top - 0.1, (z0 + z1) / 2.0)
	add_child(mi)


func flat_box(size: Vector3, pos: Vector3, color: String, emit := 0.0, outline := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.material_override = Toon.colored("flat", Color(color), emit, outline)
	mi.position = pos
	add_child(mi)
	return mi


func label(text: String, pos: Vector3, size := 72, color := "#ffe7a8", rot_y := 0.0, outline := "#3a1a10") -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font = FONT
	l.font_size = size
	l.pixel_size = 0.005
	l.modulate = Color(color)
	l.outline_modulate = Color(outline)
	l.outline_size = 14
	l.position = pos
	l.rotation.y = deg_to_rad(rot_y)
	l.shaded = false
	add_child(l)
	return l


func omni(pos: Vector3, color: String, energy := 2.0, rng := 7.0) -> OmniLight3D:
	var l := OmniLight3D.new()
	l.position = pos
	l.light_color = Color(color)
	l.light_energy = energy
	l.omni_range = rng
	l.omni_attenuation = 1.3
	add_child(l)
	night_lights.append(l)
	return l


## Dây (đèn lồng, dây điện) võng xuống giữa hai điểm.
func rope(a: Vector3, b: Vector3, sag: float, radius := 0.018, color := "#2a1a12") -> PackedVector3Array:
	var pts := PackedVector3Array()
	var n := 18
	for i in n + 1:
		var t := float(i) / n
		var p := a.lerp(b, t)
		p.y -= sag * 4.0 * t * (1.0 - t)
		pts.append(p)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in n:
		var p0 := pts[i]
		var p1 := pts[i + 1]
		var d := (p1 - p0).normalized()
		var s1 := d.cross(Vector3.UP).normalized() * radius
		var s2 := d.cross(s1).normalized() * radius
		var ring := [s1, s2, -s1, -s2]
		for k in 4:
			var o1: Vector3 = ring[k]
			var o2: Vector3 = ring[(k + 1) % 4]
			st.add_vertex(p0 + o1)
			st.add_vertex(p1 + o1)
			st.add_vertex(p1 + o2)
			st.add_vertex(p0 + o1)
			st.add_vertex(p1 + o2)
			st.add_vertex(p0 + o2)
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(color)
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mi.material_override = m
	add_child(mi)
	return pts


const LANTERN_COLORS := ["#e2412f", "#f2b84b", "#e85d9a", "#e2412f", "#2fae8f", "#ff8a3a"]


func lantern_at(p: Vector3, color: String) -> Node3D:
	var l := place("lantern", p.x, p.z, 0.0, "", p.y - 0.76)
	Toon.recolor(l, "LanternSilk", Color(color), 3.2)
	l.set_meta("seed", randf() * 6.0)
	swingers.append(l)
	return l


func lantern_string(a: Vector3, b: Vector3, sag: float, count: int, with_light := true) -> void:
	var pts := rope(a, b, sag)
	for i in count:
		var t := float(i + 1) / (count + 1)
		var idx := int(round(t * (pts.size() - 1)))
		lantern_at(pts[idx], LANTERN_COLORS[(i + int(a.x)) % LANTERN_COLORS.size()])
	if with_light:
		omni(pts[pts.size() / 2] + Vector3(0, -0.8, 0), "#ffb46a", 2.6, 8.0)


## Bàn ăn thấp + ghế nhựa + khách ngồi + tô phở.
func eat_table(x: float, z: float, stool := "stool_red", rot := 0.0, diners := 2) -> void:
	place("table_low", x, z, rot, "all")
	var seats := [Vector3(-0.22, 0, -0.62), Vector3(0.22, 0, 0.62), Vector3(-0.75, 0, 0.0), Vector3(0.75, 0, 0.0)]
	var faces := [0.0, 180.0, 90.0, -90.0]
	var rb := Basis(Vector3.UP, deg_to_rad(rot))
	for i in 4:
		var p: Vector3 = Vector3(x, 0, z) + rb * seats[i]
		place(stool, p.x, p.z, rot)
		if i < diners:
			var c := Chibi.new()
			add_child(c)
			c.setup({"sit": 0.32, "face": faces[i] + rot})
			c.position = p
	for bx in [-0.2, 0.2]:
		var bp: Vector3 = Vector3(x, 0.46, z) + rb * Vector3(bx, 0, 0)
		place("bowl", bp.x, bp.z, randf() * 360.0, "", bp.y)


## Biển hiệu đứng trên hai cột, ở mép vỉa hè trước một quán dãy nam.
func stand_sign(text: String, x: float, color: String) -> void:
	var z := SOUTH + 0.35
	var w := 0.35 + text.length() * 0.19
	flat_box(Vector3(w, 0.62, 0.08), Vector3(x, 2.05, z), color)
	for sx in [-1.0, 1.0]:
		flat_box(Vector3(0.08, 2.2, 0.08), Vector3(x + sx * (w / 2.0 - 0.15), 1.1, z), "#5b3a26")
	solids.append(Rect2(x - w / 2.0, z - 0.1, 0.2, 0.2))
	solids.append(Rect2(x + w / 2.0 - 0.2, z - 0.1, 0.2, 0.2))
	label(text, Vector3(x, 2.05, z + 0.05), 50)


## Đăng ký một vật có thể che người chơi (tính khung bao một lần lúc dựng cảnh).
func add_occluder(n: Node3D, mode: String) -> void:
	var box := AABB()
	var first := true
	for c in n.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		var ab: AABB = mi.global_transform * mi.get_aabb()
		box = ab if first else box.merge(ab)
		first = false
	if n is MeshInstance3D:
		box = n.global_transform * (n as MeshInstance3D).get_aabb()
		first = false
	if not first:
		occluders.append({"node": n, "aabb": box, "mode": mode})


## Tường bên phải và cột phải của quán mở mặt tiền: ẩn khi che người chơi đứng trong quán.
func add_wall_occluders(shop: Node3D) -> void:
	for c in shop.find_children("*", "MeshInstance3D", true, false):
		var nm := String(c.name)
		if nm.begins_with("WallR") or nm.begins_with("Pillar2"):
			add_occluder(c, "hide")


## Hạ tường: vật nào nằm giữa camera và người chơi thì hạ thấp (nhà) hoặc ẩn (tường quán).
func update_occluders(delta: float) -> void:
	var pts := [hero.position + Vector3(0, 0.4, 0), hero.position + Vector3(0, 1.1, 0)]
	for o in occluders:
		var ab: AABB = o["aabb"]
		var hit := false
		for p in pts:
			if ab.intersects_segment(cam.global_position, p + (cam.global_position - p).normalized() * 0.3):
				hit = true
				break
		var n: Node3D = o["node"]
		if o["mode"] == "hide":
			n.visible = not hit
		else:
			n.scale.y = lerpf(n.scale.y, 0.1 if hit else 1.0, clampf(delta * 8.0, 0.0, 1.0))


func person(x: float, z: float, o: Dictionary = {}) -> Chibi:
	var c := Chibi.new()
	add_child(c)
	c.setup(o)
	c.position = Vector3(x, 0, z)
	return c


func walker(area: Rect2, o: Dictionary = {}) -> void:
	var c := person(randf_range(area.position.x, area.end.x), randf_range(area.position.y, area.end.y), o)
	walkers.append({"c": c, "area": area, "target": Vector2(c.position.x, c.position.z), "wait": randf() * 2.0, "speed": randf_range(1.2, 1.9)})


func zone(name: String, x0: float, z0: float, x1: float, z1: float, upper: Node = null) -> void:
	zones.append({"name": name, "rect": Rect2(x0, z0, x1 - x0, z1 - z0), "upper": upper})


# ================================================================ môi trường, camera
func build_environment() -> void:
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_white = 6.0
	env.glow_enabled = true
	env.glow_intensity = 1.0
	env.glow_bloom = 0.08
	env.glow_hdr_threshold = 0.9
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.2
	env.adjustment_contrast = 1.05
	# bóng mềm ở góc khuất cho cảm giác tiểu cảnh
	env.ssao_enabled = true
	env.ssao_radius = 1.4
	env.ssao_intensity = 1.6
	env.ssao_power = 1.4
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52, 28, 0)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 70.0
	sun.shadow_blur = 1.5
	add_child(sun)

	cam = Camera3D.new()
	cam.projection = Camera3D.PROJECTION_PERSPECTIVE
	cam.fov = CAM_FOV
	cam.near = 0.1
	cam.far = 200.0
	cam.rotation_degrees = Vector3(CAM_PITCH, CAM_YAW, 0)
	# mờ xa và gần như ống kính chụp mô hình thu nhỏ
	var ca := CameraAttributesPractical.new()
	ca.dof_blur_far_enabled = true
	ca.dof_blur_far_distance = 40.0
	ca.dof_blur_far_transition = 12.0
	ca.dof_blur_near_enabled = true
	ca.dof_blur_near_distance = 14.0
	ca.dof_blur_near_transition = 6.0
	ca.dof_blur_amount = 0.06
	cam.attributes = ca
	add_child(cam)
	cam.make_current()


func set_night(on: bool) -> void:
	night = on
	if on:
		env.background_color = Color("0c1024")
		env.ambient_light_color = Color("3a4682")
		env.ambient_light_energy = 0.42
		sun.light_color = Color("7f90e0")
		sun.light_energy = 0.22
	else:
		env.background_color = Color("9fd3ee")
		env.ambient_light_color = Color("e6ecff")
		env.ambient_light_energy = 0.62
		sun.light_color = Color("fff3dc")
		sun.light_energy = 1.0
	for l in night_lights:
		l.visible = on
	if hud_clock:
		hud_clock.text = "🏮 19:40 · Thứ Hai" if on else "☀ 07:10 · Thứ Hai"


func _cam_pos() -> Vector3:
	var back := cam.global_transform.basis.z
	return hero.position + Vector3(0.0, 1.6, -2.6) + back * cam_dist


# ================================================================ mặt đất
func build_ground() -> void:
	ground_box(-60, -40, 75, 40, 4, -0.02)
	ground_box(-40, -3.5, 60, 3.5, 0)
	ground_box(-40, NORTH, 60, -3.5, 1)
	ground_box(-40, 3.5, 60, SOUTH, 1)
	ground_box(-40, SOUTH, 60, 10.0, 3, 0.005)   # quảng trường lát gạch phía gần
	ground_box(2.0, -24, 5.5, NORTH, 2, 0.005)   # hẻm
	# bó vỉa
	flat_box(Vector3(100, 0.14, 0.18), Vector3(10, 0.07, -3.5), "#c9c3b6")
	flat_box(Vector3(100, 0.14, 0.18), Vector3(10, 0.07, 3.5), "#c9c3b6")


# ================================================================ dãy phố (mọi cửa quay ra camera)
## Nhà ống có biển hiệu tầng trệt: [mô hình, x, rộng, màu tường, chữ biển, màu biển, mặt kính, đồ vỉa hè]
const HOUSES := [
	["house_3f_roof", -28.1, 3.6, "#f2c6b4", "TẠP HÓA CÔ BA", "#2f7fd2", true, "taphoa"],
	["house_4f", -17.1, 4.5, "#a9d6e5", "SỬA XE MÁY", "#e2412f", false, "suaxe"],
	["house_2f_roof", -12.4, 4.0, "#f6e3a1", "CẮT TÓC NAM", "#9466d6", true, "cattoc"],
	["house_3f", -8.2, 4.0, "#c7e3b5", "NHÀ THUỐC BÌNH AN", "#2fae8f", true, "thuoc"],
	["house_3f_roof", 28.6, 3.6, "#c9b6e4", "HOA TƯƠI", "#e85d9a", true, "hoa"],
	["house_4f", 32.4, 4.5, "#f6c79e", "ĐIỆN THOẠI · SIM", "#f2a541", true, "dienthoai"],
	["house_2f_roof", 43.3, 4.0, "#b5e0d0", "TIỆM VÀNG KIM PHÁT", "#c0392b", true, "vang"],
	["house_3f", 47.5, 4.0, "#f3d27a", "GẠO NGON MIỀN TÂY", "#6aa84f", false, "gao"],
]
const TANK_TOP := {"house_3f": 9.6, "house_4f": 12.8}


func house(name: String, x: float, color: String, floors_top: float, w: float) -> Node3D:
	var h := place(name, x, NORTH, 0.0, "Shell")
	Toon.recolor(h, "Facade", Color(color))
	place("ac_unit", w * 0.72, 0.05, 0.0, "", 4.6, h)
	if floors_top > 0.0:
		place("water_tank", w * 0.5, -6.0, 0.0, "", floors_top, h)
	add_occluder(h, "squash")
	return h


## Quán mở mặt tiền (vào được). colors: awning, sign, wall, floor, facade.
func open_shop(model_name: String, x0: float, w: float, title: String, colors: Dictionary) -> Node3D:
	var n := place(model_name, x0, NORTH, 0.0, "WallL,WallR,WallBack,Pillar")
	add_wall_occluders(n)
	var keys := {"awning": "Awning", "sign": "Sign", "wall": "ShopWall", "floor": "ShopFloor", "facade": "Facade"}
	for k in colors:
		Toon.recolor(n, keys[k], Color(colors[k]))
	# biển tên gắn trên mép mái hiên để không bị ban công che
	var sign_col: String = colors.get("sign", colors.get("awning", "#c0392b"))
	flat_box(Vector3(w - 1.0, 0.56, 0.06), Vector3(x0 + w / 2.0, 2.66, NORTH + 1.3), sign_col)
	label(title, Vector3(x0 + w / 2.0, 2.66, NORTH + 1.35), 60 if title.length() < 18 else 50)
	zone(title.capitalize(), x0, NORTH - 8.0, x0 + w, NORTH, n.find_child("Upper", true, false))
	omni(Vector3(x0 + w / 2.0, 2.4, -10.0), "#ffcf8a", 3.0, 8.0)
	return n


func build_north() -> void:
	for h in HOUSES:
		house(h[0], h[1], h[3], TANK_TOP.get(h[0], 0.0), h[2])

	# --- xưởng gốm Bát Tràng
	var x0 := -24.3
	open_shop("shop_open_7", x0, 7.0, "XƯỞNG GỐM BÁT TRÀNG",
		{"awning": "#2d5fa8", "sign": "#1f3f75", "wall": "#ead2b0", "floor": "#c9a27e", "facade": "#e9d7b3"})
	place("kiln", x0 + 1.3, -13.3, 0.0, "all")
	place("shelf", x0 + 4.6, -14.05, 0.0, "all")
	for xx in [x0 + 3.9, x0 + 4.6, x0 + 5.3]:
		for y in [0.1, 0.75, 1.4]:
			place("vase", xx, -14.05, randf() * 360.0, "", y)
	for wx in [x0 + 2.4, x0 + 4.6]:
		place("potter_wheel", wx, -10.6, 0.0, "all")
		place("stool_red", wx, -11.2, 0.0)
		person(wx, -11.2, {"sit": 0.32, "face": 0, "apron": true, "shirt": "#8a5a3a"})
	place("table_low", x0 + 3.5, -7.6, 0.0, "all")
	for i in 3:
		place("vase", x0 + 3.2 + i * 0.3, -7.6, 0.0, "", 0.46)
	walker(Rect2(x0 + 1.0, -9.6, 5.0, 1.5), {"hat": "nonla"})

	# --- quán phở
	x0 = -4.0
	open_shop("shop_open_6", x0, 6.0, "PHỞ GÁNH ĐẦU NGÕ", {"awning": "#c0392b", "facade": "#f0c96b"})
	place("counter", x0 + 1.6, -13.3, 0.0, "all")
	place("pot_big", x0 + 3.7, -13.6, 0.0, "all")
	place("altar", x0 + 4.9, -14.25, 0.0)
	place("fan", x0 + 5.5, -8.2, -150.0, "all")
	eat_table(x0 + 1.4, -9.2, "stool_red", 0.0, 2)
	eat_table(x0 + 4.3, -9.4, "stool_red", 0.0, 3)
	eat_table(x0 + 1.4, -11.5, "stool_red", 0.0, 1)
	for i in 3:
		place("bowl", x0 + 0.8 + i * 0.25, -13.25, 0.0, "", 0.93)
	person(x0 + 1.6, -14.0, {"shirt": "#f5f0e6", "hat": "khan", "apron": true, "face": 0})
	for i in 3:
		lantern_at(Vector3(x0 + 1.0 + i * 1.8, 2.8, -10.5), LANTERN_COLORS[i])
	label("Phở bò tái 45k · Phở gà 40k · Phở cuốn 50k", Vector3(x0 + 3.0, 2.2, -14.27), 30, "#fff3dc")
	walker(Rect2(x0 + 0.6, -12.4, 4.8, 0.6), {"shirt": "#2fae8f", "apron": true, "hat": "khan"})

	# --- hẻm 12
	solids.append(Rect2(1.9, -24, 0.1, 17.5))
	solids.append(Rect2(5.5, -24, 0.1, 6.0))
	place("alley_gate", 2.45, NORTH, 0.0, "GatePost,Post")
	label("HẺM 12", Vector3(3.72, 3.42, NORTH + 0.23), 60)
	place("clothes_line", 3.75, -11.0, 90.0)
	place("plant_pot", 2.4, -8.6, 0.0, "all")
	place("plant_pot", 5.1, -13.0, 0.0, "all")
	place("bench_stone", 2.45, -12.8, 90.0, "all")
	person(2.45, -12.4, {"sit": 0.46, "face": 90, "hair": "#cccccc", "shirt": "#9466d6"})
	var mb := place("motorbike", 4.6, -15.5, 90.0, "all")
	Toon.recolor(mb, "BikeBody", Color("3f8fd2"))
	flat_box(Vector3(3.6, 2.4, 0.3), Vector3(3.75, 1.2, -18.2), "#e9d7b3")
	solids.append(Rect2(2.0, -18.4, 3.5, 0.4))
	lantern_string(Vector3(2.0, 3.6, -9.0), Vector3(5.5, 3.6, -9.0), 0.3, 3, false)
	lantern_string(Vector3(2.0, 3.6, -13.5), Vector3(5.5, 3.6, -13.5), 0.3, 3)
	walker(Rect2(2.4, -17.0, 2.6, 9.5), {"size": 0.75})
	zone("Hẻm 12", 2.0, -18.0, 5.5, NORTH)

	# --- đồn công an phường
	var station := place("police_station", 5.6, NORTH, 0.0, "Shell,FenceBase,GatePost,Booth,Base,Steps")
	label("CÔNG AN PHƯỜNG ĐÈN LỒNG", Vector3(9.6, 6.45, NORTH - 2.28), 58, "#ffe27a").reparent(station)
	add_occluder(station, "squash")
	place("flag_pole", 7.0, -7.6, 0.0, "Base,Pole")
	var pb := place("motorbike", 11.5, -7.7, 0.0, "all")
	Toon.recolor(pb, "BikeBody", Color("f5f0e6"))
	person(9.7, -6.1, {"shirt": "#5f7f45", "pants": "#4d6b3a", "hat": "police", "face": 0})
	person(12.5, -7.6, {"shirt": "#5f7f45", "pants": "#4d6b3a", "hat": "police", "face": -20})
	zone("Công an phường", 5.6, -18.0, 13.6, NORTH)

	# --- cà phê trứng
	x0 = 14.0
	open_shop("shop_open_7", x0, 7.0, "CÀ PHÊ TRỨNG GÁC MÁI",
		{"awning": "#2a9d8f", "sign": "#1f6f66", "wall": "#f6e3c3", "floor": "#8a5a3a", "facade": "#e8b4a0"})
	place("coffee_bar", x0 + 3.5, -13.5, 0.0, "all")
	person(x0 + 3.5, -14.1, {"shirt": "#3a2a22", "apron": true, "face": 0})
	place("bookshelf", x0 + 6.2, -11.5, -90.0, "all")
	for tp in [Vector2(x0 + 1.8, -9.0), Vector2(x0 + 4.6, -9.0), Vector2(x0 + 2.8, -11.4)]:
		place("round_table", tp.x, tp.y, 0.0, "all")
		place("armchair", tp.x - 0.85, tp.y, 90.0, "all")
		place("armchair", tp.x + 0.85, tp.y, -90.0, "all")
		person(tp.x - 0.85, tp.y, {"sit": 0.42, "face": 90})
		if randf() < 0.7:
			person(tp.x + 0.85, tp.y, {"sit": 0.42, "face": -90})
	for i in 4:
		lantern_at(Vector3(x0 + 1.5 + i * 1.5, 2.8, -11.0), ["#f2b84b", "#e2412f", "#f2b84b", "#e85d9a"][i])
	for i in 4:
		place("stool_blue", x0 + 1.0 + i * 0.9, -4.6, 0.0)
		person(x0 + 1.0 + i * 0.9, -4.6, {"sit": 0.32, "face": 180 if i % 2 else 160})

	# --- bún chả than hồng
	x0 = 21.4
	open_shop("shop_open_7", x0, 7.0, "BÚN CHẢ THAN HỒNG",
		{"awning": "#e8573c", "sign": "#9b2d20", "wall": "#f2c6b4", "floor": "#b5653a", "facade": "#f6e3a1"})
	place("grill", x0 + 3.5, -13.5, 0.0, "all")
	person(x0 + 3.5, -14.1, {"face": 0, "apron": true, "hat": "khan", "hat_color": "#3d4a5c"})
	_smoke(Vector3(x0 + 3.5, 0.9, -13.5))
	omni(Vector3(x0 + 3.5, 1.4, -13.0), "#ff7a2a", 3.0, 5.0)
	for tz in [-9.0, -11.3]:
		place("long_table", x0 + 3.5, tz, 0.0, "Top,Bench")
		for i in 3:
			if randf() < 0.8:
				person(x0 + 2.7 + i * 0.8, tz + 0.75, {"sit": 0.44, "face": 180})
			if randf() < 0.8:
				person(x0 + 2.7 + i * 0.8, tz - 0.75, {"sit": 0.44, "face": 0})
			place("bowl", x0 + 2.7 + i * 0.8, tz, 0.0, "", 0.74)

	# --- chè ba miền
	x0 = 37.1
	open_shop("shop_open_6", x0, 6.0, "CHÈ BA MIỀN",
		{"awning": "#e85d9a", "sign": "#b83b78", "wall": "#fff3dc", "floor": "#f6c7d0", "facade": "#d8e6f2"})
	place("jar_counter", x0 + 3.0, -13.4, 0.0, "all")
	person(x0 + 3.0, -14.05, {"face": 0, "shirt": "#e85d9a", "apron": true, "long": true})
	eat_table(x0 + 1.5, -9.4, "stool_blue", 0.0, 3)
	eat_table(x0 + 4.3, -10.6, "stool_blue", 0.0, 2)
	eat_table(x0 + 3.0, -5.0, "stool_blue", 90.0, 2)


func _smoke(pos: Vector3) -> void:
	var smoke := CPUParticles3D.new()
	smoke.position = pos
	smoke.amount = 26
	smoke.lifetime = 2.6
	smoke.direction = Vector3.UP
	smoke.spread = 18.0
	smoke.gravity = Vector3(0.3, 0.6, 0)
	smoke.initial_velocity_min = 0.6
	smoke.initial_velocity_max = 1.0
	smoke.scale_amount_min = 0.25
	smoke.scale_amount_max = 0.6
	var sm := SphereMesh.new()
	sm.radius = 0.25
	sm.height = 0.5
	var smat := StandardMaterial3D.new()
	smat.albedo_color = Color(0.92, 0.92, 0.95, 0.35)
	smat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	smat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.material = smat
	smoke.mesh = sm
	add_child(smoke)


## Phía gần camera: không có nhà (để không che, không quay lưng), chỉ vỉa hè và quảng trường nhỏ.
func build_south() -> void:
	# xe hàng rong: người bán đứng phía phố, quay mặt ra camera
	place("banh_mi_cart", -6.0, 5.0, 0.0, "all")
	person(-6.0, 4.2, {"hat": "nonla", "shirt": "#6aa84f", "face": 0}).waving = true
	place("fruit_cart", 9.0, 5.0, 0.0, "all")
	person(9.0, 4.2, {"hat": "nonla", "shirt": "#e85d9a", "face": 0})
	place("fruit_cart", 30.0, 5.1, 0.0, "all")
	person(30.0, 4.3, {"hat": "nonla", "shirt": "#f2a541", "face": 0, "long": true})
	# quảng trường: cây đa, ghế đá, cờ tướng
	place("banyan", -15.0, 8.6, 0.0)
	solids.append(Rect2(-15.7, 7.9, 1.4, 1.4))
	place("bench_stone", -18.0, 8.0, 0.0, "all")
	person(-18.3, 8.0, {"sit": 0.46, "face": 0, "hair": "#cccccc"})
	person(-17.6, 8.0, {"sit": 0.46, "face": 0, "shirt": "#e85d9a"})
	place("table_low", -11.6, 7.6, 0.0, "all")
	place("stool_red", -12.4, 7.6, 0.0)
	place("stool_red", -10.8, 7.6, 0.0)
	person(-12.4, 7.6, {"sit": 0.32, "face": 90, "shirt": "#f5f0e6", "hair": "#d8d8d8"})
	person(-10.8, 7.6, {"sit": 0.32, "face": -90, "shirt": "#6aa84f", "hair": "#bbbbbb"})
	person(-11.6, 8.4, {"face": 180, "shirt": "#f2a541"})
	for bx in [16.0, 40.0]:
		place("bench_stone", bx, 8.2, 0.0, "all")
		person(bx - 0.3, 8.2, {"sit": 0.46, "face": 0})
	for hx in [-24.0, -2.0, 20.0, 35.0, 46.0]:
		place("hedge_planter", hx, 9.2, 0.0, "all")
	for i in 4:
		walker(Rect2(-22.0, 6.8, 18.0, 2.4), {"size": 0.75})
	zone("Quảng trường cây đa", -20.0, SOUTH, -9.0, 10.0)


# ================================================================ phố: cột điện, đèn, cây, đèn lồng, xe máy
func build_street() -> void:
	var poles := []
	for x in range(-34, 56, 10):
		place("power_pole", x, -4.1, 0.0, "Pole")
		poles.append(float(x))
	# dây điện chằng chịt
	for i in poles.size() - 1:
		var a: float = poles[i]
		var b: float = poles[i + 1]
		for k in 3:
			rope(Vector3(a - 0.8 + k * 0.8, 6.7, -4.1), Vector3(b - 0.8 + k * 0.8, 6.7, -4.1), 0.5 + k * 0.15, 0.015)
		rope(Vector3(a, 5.6, -4.1), Vector3(b, 5.9, -4.1), 0.7, 0.02)
		rope(Vector3(a + 0.6, 6.0, -4.1), Vector3(a + 2.5, 5.5, NORTH - 0.1), 0.3, 0.012)
	for x in [-29.0, -19.0, -9.0, 6.0, 16.5, 27.0, 41.0, 51.0]:
		place("street_lamp", x, -3.75, 0.0, "Pole")
		omni(Vector3(x, 4.2, -2.6), "#fff0c8", 3.0, 9.0)
	for x in [-22.0, -9.0, 1.5, 12.5, 22.0, 33.0, 43.5]:
		place("tree", x, 5.4, randf() * 360.0, "Planter")
	# dây đèn lồng giăng ngang phố (cọc tre phía nam)
	# dây đèn lồng giăng dọc trước dãy quán, nối các cột điện
	for i in poles.size() - 1:
		lantern_string(Vector3(poles[i] + 0.2, 4.9, -4.0), Vector3(poles[i + 1] - 0.2, 4.9, -4.0), 0.7, 7)
	# xe máy đỗ trên vỉa hè
	var bike_cols := ["#e8573c", "#3f8fd2", "#f5f0e6", "#f2a541", "#2fae8f", "#1d3557", "#e85d9a"]
	for x in [-27.0, -26.1, -16.2, -15.3, -7.4, 29.5, 30.4, 33.2, 34.1, 44.5, 48.0, 48.9]:
		var b := place("motorbike", x, -5.3, 90.0 + randf_range(-8, 8), "all")
		Toon.recolor(b, "BikeBody", Color(bike_cols.pick_random()))
	for x in [-28.0, -27.1, 11.0, 11.9, 24.0, 24.9, 25.8, 50.0]:
		var b := place("motorbike", x, 5.5, 90.0 + randf_range(-8, 8), "all")
		Toon.recolor(b, "BikeBody", Color(bike_cols.pick_random()))
	# xe máy chạy
	for i in 16:
		var dir := 1.0 if i % 2 == 0 else -1.0
		var b := place("motorbike", randf_range(-36, 58), (1.2 + (i % 4) * 0.35) * dir, 0.0 if dir > 0 else 180.0)
		Toon.recolor(b, "BikeBody", Color(bike_cols.pick_random()))
		var rider := Chibi.new()
		b.add_child(rider)
		rider.setup({"sit": 0.66, "face": 90, "hat": "helmet", "hat_color": ["#f2b84b", "#e85d9a", "#3f8fd2", "#f5f0e6", "#e2412f"].pick_random()})
		rider.position = Vector3(-0.15, 0, 0)
		if randf() < 0.45:
			var p2 := Chibi.new()
			b.add_child(p2)
			p2.setup({"sit": 0.7, "face": 90, "hat": "helmet", "long": true})
			p2.position = Vector3(-0.5, 0, 0)
		rider.facing = deg_to_rad(90)
		omni(Vector3(0.9, 0.8, 0), "#fff6c8", 1.5, 4.0).reparent(b, false)
		bikes.append({"n": b, "dir": dir, "speed": randf_range(5.0, 8.5)})


func umbrella(x: float, z: float, color: String) -> void:
	var u := place("patio_umbrella", x, z, randf() * 45.0, "Base")
	Toon.recolor(u, "UmbrellaCloth", Color(color))


func aframe(x: float, z: float, color: String, rot := 0.0) -> void:
	var a := place("aframe_sign", x, z, rot, "all")
	Toon.recolor(a, "SignFace", Color(color))


## Vỉa hè đông đúc trước từng nhà, tuỳ nghề: biển hiệu, mặt kính, dù, chậu cây, thùng hàng…
func dress_street() -> void:
	for h in HOUSES:
		var x: float = h[1]
		var w: float = h[2]
		var txt: String = h[4]
		flat_box(Vector3(w - 0.25, 0.62, 0.12), Vector3(x + w / 2.0, 2.66, NORTH + 0.1), h[5])
		label(txt, Vector3(x + w / 2.0, 2.66, NORTH + 0.17), 58 if txt.length() < 13 else 46)
		if h[6]:
			place("glass_shopfront", x + (w - 3.0) / 2.0, NORTH + 0.05, 0.0, "", 0.0)
		var c := x + w / 2.0
		match h[7]:
			"taphoa":
				place("carton", c - 1.2, -6.0, 10.0, "all")
				place("basin_stack", c + 1.3, -6.1, 0.0, "all")
				place("crate", c + 0.5, -6.1, 0.0, "all")
				aframe(c - 0.3, -5.2, h[5], 20.0)
				person(c + 0.2, -5.5, {"hat": "nonla", "face": 0, "shirt": "#f2a541", "long": true})
			"suaxe":
				for i in 2:
					var b := place("motorbike", c - 1.0 + i * 1.8, -5.8, 180.0, "all")
					Toon.recolor(b, "BikeBody", Color(["#1d3557", "#e8573c"][i]))
				person(c + 0.2, -5.0, {"sit": 0.15, "face": 0, "shirt": "#3c4f6b", "hat": "khan", "hat_color": "#3d4a5c"})
				place("carton", c + 1.8, -6.1, 0.0, "all")
			"cattoc":
				place("topiary", c - 1.6, -6.1, 0.0, "all")
				place("topiary", c + 1.6, -6.1, 0.0, "all")
				aframe(c, -5.3, h[5], -15.0)
			"thuoc":
				place("hedge_planter", c - 1.1, -6.15, 0.0, "all")
				place("hedge_planter", c + 1.1, -6.15, 0.0, "all")
			"hoa":
				for i in 5:
					place("plant_pot", c - 1.4 + i * 0.6, -6.1 + (i % 2) * 0.35, 0.0, "all")
				person(c, -5.2, {"face": 0, "shirt": "#e85d9a", "long": true, "bun": true})
			"dienthoai":
				umbrella(c - 1.2, -5.3, h[5])
				aframe(c + 1.4, -5.4, h[5], 25.0)
			"vang":
				place("topiary", c - 1.6, -6.1, 0.0, "all")
				place("topiary", c + 1.6, -6.1, 0.0, "all")
			"gao":
				for i in 3:
					place("crate", c - 1.2 + i * 0.7, -6.05, 0.0, "all")
				place("basin_stack", c + 1.5, -6.0, 0.0, "all")
				person(c + 0.6, -5.3, {"hat": "nonla", "face": 0})
	# bàn ghế, dù trước các quán ăn
	eat_table(-2.4, -5.0, "stool_red", 90.0, 2)
	umbrella(-0.6, -5.0, "#e2412f")
	aframe(-3.6, -5.4, "#c0392b", 15.0)
	umbrella(15.4, -5.7, "#2a9d8f")
	umbrella(18.6, -5.7, "#f5f0e6")
	eat_table(23.4, -5.0, "stool_red", 90.0, 2)
	eat_table(26.4, -5.0, "stool_red", 90.0, 2)
	umbrella(24.9, -5.3, "#f2b84b")
	umbrella(40.0, -5.6, "#e85d9a")
	aframe(-17.8, -5.4, "#2d5fa8", 15.0)
	# đồn công an: cột loa phường + camera
	place("loud_pole", 13.3, -3.95, 0.0, "Pole")
	# xe giao hàng có thùng đỏ
	for x in [-6.9, 9.0, 36.0]:
		var db := place("motorbike", x, -3.9, 0.0, "all")
		Toon.recolor(db, "BikeBody", Color("f5f0e6"))
		place("delivery_box", -0.45, 0.0, 0.0, "", 0.66, db)
	# phía gần: trạm xe buýt, thùng hàng thanh lý
	place("bus_stop", 19.0, 5.3, 0.0, "Pole,Bench")
	label("TRẠM XE BUÝT", Vector3(19.6, 2.9, 5.35), 40, "#ffffff")
	person(19.8, 5.2, {"sit": 0.46, "face": 0})
	person(20.4, 5.2, {"sit": 0.46, "face": 0, "long": true, "shirt": "#e85d9a"})
	place("carton", 2.0, 5.6, 0.0, "all")
	label("HÀNG THANH LÝ", Vector3(2.0, 1.1, 5.95), 36, "#ffe27a")


func build_people() -> void:
	for i in 22:
		walker(Rect2(-28, -6.2, 79, 2.3), {"hat": "nonla" if randf() < 0.2 else "", "long": randf() < 0.4})
	for i in 14:
		walker(Rect2(-28, 3.9, 79, 2.4), {"hat": "nonla" if randf() < 0.3 else "", "size": 0.75 if randf() < 0.25 else 1.0})


# ================================================================ HUD
const HUD_RED := Color("c0392b")
const HUD_CREAM := Color("fff3dc")
const HUD_INK := Color("3a1a10")


func _style(bg: Color, border: Color, radius: int, bw := 3) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(bw)
	sb.set_corner_radius_all(radius)
	sb.shadow_color = Color(0, 0, 0, 0.35)
	sb.shadow_size = 4
	sb.shadow_offset = Vector2(0, 3)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	sb.content_margin_top = 4
	sb.content_margin_bottom = 4
	return sb


func _ls(size: int, color := HUD_CREAM, outline := 6) -> LabelSettings:
	var ls := LabelSettings.new()
	ls.font = FONT
	ls.font_size = size
	ls.font_color = color
	ls.outline_size = outline
	ls.outline_color = HUD_INK
	return ls


func _text(parent: Control, txt: String, size: int, color := HUD_CREAM, outline := 6) -> Label:
	var l := Label.new()
	l.text = txt
	l.label_settings = _ls(size, color, outline)
	parent.add_child(l)
	return l


## Nút tròn có biểu tượng và chữ nhỏ bên dưới (như thanh nút trên cùng của game web).
func _round_button(parent: Control, icon: String, caption: String, bg := Color("f2b84b")) -> void:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", -2)
	parent.add_child(box)
	var p := PanelContainer.new()
	p.custom_minimum_size = Vector2(54, 54)
	p.add_theme_stylebox_override("panel", _style(bg, HUD_CREAM, 27, 3))
	box.add_child(p)
	var ic := _text(p, icon, 26, Color.WHITE, 0)
	ic.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ic.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var cap := _text(box, caption, 13)
	cap.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER


func build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(root)

	# --- thẻ người chơi (góc trên trái): avatar tròn, cấp, tên, tiền, danh tiếng
	var card := HBoxContainer.new()
	card.position = Vector2(14, 12)
	card.add_theme_constant_override("separation", 8)
	root.add_child(card)
	var avatar := PanelContainer.new()
	avatar.custom_minimum_size = Vector2(76, 76)
	avatar.add_theme_stylebox_override("panel", _style(Color("ffd9b8"), HUD_RED, 38, 4))
	card.add_child(avatar)
	var face := _text(avatar, "🧑‍🍳", 40, Color.WHITE, 0)
	face.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	face.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var info := VBoxContainer.new()
	info.add_theme_constant_override("separation", 2)
	card.add_child(info)
	var name_row := HBoxContainer.new()
	info.add_child(name_row)
	var lv := PanelContainer.new()
	lv.add_theme_stylebox_override("panel", _style(Color("3f8fd2"), HUD_CREAM, 10, 2))
	name_row.add_child(lv)
	_text(lv, "Cấp 12", 15)
	_text(name_row, "  Chủ quán Phở", 19)
	var money := PanelContainer.new()
	money.add_theme_stylebox_override("panel", _style(Color(0.1, 0.06, 0.04, 0.7), Color("f2b84b"), 12, 2))
	info.add_child(money)
	_text(money, "💰 20.286.000đ    ⭐ 4,6", 16, Color("ffe27a"))
	var bar := ProgressBar.new()
	bar.custom_minimum_size = Vector2(210, 12)
	bar.value = 68
	bar.show_percentage = false
	bar.add_theme_stylebox_override("background", _style(Color(0.1, 0.06, 0.04, 0.7), HUD_CREAM, 6, 1))
	bar.add_theme_stylebox_override("fill", _style(Color("6aa84f"), Color("6aa84f"), 6, 0))
	info.add_child(bar)

	# --- tên khu vực, ngay dưới thẻ người chơi
	var area_box := PanelContainer.new()
	area_box.position = Vector2(14, 100)
	area_box.add_theme_stylebox_override("panel", _style(HUD_RED, HUD_CREAM, 14, 3))
	root.add_child(area_box)
	hud_area = _text(area_box, "", 17)

	# --- đồng hồ (giữa trên)
	var clock_box := PanelContainer.new()
	clock_box.anchor_left = 0.5
	clock_box.anchor_right = 0.5
	clock_box.offset_left = -95
	clock_box.offset_right = 95
	clock_box.offset_top = 12
	clock_box.add_theme_stylebox_override("panel", _style(HUD_CREAM, Color("e8b67a"), 16, 3))
	root.add_child(clock_box)
	hud_clock = _text(clock_box, "", 18, HUD_INK, 0)
	hud_clock.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

	# --- hàng nút tròn (góc trên phải)
	var buttons := HBoxContainer.new()
	buttons.anchor_left = 1.0
	buttons.anchor_right = 1.0
	buttons.offset_left = -400
	buttons.offset_right = -14
	buttons.offset_top = 10
	buttons.alignment = BoxContainer.ALIGNMENT_END
	buttons.add_theme_constant_override("separation", 8)
	root.add_child(buttons)
	_round_button(buttons, "📜", "Nhiệm vụ", Color("e8573c"))
	_round_button(buttons, "🎒", "Túi đồ", Color("f2a541"))
	_round_button(buttons, "🛒", "Đi chợ", Color("6aa84f"))
	_round_button(buttons, "🗺", "Bản đồ", Color("3f8fd2"))
	_round_button(buttons, "⚙", "Cài đặt", Color("8a8f96"))

	# --- nút lớn góc dưới phải
	var home := VBoxContainer.new()
	home.anchor_left = 1.0
	home.anchor_right = 1.0
	home.anchor_top = 1.0
	home.anchor_bottom = 1.0
	home.offset_left = -104
	home.offset_right = -18
	home.offset_top = -112
	home.offset_bottom = -14
	root.add_child(home)
	var hb := PanelContainer.new()
	hb.custom_minimum_size = Vector2(76, 76)
	hb.add_theme_stylebox_override("panel", _style(Color("fff8ec"), HUD_RED, 18, 4))
	home.add_child(hb)
	var hi := _text(hb, "🏠", 40, Color.WHITE, 0)
	hi.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hi.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var hc := _text(home, "Về quán", 15)
	hc.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

	# --- gợi ý điều khiển (góc dưới trái)
	var hint := _text(root, "WASD / mũi tên: đi · Chuột trái: bấm để đi · N: ngày/đêm · Lăn chuột: gần/xa", 14)
	hint.anchor_top = 1.0
	hint.anchor_bottom = 1.0
	hint.offset_top = -30
	hint.offset_left = 16


# ================================================================ vòng lặp
func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo and e.keycode == KEY_N:
		set_night(not night)
	elif e is InputEventMouseButton and e.pressed:
		if e.button_index == MOUSE_BUTTON_LEFT:
			var from := cam.project_ray_origin(e.position)
			var dir := cam.project_ray_normal(e.position)
			if absf(dir.y) > 0.001:
				var hit := from + dir * (-from.y / dir.y)
				target = Vector2(hit.x, hit.z)
		elif e.button_index == MOUSE_BUTTON_WHEEL_UP:
			cam_dist = clampf(cam_dist - 2.0, 14.0, 60.0)
		elif e.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			cam_dist = clampf(cam_dist + 2.0, 14.0, 60.0)


func _process(delta: float) -> void:
	var t := Time.get_ticks_msec() / 1000.0
	_move_hero(delta)
	for w in walkers:
		_update_walker(w, delta)
	for b in bikes:
		var n: Node3D = b["n"]
		n.position.x += b["dir"] * b["speed"] * delta
		if n.position.x > 58.0:
			n.position.x = -36.0
		elif n.position.x < -36.0:
			n.position.x = 58.0
	for s in swingers:
		s.rotation.z = sin(t * 1.6 + float(s.get_meta("seed"))) * 0.08
		s.rotation.x = sin(t * 1.2 + float(s.get_meta("seed")) * 1.7) * 0.05

	# ẩn tầng trên của quán khi người chơi bước vào
	var hp := Vector2(hero.position.x, hero.position.z)
	var area := "Phố Đèn Lồng · Ngõ Phố Cổ"
	for z in zones:
		var inside: bool = (z["rect"] as Rect2).has_point(hp)
		if inside:
			area = z["name"]
		if z["upper"] != null:
			(z["upper"] as Node3D).visible = not inside
	hud_area.text = "📍 " + area
	update_occluders(delta)

	cam.global_position = cam.global_position.lerp(_cam_pos(), clampf(delta * 6.0, 0.0, 1.0))

	if _shot_path != "":
		_shot_frames += 1
		if _shot_frames == 45:
			cam.global_position = _cam_pos()
		if _shot_frames == 50:
			var img := get_viewport().get_texture().get_image()
			DirAccess.make_dir_recursive_absolute(_shot_path.get_base_dir())
			img.save_png(_shot_path)
			print("đã chụp ", _shot_path)
			get_tree().quit()


func _move_hero(delta: float) -> void:
	var inp := Vector2(
		Input.get_axis("ui_left", "ui_right") + float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A)),
		Input.get_axis("ui_up", "ui_down") + float(Input.is_key_pressed(KEY_S)) - float(Input.is_key_pressed(KEY_W)))
	var move := Vector2.ZERO
	if inp.length() > 0.1:
		target = null
		# hướng màn hình → mặt đất, theo góc quay camera
		var right := cam.global_transform.basis.x
		var fwd := -cam.global_transform.basis.z
		var r2 := Vector2(right.x, right.z).normalized()
		var f2 := Vector2(fwd.x, fwd.z).normalized()
		move = (r2 * inp.x - f2 * inp.y).normalized()
	elif target != null:
		var d: Vector2 = target - Vector2(hero.position.x, hero.position.z)
		if d.length() < 0.1:
			target = null
		else:
			move = d.normalized()
	hero.moving = move != Vector2.ZERO
	if not hero.moving:
		return
	hero.face_dir(move)
	var p := Vector2(hero.position.x, hero.position.z)
	var step := move * HERO_SPEED * delta
	var moved := false
	if not blocked(Vector2(p.x + step.x, p.y)):
		p.x += step.x
		moved = true
	if not blocked(Vector2(p.x, p.y + step.y)):
		p.y += step.y
		moved = true
	if not moved:
		target = null
	hero.position = Vector3(p.x, 0, p.y)


func _update_walker(w: Dictionary, delta: float) -> void:
	var c: Chibi = w["c"]
	if w["wait"] > 0.0:
		w["wait"] -= delta
		c.moving = false
		return
	var p := Vector2(c.position.x, c.position.z)
	var d: Vector2 = w["target"] - p
	if d.length() < 0.15:
		var a: Rect2 = w["area"]
		w["target"] = Vector2(randf_range(a.position.x, a.end.x), randf_range(a.position.y, a.end.y))
		w["wait"] = randf_range(0.5, 3.5)
		c.moving = false
		return
	var np := p + d.normalized() * float(w["speed"]) * delta
	if blocked(np, 0.2) and not blocked(p, 0.2):
		w["wait"] = 0.3
		var a2: Rect2 = w["area"]
		w["target"] = Vector2(randf_range(a2.position.x, a2.end.x), randf_range(a2.position.y, a2.end.y))
		return
	c.moving = true
	c.face_dir(d)
	c.position = Vector3(np.x, 0, np.y)
