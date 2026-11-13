extends Node3D
## Khu phố 2.5D: nhà cửa, cây cối, đồ đạc là ảnh 2D (render từ Blender bằng
## tools/blender/render_sprites.py), chỉ nhân vật chibi và xe máy là 3D.
##
## Mỗi ảnh được dán lên một mặt "gập": phần sàn nằm trên mặt đất, phần tường dựng đứng
## ở chỗ gập. Nhân vật đứng trước chỗ gập thì vẽ đè lên ảnh, đứng sau thì bị ảnh che,
## đúng như 2D vẽ tay nhưng không phải tự sắp thứ tự lớp.
## Quán mở mặt tiền có hai lớp (trong/ngoài) nên nhân vật đứng được bên trong quán.
##
## Bản đồ: phố chính và phố trước uốn lượn, hai đường ngang cong nối nhau thành vòng,
## hẻm uốn khúc. Nhà xếp theo mép đường nên so le như phố thật.
## Tham số dòng lệnh (sau `--`): --shot=đường_dẫn.png  --night  --at=x,z  --zoom=cỡ_khung

const CAM_PITCH := 50.0       # phải khớp PITCH trong render_sprites.py
const META := "res://assets/sprites/meta.json"
const STREET_SHADER := preload("res://shaders/spatial_env_street.gdshader")
const HERO_SPEED := 4.2
const HERO_RADIUS := 0.25

const ROAD_HALF := 3.5         # nửa bề rộng mặt đường (m)
const WALK := 3.0              # bề rộng vỉa hè (m)
const FRONT_ROAD := 22.5       # tim trung bình của phố trước
const CROSS_X := [-24.0, 24.0] # tim trung bình của hai đường ngang
const ROAD_SHADER := preload("res://shaders/spatial_env_road.gdshader")

var meta := {}
var sprites: Array = []        # {layers:[{mat, tag}], box: AABB, kind, foot: Rect2}
var solids: Array[Rect2] = []
var zones: Array = []
var walkers: Array = []
var bikes: Array = []
var night_lights: Array[Light3D] = []
var night := false

var hero: Chibi
var cam: Camera3D
var sun: DirectionalLight3D
var env: Environment
var hud: Hud
var target = null
var cam_size := 15.0
var _shot_path := ""
var _shot_frames := 0
var _cos := cos(deg_to_rad(CAM_PITCH))
var _sin := sin(deg_to_rad(CAM_PITCH))


func _ready() -> void:
	randomize()
	meta = JSON.parse_string(FileAccess.get_file_as_string(META))
	var start := Vector2.INF
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="):
			_shot_path = a.substr(7)
		elif a == "--night":
			night = true
		elif a.begins_with("--at="):
			var p := a.substr(5).split(",")
			start = Vector2(float(p[0]), float(p[1]))
		elif a.begins_with("--zoom="):
			cam_size = float(a.substr(7))
	build_environment()
	build_ground()
	var pho_x := build_row_a()
	build_row_b()
	build_street_props()
	build_traffic()
	build_people()
	# lọc màu kiểu tranh minh hoạ, nằm dưới HUD
	var post := CanvasLayer.new()
	post.layer = 0
	add_child(post)
	var rect := ColorRect.new()
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var pm := ShaderMaterial.new()
	pm.shader = preload("res://shaders/post_illustration.gdshader")
	rect.material = pm
	post.add_child(rect)
	hud = Hud.new()
	hud.layer = 2
	add_child(hud)
	hero = Chibi.new()
	add_child(hero)
	hero.setup({"shirt": "#e8573c", "pants": "#3c4f6b", "skin": "#ffd9b8", "hair": "#2b1a12", "hat": "nonla", "apron": true})
	if start == Vector2.INF:
		start = Vector2(pho_x, main_z(pho_x) - ROAD_HALF - 1.2)
	hero.position = Vector3(start.x, 0, start.y)
	set_night(night)
	cam.global_position = _cam_pos()


