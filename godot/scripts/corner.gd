extends Node3D
## Góc phố kiểu Nobody: tranh nền vẽ sẵn (render từ Blender bằng tools/blender/build_corner.py),
## camera Godot đặt đúng vị trí và góc của camera Blender. Tranh được chiếu lên khối che (proxy.glb)
## nên nhân vật/xe 3D đi ra sau nhà thì bị che đúng chỗ. Mỗi khu là một khung hình cố định.
##
## Toạ độ trong scene.json là toạ độ Blender (x, y, z với z lên): Godot = (x, z, -y).
## Tham số dòng lệnh (sau `--`): --shot=đường_dẫn.png  --night

const DIR := "res://assets/scenes/corner/"
const PLATE_SHADER := preload("res://shaders/spatial_proj_plate.gdshader")
const HERO_SPEED := 3.6
const HERO_RADIUS := 0.25

var data := {}
var plate_mat: ShaderMaterial
var solids: Array[Rect2] = []
var bounds := Rect2()
var walkers: Array = []
var bikes: Array = []
var night_lights: Array[Light3D] = []
var night := false

var hero: Chibi
var cam: Camera3D
var sun: DirectionalLight3D
var env: Environment
var hud: HudStreet
var target = null
var _shot_path := ""
var _shot_frames := 0


static func b2g(x: float, y: float, z := 0.0) -> Vector3:
	return Vector3(x, z, -y)


static func rect_b2g(r: Array) -> Rect2:
	return Rect2(r[0], -r[3], r[2] - r[0], r[3] - r[1])


func _ready() -> void:
	randomize()
	data = JSON.parse_string(FileAccess.get_file_as_string(DIR + "scene.json"))
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="):
			_shot_path = a.substr(7)
		elif a == "--night":
			night = true
	_build_camera_and_light()
	_build_plate()
	for r in data["solids"]:
		solids.append(rect_b2g(r))
	bounds = rect_b2g(data["bounds"])
	_build_people()
	_build_traffic()
	# lọc màu nhẹ để nhân vật 3D hoà vào tranh
	var post := CanvasLayer.new()
	post.layer = 0
	add_child(post)
	var rect := ColorRect.new()
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var pm := ShaderMaterial.new()
	pm.shader = preload("res://shaders/post_illustration.gdshader")
	pm.set_shader_parameter("saturation", 0.97)
	pm.set_shader_parameter("grain", 0.02)
	pm.set_shader_parameter("vignette", 0.22)
	rect.material = pm
	post.add_child(rect)
	hud = HudStreet.new()
	add_child(hud)
	hero = _person(b2g(0.5, 3.5), {"shirt": "#4f7fa8", "pants": "#3c4a5b", "skin": "#f1c9a5", "hair": "#2b1a12", "hat": "nonla"})
	set_night(night)


# ================================================================ camera, tranh nền
func _build_camera_and_light() -> void:
	var c: Dictionary = data["camera"]
	var m: Array = c["matrix"]
	var col := func(i: int) -> Vector3: return Vector3(m[0][i], m[2][i], -m[1][i])
	cam = Camera3D.new()
	cam.transform = Transform3D(Basis(col.call(0), col.call(1), col.call(2)), col.call(3))
	cam.fov = float(c["fov"])
	cam.keep_aspect = Camera3D.KEEP_HEIGHT
	cam.near = 0.2
	cam.far = 600.0
	add_child(cam)
	cam.make_current()
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	sun = DirectionalLight3D.new()
	sun.shadow_enabled = false
	add_child(sun)
	sun.basis = Basis.looking_at(Vector3(0.349, -0.669, -0.656), Vector3.UP)


func _build_plate() -> void:
	plate_mat = ShaderMaterial.new()
	plate_mat.shader = PLATE_SHADER
	var proxy: Node3D = (load(DIR + "proxy.glb") as PackedScene).instantiate()
	add_child(proxy)
	for n in proxy.find_children("*", "MeshInstance3D", true, false):
		var mi := n as MeshInstance3D
		mi.material_override = plate_mat
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# tấm phông xa sau cùng: phủ bầu trời và mọi chỗ không có khối
	var back := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(2000, 2000)
	back.mesh = q
	back.material_override = plate_mat
	add_child(back)
	back.global_transform = Transform3D(cam.global_transform.basis, cam.global_position - cam.global_transform.basis.z * 500.0)


