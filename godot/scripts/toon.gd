class_name Toon
extends RefCounted
## Đổi vật liệu nhập từ Blender sang kiểu hoạt hình: tô bóng hai tông,
## viền ngoài đậm (vỏ lộn ngược) và ánh viền nhẹ.

const OUTLINE_COLOR := Color("1d120c")
const OUTLINE_GROW := 0.024

## Vật liệu của nhân vật: giữ mịn, không phủ vân vữa.
const SMOOTH := ["Skin", "Hair", "Eye", "EyeHi", "Blush", "Mouth", "Shirt", "Pants", "Belt", "Collar", "Apron", "Shoe",
	"LanternSilk", "WindowGlow", "Glass", "ShopGlass", "flat", "Headlight", "Taillight", "LampBulb", "Screen"]

static var _plaster: NoiseTexture2D
static var _outline: StandardMaterial3D
static var _cache := {}
static var _colored := {}


## Vật liệu viền dùng chung: phóng to theo pháp tuyến, chỉ vẽ mặt sau.
static func outline_mat() -> StandardMaterial3D:
	if _outline == null:
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.cull_mode = BaseMaterial3D.CULL_FRONT
		m.grow = true
		m.grow_amount = OUTLINE_GROW
		m.albedo_color = OUTLINE_COLOR
		_outline = m
	return _outline


## Vân vữa trát tường (nhiễu mịn, sáng 86–100%), phủ theo toạ độ thế giới nên không cần UV.
static func plaster() -> NoiseTexture2D:
	if _plaster == null:
		var n := FastNoiseLite.new()
		n.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
		n.frequency = 0.02
		n.fractal_octaves = 4
		var ramp := Gradient.new()
		ramp.set_color(0, Color(0.84, 0.82, 0.8))
		ramp.set_color(1, Color(1, 1, 1))
		_plaster = NoiseTexture2D.new()
		_plaster.width = 256
		_plaster.height = 256
		_plaster.seamless = true
		_plaster.noise = n
		_plaster.color_ramp = ramp
	return _plaster


static func _texture(m: StandardMaterial3D, key: String) -> void:
	if key in SMOOTH or m.albedo_texture != null or m.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
		return
	m.albedo_texture = plaster()
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3(0.45, 0.45, 0.45)


static func _style(m: StandardMaterial3D, outline := true) -> void:
	m.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	m.specular_mode = BaseMaterial3D.SPECULAR_TOON
	m.rim_enabled = true
	m.rim = 0.22
	m.rim_tint = 0.6
	if outline and m.transparency == BaseMaterial3D.TRANSPARENCY_DISABLED:
		m.next_pass = outline_mat()


## Bản toon của một vật liệu (có bộ nhớ đệm để các bản sao dùng chung).
static func toonify(src: Material) -> Material:
	if src == null:
		return null
	if _cache.has(src):
		return _cache[src]
	var out: Material = src
	if src is StandardMaterial3D:
		var m: StandardMaterial3D = src.duplicate()
		_style(m)
		_texture(m, src.resource_name)
		out = m
	_cache[src] = out
	return out


## Áp kiểu toon cho mọi MeshInstance3D bên dưới node.
static func apply(node: Node) -> void:
	for c in node.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		if mi.mesh == null:
			continue
		for i in mi.mesh.get_surface_count():
			mi.set_surface_override_material(i, toonify(mi.mesh.surface_get_material(i)))


## Vật liệu toon một màu (để đổi màu áo, tường, đèn lồng… theo từng bản sao).
static func colored(key: String, color: Color, emit := 0.0, outline := true) -> StandardMaterial3D:
	var k := "%s|%s|%s|%s" % [key, color.to_html(), emit, outline]
	if _colored.has(k):
		return _colored[k]
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.7
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = color
		m.emission_energy_multiplier = emit
	_style(m, outline)
	_texture(m, key)
	_colored[k] = m
	return m


## Đổi màu các mặt có vật liệu tên `mat_name` bên dưới node.
static func recolor(node: Node, mat_name: String, color: Color, emit := 0.0) -> void:
	for c in node.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		if mi.mesh == null:
			continue
		for i in mi.mesh.get_surface_count():
			var src := mi.mesh.surface_get_material(i)
			if src != null and src.resource_name == mat_name:
				mi.set_surface_override_material(i, colored(mat_name, color, emit))