# ================================================================ ảnh 2D trên mặt gập
## Đặt ảnh `name` với gốc mô hình tại (x, z). Trả về bề rộng ảnh nhà (m) để xếp dãy.
func sprite(name: String, x: float, z: float, solid := true) -> float:
	if not meta.has(name):
		push_warning("thiếu ảnh " + name)
		return 4.0
	var m: Dictionary = meta[name]
	var b: Array = m["bounds"]  # px0, px1, py0, py1 (m, theo toạ độ mô hình)
	var entry := {"layers": [], "kind": m["kind"], "name": name}
	for L in m["layers"]:
		var mi := MeshInstance3D.new()
		mi.mesh = _fold_mesh(b, float(L["fold"]), float(L["ymin"]))
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_DEPTH_PRE_PASS
		mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		mat.albedo_texture = load(L["day"])
		mat.set_meta("day", L["day"])
		mat.set_meta("night", L["night"])
		mi.material_override = mat
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.position = Vector3(x, 0, z)
		add_child(mi)
		entry["layers"].append({"mat": mat, "tag": L["tag"]})
	# khung bao 3D (để làm mờ khi nhân vật đi ra sau) và chân đế (để chặn đường)
	var f: Array = m["foot"]
	var foot := Rect2(x + f[0], z - f[3], f[2] - f[0], f[3] - f[1])
	entry["foot"] = foot
	entry["box"] = AABB(Vector3(foot.position.x, 0, foot.position.y), Vector3(foot.size.x, float(m["height"]), foot.size.y))
	sprites.append(entry)
	if solid:
		if m["kind"] in ["shop", "kiosk"]:
			# quán mở: chỉ chặn tường hai bên và tường sau, bên trong đi được
			var back := z - float(m["layers"][0]["fold"])
			solids.append(Rect2(foot.position.x, foot.position.y, 0.3, foot.size.y))
			solids.append(Rect2(foot.end.x - 0.3, foot.position.y, 0.3, foot.size.y))
			solids.append(Rect2(foot.position.x, foot.position.y, foot.size.x, back - foot.position.y + 0.2))
		else:
			solids.append(foot)
	for p in m.get("people", []):
		_person_from_meta(p, x, z)
	return float(m["width"])


## Mặt gập: dải sàn từ ymin tới fold (nằm trên đất), rồi vách đứng ở fold cao tới mép trên ảnh.
## UV lấy bằng cách chiếu từng đỉnh lên mặt phẳng ảnh (camera trực giao nghiêng CAM_PITCH).
func _fold_mesh(b: Array, fold: float, ymin: float) -> ArrayMesh:
	var px0: float = b[0]
	var px1: float = b[1]
	var py0: float = b[2]
	var py1: float = b[3]
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var quads := []
	if ymin < fold - 0.01:
		quads.append([Vector3(px0, 0.02, -ymin), Vector3(px1, 0.02, -ymin), Vector3(px1, 0.02, -fold), Vector3(px0, 0.02, -fold)])
	var ytop := (py1 - fold * _sin) / _cos + 0.05
	quads.append([Vector3(px0, 0.02, -fold), Vector3(px1, 0.02, -fold), Vector3(px1, ytop, -fold), Vector3(px0, ytop, -fold)])
	for q in quads:
		for idx in [0, 1, 2, 0, 2, 3]:
			var v: Vector3 = q[idx]
			var py := v.y * _cos + (-v.z) * _sin
			st.set_uv(Vector2((v.x - px0) / (px1 - px0), 1.0 - (py - py0) / (py1 - py0)))
			st.add_vertex(v)
	return st.commit()


const ROLES := {
	"police": {"shirt": "#5f7f45", "pants": "#4d6b3a", "hat": "police"},
	"potter": {"shirt": "#8a5a3a", "apron": true},
	"cook": {"shirt": "#f5f0e6", "apron": true, "hat": "khan"},
	"barista": {"shirt": "#3a2a22", "apron": true},
	"seller": {"apron": true, "hat": "nonla"},
}


func _person_from_meta(p: Array, x: float, z: float) -> void:
	var o: Dictionary = ROLES.get(p[4], {}).duplicate()
	o["face"] = float(p[2])
	if float(p[3]) >= 0.0:
		o["sit"] = float(p[3])
	person(x + float(p[0]), z - float(p[1]), o)


func person(x: float, z: float, o: Dictionary = {}) -> Chibi:
	var c := Chibi.new()
	add_child(c)
	c.setup(o)
	c.position = Vector3(x, 0, z)
	return c


func walker(area: Rect2, o: Dictionary = {}) -> void:
	var c := person(randf_range(area.position.x, area.end.x), randf_range(area.position.y, area.end.y), o)
	walkers.append({"c": c, "area": area, "target": Vector2(c.position.x, c.position.z), "wait": randf() * 2.0, "speed": randf_range(1.2, 1.9)})


# ================================================================ môi trường
func build_environment() -> void:
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.glow_hdr_threshold = 1.0
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	# mặt trời cùng hướng với đèn trong Blender để bóng nhân vật khớp bóng trong ảnh
	sun = DirectionalLight3D.new()
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 60.0
	add_child(sun)
	sun.basis = Basis.looking_at(Vector3(0.349, -0.669, -0.656), Vector3.UP)
	cam = Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = cam_size
	cam.near = 0.1
	cam.far = 300.0
	cam.rotation_degrees = Vector3(-CAM_PITCH, 0, 0)
	add_child(cam)
	cam.make_current()