func set_night(on: bool) -> void:
	night = on
	plate_mat.set_shader_parameter("plate", load(DIR + ("plate_night.png" if on else "plate_day.png")))
	env.ambient_light_color = Color("3a4682") if on else Color("e8e2d4")
	env.ambient_light_energy = 0.5 if on else 0.7
	sun.light_color = Color("8fa0ff") if on else Color("fff0d6")
	sun.light_energy = 0.3 if on else 0.95
	for l in night_lights:
		l.visible = on
	if hud:
		hud.clock.text = "19:40 · Thứ Hai" if on else "07:10 · Thứ Hai"


# ================================================================ người
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
	_blob_shadow(c)
	return c


## Bóng tròn mờ dưới chân (tranh nền không nhận bóng nên dùng bóng giả).
func _blob_shadow(n: Node3D, size := Vector2(0.75, 0.5)) -> void:
	var tex := GradientTexture2D.new()
	tex.fill = GradientTexture2D.FILL_RADIAL
	tex.fill_from = Vector2(0.5, 0.5)
	tex.fill_to = Vector2(1.0, 0.5)
	var g := Gradient.new()
	g.set_color(0, Color(0.08, 0.05, 0.03, 0.45))
	g.set_color(1, Color(0.08, 0.05, 0.03, 0.0))
	tex.gradient = g
	var m := StandardMaterial3D.new()
	m.albedo_texture = tex
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var p := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = size
	p.mesh = pm
	p.material_override = m
	p.position.y = 0.03
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	n.add_child(p)


func _build_people() -> void:
	for s in data["seats"]:
		_person(b2g(s[0], s[1]), {"sit": float(s[3]), "face": float(s[2])})
	for p in data["people"]:
		var o: Dictionary = ROLES.get(p[4], {}).duplicate()
		o["face"] = float(p[2])
		if float(p[3]) >= 0.0:
			o["sit"] = float(p[3])
		_person(b2g(p[0], p[1]), o)
	var walk: Array = data["walk"]
	for i in 26:
		var r := rect_b2g(walk[i % walk.size()])
		var c := _person(Vector3(randf_range(r.position.x, r.end.x), 0, randf_range(r.position.y, r.end.y)),
			{"hat": "nonla" if randf() < 0.25 else "", "long": randf() < 0.4})
		walkers.append({"c": c, "area": r, "target": Vector2(c.position.x, c.position.z), "wait": randf() * 2.0,
			"speed": randf_range(1.0, 1.6)})


# ================================================================ xe máy, xe đạp chạy theo làn
const BIKE_COLS := ["#b5533c", "#4f7fa8", "#e9e1d0", "#c99a4b", "#4f8f7a", "#2f3a4a", "#b8607f"]


func _bike() -> Node3D:
	var b: Node3D = (load("res://assets/models/motorbike.glb") as PackedScene).instantiate()
	Toon.apply(b)
	Toon.recolor(b, "BikeBody", Color(BIKE_COLS.pick_random()))
	add_child(b)
	var rider := Chibi.new()
	b.add_child(rider)
	var green := randf() < 0.3  # tài xế công nghệ áo xanh
	rider.setup({"sit": 0.66, "face": 90, "hat": "helmet",
		"hat_color": "#3f8f4f" if green else ["#c99a4b", "#b8607f", "#4f7fa8", "#e9e1d0"].pick_random(),
		"shirt": "#3f8f4f" if green else Chibi.SHIRTS.pick_random()})
	rider.position = Vector3(-0.15, 0, 0)
	if green:
		var box: Node3D = (load("res://assets/models/delivery_box.glb") as PackedScene).instantiate()
		Toon.apply(box)
		Toon.recolor(box, "DeliveryRed", Color("3f8f4f"))
		b.add_child(box)
		box.position = Vector3(-0.55, 0.66, 0)
	elif randf() < 0.4:
		var p2 := Chibi.new()
		b.add_child(p2)
		p2.setup({"sit": 0.7, "face": 90, "hat": "helmet", "long": true})
		p2.position = Vector3(-0.5, 0, 0)
	_blob_shadow(b, Vector2(2.0, 0.7))
	var l := OmniLight3D.new()
	l.position = Vector3(0.9, 0.8, 0)
	l.light_color = Color("fff6c8")
	l.light_energy = 1.5
	l.omni_range = 4.0
	b.add_child(l)
	night_lights.append(l)
	return b