func set_night(on: bool) -> void:
	night = on
	env.background_color = Color("0c1024") if on else Color("8fcbe8")
	env.glow_enabled = on  # ban ngày tắt glow để ảnh 2D giữ đúng màu
	env.ambient_light_color = Color("3a4682") if on else Color("e6ecff")
	env.ambient_light_energy = 0.45 if on else 0.75
	sun.light_color = Color("7f90e0") if on else Color("fff3dc")
	sun.light_energy = 0.25 if on else 1.0
	for l in night_lights:
		l.visible = on
	for s in sprites:
		for L in s["layers"]:
			var mat: StandardMaterial3D = L["mat"]
			mat.albedo_texture = load(mat.get_meta("night" if on else "day"))
	if hud:
		hud.clock.text = "🏮 19:40 · Thứ Hai" if on else "☀ 07:10 · Thứ Hai"


func _cam_pos() -> Vector3:
	return hero.position + Vector3(0, 0.8, 0) + cam.global_transform.basis.z * 80.0


func omni(pos: Vector3, color: String, energy := 2.0, rng := 7.0) -> OmniLight3D:
	var l := OmniLight3D.new()
	l.position = pos
	l.light_color = Color(color)
	l.light_energy = energy
	l.omni_range = rng
	add_child(l)
	night_lights.append(l)
	return l


# ================================================================ đường cong
## Tim phố chính theo x: hai sóng chồng nhau cho ra đường uốn lượn không đều.
func main_z(x: float) -> float:
	return 1.8 * sin(x / 9.0) + 0.8 * sin(x / 4.3 + 1.0)


## Tim phố trước theo x.
func front_z(x: float) -> float:
	return FRONT_ROAD + 2.2 * sin(x / 10.0 + 2.0) + 0.6 * sin(x / 3.7)


## Tim đường ngang (chạy theo z) quanh cx.
func cross_x(cx: float, z: float) -> float:
	return cx + 1.6 * sin(z / 3.5 + cx)


func _sample_x(f: Callable, x0: float, x1: float, step := 0.5, offset := 0.0) -> PackedVector3Array:
	var pts := PackedVector3Array()
	var x := x0
	while x <= x1 + 0.001:
		pts.append(Vector3(x, 0, f.call(x) + offset))
		x += step
	return pts


func _sample_z(cx: float, z0: float, z1: float, step := 0.5, offset := 0.0) -> PackedVector3Array:
	var pts := PackedVector3Array()
	var z := z0
	while z <= z1 + 0.001:
		pts.append(Vector3(cross_x(cx, z) + offset, 0, z))
		z += step
	return pts


## Dải băng dọc theo đường gấp khúc `pts` (tim), rộng `width`. UV.x = quãng đường, UV.y = 0..1 ngang.
func ribbon(pts: PackedVector3Array, width: float, mat: Material, y := 0.01) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var dist := 0.0
	var prev_l := Vector3.ZERO
	var prev_r := Vector3.ZERO
	var prev_d := 0.0
	for i in pts.size():
		var t := (pts[min(i + 1, pts.size() - 1)] - pts[max(i - 1, 0)]).normalized()
		var n := Vector3(-t.z, 0, t.x) * (width / 2.0)
		var l := pts[i] + n + Vector3(0, y, 0)
		var r := pts[i] - n + Vector3(0, y, 0)
		if i > 0:
			dist += pts[i].distance_to(pts[i - 1])
			for v in [[prev_l, prev_d, 0.0], [prev_r, prev_d, 1.0], [r, dist, 1.0], [prev_l, prev_d, 0.0], [r, dist, 1.0], [l, dist, 0.0]]:
				st.set_normal(Vector3.UP)
				st.set_uv(Vector2(v[1], v[2]))
				st.add_vertex(v[0])
		prev_l = l
		prev_r = r
		prev_d = dist
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	return mi


func _road_mat(lines := 1.0) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = ROAD_SHADER
	m.set_shader_parameter("show_lines", lines)
	return m


func _street_mat(kind: int) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = STREET_SHADER
	m.set_shader_parameter("surface_kind", kind)
	return m


func _flat(color: String) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(color)
	m.roughness = 0.9
	return m


## Một con đường: mặt nhựa + bó vỉa hai bên.
func road(pts: PackedVector3Array, half := ROAD_HALF, lines := 1.0, y := 0.012) -> void:
	ribbon(pts, half * 2.0, _road_mat(lines), y)
	var curb := _flat("c9c3b6")
	ribbon(_offset(pts, half), 0.2, curb, y + 0.05)
	ribbon(_offset(pts, -half), 0.2, curb, y + 0.05)


func _offset(pts: PackedVector3Array, d: float) -> PackedVector3Array:
	var out := PackedVector3Array()
	for i in pts.size():
		var t := (pts[min(i + 1, pts.size() - 1)] - pts[max(i - 1, 0)]).normalized()
		out.append(pts[i] + Vector3(-t.z, 0, t.x) * d)
	return out


# ================================================================ mặt đất
func ground(x0: float, z0: float, x1: float, z1: float, kind: int, top := 0.0) -> void:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = Vector3(x1 - x0, 0.2, z1 - z0)
	mi.mesh = b
	mi.material_override = _street_mat(kind)
	mi.position = Vector3((x0 + x1) / 2.0, top - 0.1, (z0 + z1) / 2.0)
	add_child(mi)


func build_ground() -> void:
	ground(-90, -60, 90, 60, 4, -0.03)
	ground(-50, -16, 50, 29.5, 1)          # cả khu lát gạch, đường trải lên trên
	ground(-40.0, 9.0, -27.5, 15.0, 3, 0.004)
	ground(28.5, 9.0, 40.0, 15.0, 3, 0.004)
	road(_sample_x(main_z, -56, 56))
	road(_sample_x(front_z, -56, 56))
	for cx in CROSS_X:
		road(_sample_z(cx, main_z(cx) + 2.5, front_z(cx) - 2.5), 3.0, 0.0, 0.008)
	# kênh nước chạy theo phố trước
	var water := _flat("4aa3c7")
	water.roughness = 0.15
	water.metallic_specular = 0.8
	ribbon(_sample_x(front_z, -60, 60, 0.5, 9.0), 6.0, water, -0.05)
	ribbon(_sample_x(front_z, -60, 60, 0.5, 5.9), 0.25, _flat("8c8077"), 0.03)
	for i in 120:
		var x := -60.0 + i
		solids.append(Rect2(x, front_z(x) + 6.0, 1.0, 9.0))


# ================================================================ dãy phố
const ROW_A_LIST := ["h_taphoa", "s_gom", "h_suaxe", "h_cattoc", "h_thuoc", "s_pho", "ALLEY",
	"police", "s_cafe", "s_buncha", "h_hoa", "h_dienthoai", "s_che", "h_vang", "h_gao"]

const ZONE_NAMES := {
	"h_taphoa": "Tạp hóa Cô Ba", "s_gom": "Xưởng Gốm Bát Tràng", "h_suaxe": "Sửa xe máy", "h_cattoc": "Cắt tóc nam",
	"h_thuoc": "Nhà thuốc Bình An", "s_pho": "Phở Gánh Đầu Ngõ", "police": "Công an phường", "s_cafe": "Cà Phê Trứng Gác Mái",
	"s_buncha": "Bún Chả Than Hồng", "h_hoa": "Hoa tươi", "h_dienthoai": "Điện thoại · Sim", "s_che": "Chè Ba Miền",
	"h_vang": "Tiệm vàng Kim Phát", "h_gao": "Gạo ngon miền Tây", "k_banhmi": "Bánh mì Phố Hội", "k_nuocmia": "Nước mía",
	"k_giatui": "Giặt ủi", "k_taphoa": "Tạp hóa Út Hiền", "market": "Chợ đầu mối", "k_suadt": "Sửa điện thoại",
	"k_hutieu": "Hủ tiếu Nam Vang",
}


## Mép trước của một nhà rộng w đặt ở x, sao cho cả mặt tiền nằm sau vỉa hè của đường f.
func _front_behind(f: Callable, x: float, w: float, gap: float) -> float:
	var z := INF
	var k := 0.0
	while k <= w:
		z = min(z, f.call(x + k) - gap)
		k += 0.5
	return z


## Dãy bắc phố chính, mặt tiền quay ra camera, so le theo đường cong.
## Trả về x giữa quán phở (chỗ người chơi xuất phát).
func build_row_a() -> float:
	var x := -40.0
	var pho_x := 0.0
	for name in ROW_A_LIST:
		if name == "ALLEY":
			# hẻm uốn khúc chạy lên phía bắc
			var zf := _front_behind(main_z, x, 3.4, ROAD_HALF + WALK)
			var pts := PackedVector3Array()
			var z := zf + 0.5
			while z > -32.0:
				pts.append(Vector3(x + 1.7 + 0.7 * sin(z / 2.6), 0, z))
				z -= 0.5
			ribbon(pts, 2.2, _flat("8f8a82"), 0.006)
			zones.append({"name": "Hẻm 12", "rect": Rect2(x, -32, 3.4, 32 + zf)})
			walker(Rect2(x + 0.8, -24, 1.8, 14), {"size": 0.75})
			x += 3.4
			continue
		var w := float(meta.get(name, {"width": 4.0})["width"])
		var zf := _front_behind(main_z, x, w, ROAD_HALF + WALK)
		sprite(name, x, zf)
		zones.append({"name": ZONE_NAMES.get(name, name), "rect": Rect2(x, zf - 9.0, w, 9.0)})
		if name == "s_pho":
			pho_x = x + w / 2.0
		if name == "police":
			sprite("loud_pole", x + w + 0.1, main_z(x + w) - ROAD_HALF - 0.45)
		if name.begins_with("s_"):
			omni(Vector3(x + w / 2.0, 2.4, zf - 3.0), "#ffcf8a", 3.0, 8.0)
		x += w - 0.05  # nhà ống liền vách
	sprite("tower_a", -34, -26, false)
	sprite("tower_b", -6, -28, false)
	sprite("tower_c", 18, -26, false)
	sprite("tower_a", 38, -27, false)
	return pho_x