func _build_traffic() -> void:
	for lane in data["lanes"]:
		var pts := PackedVector3Array()
		for p in lane:
			pts.append(b2g(p[0], p[1]))
		var acc := PackedFloat32Array([0.0])
		for i in range(1, pts.size()):
			acc.append(acc[i - 1] + pts[i].distance_to(pts[i - 1]))
		var path := {"pts": pts, "acc": acc, "len": acc[acc.size() - 1]}
		for i in 3:
			bikes.append({"n": _bike(), "path": path, "s": randf() * float(path["len"]), "speed": randf_range(4.0, 6.5)})


func _update_bikes(delta: float) -> void:
	for b in bikes:
		var path: Dictionary = b["path"]
		b["s"] = fmod(float(b["s"]) + float(b["speed"]) * delta, float(path["len"]))
		var acc: PackedFloat32Array = path["acc"]
		var pts: PackedVector3Array = path["pts"]
		var i := clampi(acc.bsearch(b["s"]) - 1, 0, pts.size() - 2)
		var t := (float(b["s"]) - acc[i]) / maxf(acc[i + 1] - acc[i], 0.001)
		var n: Node3D = b["n"]
		n.position = pts[i].lerp(pts[i + 1], t)
		var d := pts[i + 1] - pts[i]
		n.rotation.y = lerp_angle(n.rotation.y, atan2(-d.z, d.x), clampf(delta * 8.0, 0, 1))


# ================================================================ vòng lặp
func blocked(p: Vector2, r := HERO_RADIUS) -> bool:
	if not bounds.has_point(p):
		return true
	for s in solids:
		if p.x > s.position.x - r and p.x < s.end.x + r and p.y > s.position.y - r and p.y < s.end.y + r:
			return true
	return false


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo and e.keycode == KEY_N:
		set_night(not night)
	elif e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT:
		var from := cam.project_ray_origin(e.position)
		var dir := cam.project_ray_normal(e.position)
		if absf(dir.y) > 0.001:
			var hit := from + dir * (-from.y / dir.y)
			target = Vector2(hit.x, hit.z)


func _process(delta: float) -> void:
	_move_hero(delta)
	for w in walkers:
		_update_walker(w, delta)
	_update_bikes(delta)
	hud.area.text = "Ngõ Phố Cổ · Góc chợ đêm"
	if _shot_path != "":
		_shot_frames += 1
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
		var r := cam.global_transform.basis.x
		var f := -cam.global_transform.basis.z
		move = (Vector2(r.x, r.z).normalized() * inp.x - Vector2(f.x, f.z).normalized() * inp.y).normalized()
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
	var a: Rect2 = w["area"]
	if d.length() < 0.15:
		w["target"] = Vector2(randf_range(a.position.x, a.end.x), randf_range(a.position.y, a.end.y))
		w["wait"] = randf_range(0.5, 3.0)
		c.moving = false
		return
	var np := p + d.normalized() * minf(float(w["speed"]) * delta, d.length())
	if blocked(np, 0.2) and not blocked(p, 0.2):
		w["wait"] = 0.3
		w["target"] = Vector2(randf_range(a.position.x, a.end.x), randf_range(a.position.y, a.end.y))
		return
	c.moving = true
	c.face_dir(d)
	c.position = Vector3(np.x, 0, np.y)