## Dãy ki-ốt và chợ quay ra phố trước, giữa hai đường ngang cong.
func build_row_b() -> void:
	var blocks := [[-40.0, ["k_banhmi", "k_nuocmia"]], [-19.0, ["k_giatui", "k_taphoa", "market", "k_suadt", "k_hutieu"]]]
	for blk in blocks:
		var x: float = blk[0]
		for name in blk[1]:
			var w := float(meta.get(name, {"width": 5.0})["width"])
			var zf := _front_behind(front_z, x, w, ROAD_HALF + 2.6)
			sprite(name, x, zf)
			zones.append({"name": ZONE_NAMES.get(name, name), "rect": Rect2(x, zf - 6.5, w, 6.5)})
			omni(Vector3(x + w / 2.0, 2.4, zf + 0.5), "#ffcf8a", 2.5, 7.0)
			x += w + 0.4
	# sân cây đa phía đông
	sprite("banyan", 34.0, 12.0)
	sprite("bench", 30.5, 14.0)
	sprite("bench", 37.5, 14.0)
	person(30.2, 14.0, {"sit": 0.46, "face": 0, "hair": "#cccccc"})
	person(30.8, 14.0, {"sit": 0.46, "face": 0, "shirt": "#e85d9a"})
	sprite("eat_red", 31.5, 10.5)
	zones.append({"name": "Sân cây đa", "rect": Rect2(28.5, 9, 11.5, 6)})
	for i in 3:
		walker(Rect2(29, 9.5, 10.5, 5), {"size": 0.75})
	# sân phía tây
	sprite("tree", -34.0, 12.5)
	sprite("bench", -37.0, 13.5)
	person(-37.3, 13.5, {"sit": 0.46, "face": 0})


# ================================================================ đồ vỉa hè (đều là ảnh 2D)
func build_street_props() -> void:
	var poles := []
	for x in range(-40, 44, 10):
		var z := main_z(x) - ROAD_HALF - 0.45
		sprite("power_pole", x, z)
		poles.append(Vector3(x, 0, z))
	for i in poles.size() - 1:
		var a: Vector3 = poles[i]
		var b: Vector3 = poles[i + 1]
		for k in 3:
			_wire(Vector3(a.x - 0.8 + k * 0.8, 6.7, a.z), Vector3(b.x - 0.8 + k * 0.8, 6.7, b.z), 0.5 + k * 0.15)
		_wire(Vector3(a.x, 5.6, a.z), Vector3(b.x, 5.9, b.z), 0.7)
	for x in [-35.0, -15.0, 5.0, 25.0, 45.0]:
		sprite("lamp_n", x, main_z(x) - ROAD_HALF - 0.25)
		omni(Vector3(x, 4.2, main_z(x) - 2.3), "#fff0c8", 3.0, 9.0)
	for x in [-30.0, -18.0, -6.0, 6.0, 18.0, 30.0]:
		sprite("tree", x, main_z(x) + ROAD_HALF + 1.9)
	# đồ trước dãy bắc, đặt trên vỉa hè ngay trước từng nhà
	var slots := {"s_pho": ["eat_red", "umb_red", "aframe_red"], "s_che": ["eat_blue", "umb_pink"], "s_cafe": ["umb_teal", "eat_blue"],
		"s_buncha": ["eat_red", "umb_yellow"], "h_taphoa": ["carton", "basins", "aframe_blue"], "h_cattoc": ["topiary", "aframe_purple"],
		"h_thuoc": ["hedge"], "h_vang": ["topiary", "topiary"], "h_gao": ["crate", "basins"], "h_hoa": ["plant_pot", "plant_pot"],
		"s_gom": ["aframe_blue", "plant_pot"], "h_dienthoai": ["umb_yellow", "aframe_teal"]}
	for s in sprites.duplicate():
		var n: String = s["name"]
		if not slots.has(n):
			continue
		var foot: Rect2 = s["foot"]
		var items: Array = slots[n]
		for i in items.size():
			var px := foot.position.x + (i + 0.5) * foot.size.x / items.size()
			var walk_mid := main_z(px) - ROAD_HALF - WALK * 0.5
			sprite(items[i], px, walk_mid - 0.3 if items[i].begins_with("eat") or items[i].begins_with("umb") else walk_mid - 0.9)
	# trước dãy ki-ốt, quanh chợ
	var fz := func(x: float) -> float: return front_z(x) - ROAD_HALF - 1.2
	sprite("banh_mi_cart", -37.0, fz.call(-37.0))
	person(-37.0, fz.call(-37.0) - 0.7, {"hat": "nonla", "shirt": "#6aa84f", "face": 0}).waving = true
	sprite("fruit_cart", -13.0, fz.call(-13.0))
	person(-13.0, fz.call(-13.0) - 0.7, {"hat": "nonla", "shirt": "#e85d9a", "face": 0})
	for i in 3:
		var sx := 0.0 + i * 3.0
		sprite(["stall_green", "stall_red", "stall_blue"][i], sx, fz.call(sx))
		person(sx, fz.call(sx) - 0.8, {"hat": "nonla", "face": 0, "long": true})
	sprite("basins", 9.0, fz.call(9.0))
	sprite("crate", 9.9, fz.call(9.9))
	sprite("carton", 16.0, fz.call(16.0))
	# xích lô, ba gác, đống gạch, xe hoa, bếp vỉa hè, thuyền trên kênh
	for cx in [-31.0, 21.0]:
		sprite("cyclo", cx, main_z(cx) + ROAD_HALF + 1.3)
	person(-30.2, main_z(-31.0) + ROAD_HALF + 1.3, {"hat": "nonla", "shirt": "#5a6b7a", "sit": 0.9, "face": 90})
	sprite("ba_gac", 12.0, fz.call(12.0) - 0.1)
	person(13.8, fz.call(12.0) - 0.1, {"hat": "nonla", "shirt": "#6f8f4f", "face": -90})
	sprite("bricks", -22.0, main_z(-22.0) + ROAD_HALF + 2.3)
	sprite("flower_bike", -6.0, main_z(-6.0) + ROAD_HALF + 1.4)
	person(-5.3, main_z(-6.0) + ROAD_HALF + 1.4, {"hat": "nonla", "shirt": "#b8607f", "face": -90, "long": true})
	sprite("kitchen", 34.5, main_z(34.5) - ROAD_HALF - 1.4)
	for bx in [-30.0, -8.0, 16.0, 36.0]:
		sprite("boat" if int(bx) % 2 == 0 else "boat_r", bx, front_z(bx) + 9.0, false)
	# bờ kênh
	for x in [-34.0, -22.0, -10.0, 2.0, 14.0, 26.0, 38.0]:
		sprite("tree", x, front_z(x) + ROAD_HALF + 1.6)
	sprite("bus_stop", 8.0, front_z(8.0) + ROAD_HALF + 1.2)
	person(8.6, front_z(8.0) + ROAD_HALF + 1.2, {"sit": 0.46, "face": 0})
	person(9.2, front_z(8.0) + ROAD_HALF + 1.2, {"sit": 0.46, "face": 0, "shirt": "#e85d9a"})
	for x in [-28.0, -4.0, 20.0, 32.0]:
		sprite("bench", x, front_z(x) + ROAD_HALF + 2.0)


func _wire(a: Vector3, b: Vector3, sag: float) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_LINE_STRIP)
	for i in 21:
		var t := i / 20.0
		var p := a.lerp(b, t)
		p.y -= sag * 4.0 * t * (1.0 - t)
		st.add_vertex(p)
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color("2a1a12")
	mi.material_override = m
	add_child(mi)


# ================================================================ xe cộ (3D), chạy theo làn đường cong
const BIKE_COLS := ["#e8573c", "#3f8fd2", "#f5f0e6", "#f2a541", "#2fae8f", "#1d3557", "#e85d9a"]


func _bike(pos: Vector2) -> Node3D:
	var b: Node3D = (load("res://assets/models/motorbike.glb") as PackedScene).instantiate()
	Toon.apply(b)
	Toon.recolor(b, "BikeBody", Color(BIKE_COLS.pick_random()))
	b.position = Vector3(pos.x, 0, pos.y)
	add_child(b)
	var rider := Chibi.new()
	b.add_child(rider)
	rider.setup({"sit": 0.66, "face": 90, "hat": "helmet", "hat_color": ["#f2b84b", "#e85d9a", "#3f8fd2", "#f5f0e6", "#e2412f"].pick_random()})
	rider.position = Vector3(-0.15, 0, 0)
	if randf() < 0.45:
		var p2 := Chibi.new()
		b.add_child(p2)
		p2.setup({"sit": 0.7, "face": 90, "hat": "helmet", "long": true})
		p2.position = Vector3(-0.5, 0, 0)
	omni(Vector3(0.9, 0.8, 0), "#fff6c8", 1.5, 4.0).reparent(b, false)
	return b


## Đường đi của xe: danh sách điểm + độ dài cộng dồn.
func _path(pts: PackedVector3Array, loop: bool) -> Dictionary:
	var acc := PackedFloat32Array([0.0])
	for i in range(1, pts.size()):
		acc.append(acc[i - 1] + pts[i].distance_to(pts[i - 1]))
	if loop:
		acc.append(acc[acc.size() - 1] + pts[pts.size() - 1].distance_to(pts[0]))
		pts.append(pts[0])
	return {"pts": pts, "acc": acc, "len": acc[acc.size() - 1], "loop": loop}


func _path_at(p: Dictionary, s: float) -> Array:
	var acc: PackedFloat32Array = p["acc"]
	var pts: PackedVector3Array = p["pts"]
	var i := acc.bsearch(s) - 1
	i = clampi(i, 0, pts.size() - 2)
	var t := (s - acc[i]) / maxf(acc[i + 1] - acc[i], 0.0001)
	return [pts[i].lerp(pts[i + 1], t), pts[i + 1] - pts[i]]


func _reverse(pts: PackedVector3Array) -> PackedVector3Array:
	var out := PackedVector3Array()
	for i in range(pts.size() - 1, -1, -1):
		out.append(pts[i])
	return out


func build_traffic() -> void:
	# làn đi bên phải: hướng +x là làn phía nam (z lớn hơn)
	var lanes := [
		_path(_sample_x(main_z, -56, 56, 0.5, 1.6), false),
		_path(_reverse(_sample_x(main_z, -56, 56, 0.5, -1.6)), false),
		_path(_sample_x(front_z, -56, 56, 0.5, 1.6), false),
		_path(_reverse(_sample_x(front_z, -56, 56, 0.5, -1.6)), false),
	]
	for lane in lanes:
		for i in 4:
			var b := _bike(Vector2.ZERO)
			bikes.append({"n": b, "path": lane, "s": randf() * lane["len"], "speed": randf_range(5.0, 8.0)})
	# vòng quanh khu: phố chính → đường ngang đông → phố trước (ngược) → đường ngang tây
	var e := CROSS_X[1]
	var wx := CROSS_X[0]
	var loop := PackedVector3Array()
	loop.append_array(_sample_x(main_z, wx + 1.3, e - 1.3, 0.5, 1.6))
	loop.append_array(_sample_z(e, main_z(e) + 2.6, front_z(e) - 2.6, 0.5, -1.0))
	loop.append_array(_reverse(_sample_x(front_z, wx + 1.3, e - 1.3, 0.5, -1.6)))
	loop.append_array(_reverse(_sample_z(wx, main_z(wx) + 2.6, front_z(wx) - 2.6, 0.5, 1.0)))
	var lp := _path(loop, true)
	for i in 6:
		var b := _bike(Vector2.ZERO)
		bikes.append({"n": b, "path": lp, "s": randf() * lp["len"], "speed": randf_range(5.0, 7.0)})
	# xe đỗ trên vỉa hè
	for x in [-38.5, -37.6, -27.0, -26.1, -9.5, 12.0, 12.9, 30.0, 30.9, 41.0]:
		_parked(x, main_z(x) - ROAD_HALF - 2.1)
	for x in [-20.0, -19.1, 2.0, 2.9, 20.0]:
		_parked(x, main_z(x) + ROAD_HALF + 2.2)


func _parked(x: float, z: float) -> void:
	var p := _bike(Vector2(x, z))
	p.rotation.y = deg_to_rad(90 + randf_range(-8, 8))
	for c in p.get_children():
		if c is Chibi or c is OmniLight3D:
			c.queue_free()
	solids.append(Rect2(x - 0.3, z - 0.8, 0.6, 1.6))


func _update_bikes(delta: float) -> void:
	for b in bikes:
		var path: Dictionary = b["path"]
		b["s"] = b["s"] + b["speed"] * delta
		if b["s"] >= path["len"]:
			b["s"] = fmod(b["s"], path["len"])
		var at := _path_at(path, b["s"])
		var n: Node3D = b["n"]
		n.position = at[0]
		var d: Vector3 = at[1]
		if d.length_squared() > 0.0001:
			n.rotation.y = lerp_angle(n.rotation.y, atan2(-d.z, d.x), clampf(delta * 10.0, 0, 1))


# ================================================================ người đi bộ: đi dọc vỉa hè cong
func side_walker(f: Callable, offset: float, spread: float, o: Dictionary = {}) -> void:
	var x := randf_range(-40, 42)
	var c := person(x, f.call(x) + offset, o)
	walkers.append({"c": c, "side": f, "off": offset, "spread": spread, "lat": randf_range(-spread, spread),
		"tx": x, "tlat": 0.0, "wait": randf() * 2.0, "speed": randf_range(1.2, 1.9)})


func build_people() -> void:
	for i in 22:
		side_walker(main_z, -ROAD_HALF - WALK * 0.5, 1.0, {"hat": "nonla" if randf() < 0.2 else "", "long": randf() < 0.4})
	for i in 12:
		side_walker(main_z, ROAD_HALF + 1.2, 0.7, {"size": 0.75 if randf() < 0.25 else 1.0})
	for i in 14:
		side_walker(front_z, -ROAD_HALF - 1.3, 0.8, {"hat": "nonla" if randf() < 0.3 else ""})
	for i in 6:
		side_walker(front_z, ROAD_HALF + 1.4, 0.6, {"long": randf() < 0.5})


func blocked(p: Vector2, r := HERO_RADIUS) -> bool:
	for s in solids:
		if p.x > s.position.x - r and p.x < s.end.x + r and p.y > s.position.y - r and p.y < s.end.y + r:
			return true
	return p.x < -48 or p.x > 48 or p.y < -30


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
			cam_size = clampf(cam_size - 1.0, 7.0, 40.0)
		elif e.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			cam_size = clampf(cam_size + 1.0, 7.0, 40.0)


func _process(delta: float) -> void:
	_move_hero(delta)
	for w in walkers:
		_update_walker(w, delta)
	_update_bikes(delta)
	_update_fade()
	var hp := Vector2(hero.position.x, hero.position.z)
	var area := "Phố Đèn Lồng · Ngõ Phố Cổ"
	for z in zones:
		if (z["rect"] as Rect2).has_point(hp):
			area = z["name"]
	hud.area.text = "📍 " + area
	cam.size = lerpf(cam.size, cam_size, delta * 8.0)
	cam.global_position = cam.global_position.lerp(_cam_pos(), clampf(delta * 6.0, 0.0, 1.0))
	if _shot_path != "":
		_shot_frames += 1
		if _shot_frames == 50:
			cam.global_position = _cam_pos()
		if _shot_frames == 55:
			var img := get_viewport().get_texture().get_image()
			DirAccess.make_dir_recursive_absolute(_shot_path.get_base_dir())
			img.save_png(_shot_path)
			print("đã chụp ", _shot_path)
			get_tree().quit()


## Ảnh nhà nào che người chơi thì mờ đi; đứng trong quán thì chỉ lớp ngoài (mái hiên, tầng trên) mờ.
func _update_fade() -> void:
	var back := cam.global_transform.basis.z
	var pts := [hero.position + Vector3(0, 0.4, 0), hero.position + Vector3(0, 1.2, 0)]
	var hp := Vector2(hero.position.x, hero.position.z)
	for s in sprites:
		var inside: bool = (s["foot"] as Rect2).has_point(hp)
		var hidden := false
		for p in pts:
			if (s["box"] as AABB).intersects_segment(p + back * 120.0, p + back * 0.2):
				hidden = true
				break
		for L in s["layers"]:
			var a := 1.0
			if inside and s["kind"] in ["shop", "kiosk"]:
				a = 0.3 if L["tag"] == "front" else 1.0
			elif hidden and not inside:
				a = 0.35
			var mat: StandardMaterial3D = L["mat"]
			mat.albedo_color.a = lerpf(mat.albedo_color.a, a, 0.2)


func _move_hero(delta: float) -> void:
	var inp := Vector2(
		Input.get_axis("ui_left", "ui_right") + float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A)),
		Input.get_axis("ui_up", "ui_down") + float(Input.is_key_pressed(KEY_S)) - float(Input.is_key_pressed(KEY_W)))
	var move := Vector2.ZERO
	if inp.length() > 0.1:
		target = null
		move = inp.normalized()
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
	var goal: Vector2
	if w.has("side"):
		var f: Callable = w["side"]
		goal = Vector2(w["tx"], f.call(w["tx"]) + w["off"] + w["tlat"])
	else:
		goal = w["target"]
	var d := goal - p
	if d.length() < 0.15:
		if w.has("side"):
			w["tx"] = clampf(p.x + randf_range(-9, 9), -42, 44)
			w["tlat"] = randf_range(-w["spread"], w["spread"])
		else:
			var a: Rect2 = w["area"]
			w["target"] = Vector2(randf_range(a.position.x, a.end.x), randf_range(a.position.y, a.end.y))
		w["wait"] = randf_range(0.5, 3.0)
		c.moving = false
		return
	var np := p + d.normalized() * minf(float(w["speed"]) * delta, d.length())
	if blocked(np, 0.2) and not blocked(p, 0.2):
		w["wait"] = 0.3
		if w.has("side"):
			w["tx"] = clampf(p.x + randf_range(-6, 6), -42, 44)
			w["tlat"] = 0.0
		else:
			var a2: Rect2 = w["area"]
			w["target"] = Vector2(randf_range(a2.position.x, a2.end.x), randf_range(a2.position.y, a2.end.y))
		return
	c.moving = true
	c.face_dir(d)
	c.position = Vector3(np.x, 0, np.y)
