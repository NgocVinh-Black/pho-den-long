class_name Chibi
extends Node3D
## Nhân vật chibi dựng từ chibi.glb: đổi màu theo từng người, đội nón/mũ,
## đi bộ (vung tay chân), ngồi, ăn (cầm đũa gắp, đưa lên miệng, nhai), nhảy, chớp mắt, quay mặt mượt.

const MODELS := "res://assets/models/"
const SKINS := ["#ffd9b8", "#f6c79e", "#e8b088", "#d39a6e"]
const HAIRS := ["#2b1a12", "#3d2618", "#1b1210", "#5a3422"]
const SHIRTS := ["#b5533c", "#4f7fa8", "#4f8f7a", "#c99a4b", "#7d6aa3", "#b8607f", "#6f8f4f", "#e9e1d0", "#c9b05a", "#5a6b7a"]
const PANTS := ["#3e3a45", "#3c4a5b", "#5b4a3a", "#2f2f3a", "#4a4f3a"]

static var _scene: PackedScene

var model: Node3D
var leg_l: Node3D
var leg_r: Node3D
var arm_l: Node3D
var arm_r: Node3D
var head: Node3D
var body: Node3D
var eyes: Array[Node3D] = []
var highlights: Array[Node3D] = []

## Đang đi: vung tay chân.
var moving := false
## Đang ngồi trên ghế cao `sit_h` (mét).
var sitting := false
var sit_h := 0.32
## Vẫy tay (người bán hàng mời khách).
var waving := false
## Bưng đồ: hai tay đưa ra trước
var carrying := false
## Đang ăn: tay phải cầm đũa gắp từ bát lên miệng, đầu cúi theo, miệng nhai.
var eating := false
## Đang ở trên không (nhảy): co chân, giang tay.
var airborne := false
## Góc quay mong muốn (radian, quanh trục Y). Mặt trước của mô hình là +Z.
var facing := 0.0

var _phase := 0.0
var _eat_t := 0.0
var _squash := 0.0
var chopsticks: Node3D
var mouth: Node3D
var _t := 0.0
var _blink := 2.0
var _seed := 0.0


## Tạo nhân vật. o: shirt, pants, skin, hair, belt (màu hex), hat ("nonla"/"helmet"/"police"/"khan"),
## apron (bool), sit (độ cao ghế), face (độ), size.
func setup(o: Dictionary = {}) -> Chibi:
	if _scene == null:
		_scene = load(MODELS + "chibi.glb")
	model = _scene.instantiate()
	add_child(model)
	Toon.apply(model)
	leg_l = model.find_child("LegL", true, false)
	leg_r = model.find_child("LegR", true, false)
	arm_l = model.find_child("ArmL", true, false)
	arm_r = model.find_child("ArmR", true, false)
	head = model.find_child("Head", true, false)
	body = model.find_child("Body", true, false)
	head.scale = Vector3.ONE * 1.15  # đầu to hơn chút cho đúng tỉ lệ chibi
	for n in ["EyeL", "EyeR"]:
		eyes.append(model.find_child(n, true, false))
	mouth = model.find_child("Mouth", true, false)
	for n in ["EyeHiL", "EyeHiR", "EyeHi2L", "EyeHi2R"]:
		highlights.append(model.find_child(n, true, false))

	var shirt := Color(o.get("shirt", SHIRTS.pick_random()))
	Toon.recolor(model, "Shirt", shirt)
	Toon.recolor(model, "Pants", Color(o.get("pants", PANTS.pick_random())))
	Toon.recolor(model, "Skin", Color(o.get("skin", SKINS.pick_random())))
	Toon.recolor(model, "Hair", Color(o.get("hair", HAIRS.pick_random())))
	Toon.recolor(model, "Belt", Color(o.get("belt", shirt.darkened(0.55).to_html())))
	Toon.recolor(model, "Collar", shirt.darkened(0.45))
	var apron := model.find_child("Apron", true, false)
	if apron:
		apron.visible = o.get("apron", false)

	var hat: String = o.get("hat", "")
	if hat != "":
		var h: Node3D = (load(MODELS + "hat_" + hat + ".glb") as PackedScene).instantiate()
		Toon.apply(h)
		head.add_child(h)
		h.position = Vector3(0, -0.62, 0)  # mũ dựng theo toạ độ bàn chân, đầu xoay quanh cổ (0.62 m)
		if o.has("hat_color"):
			for key in ["Helmet", "Khan"]:
				Toon.recolor(h, key, Color(o["hat_color"]))

	scale = Vector3.ONE * float(o.get("size", 1.0))
	if o.has("sit"):
		sit(float(o["sit"]))
	facing = deg_to_rad(float(o.get("face", 0.0)))
	rotation.y = facing
	_seed = randf() * 10.0
	_blink = randf_range(1.0, 4.0)
	return self


## Ngồi xuống ghế cao h mét.
func sit(h: float) -> void:
	sitting = true
	sit_h = h


## Đứng dậy khỏi ghế (thôi ăn luôn).
func stand() -> void:
	sitting = false
	set_eating(false)
	model.position.y = 0.0


## Bật/tắt ăn. Đũa gắn ở bàn tay phải, chỉ hiện khi ăn.
func set_eating(on: bool) -> void:
	eating = on
	if on and chopsticks == null:
		chopsticks = Node3D.new()
		var hand: Node3D = arm_r.find_child("HandR", true, false)
		(hand if hand else arm_r).add_child(chopsticks)
		var mat := Toon.colored("chopstick", Color("c8a26a"))
		for dx in [-0.014, 0.014]:
			var mi := MeshInstance3D.new()
			var b := BoxMesh.new()
			b.size = Vector3(0.014, 0.26, 0.014)
			mi.mesh = b
			mi.material_override = mat
			mi.position = Vector3(dx, -0.1, 0.035)
			mi.rotation.x = 0.25
			chopsticks.add_child(mi)
		_eat_t = randf() * 2.4
	if chopsticks:
		chopsticks.visible = on
	if not on:
		arm_r.rotation.z = 0.0
		if mouth:
			mouth.scale = Vector3.ONE


## Vừa chạm đất sau khi nhảy: nhún người một chút.
func land() -> void:
	airborne = false
	_squash = 1.0


## Quay mặt theo hướng di chuyển trên mặt đất (x, z).
func face_dir(d: Vector2) -> void:
	if d.length_squared() > 0.0001:
		facing = atan2(d.x, d.y)


func _process(delta: float) -> void:
	_t += delta
	if airborne:
		leg_l.rotation.x = lerpf(leg_l.rotation.x, -0.9, delta * 14.0)
		leg_r.rotation.x = lerpf(leg_r.rotation.x, 0.35, delta * 14.0)
		arm_l.rotation.x = lerpf(arm_l.rotation.x, -2.4, delta * 14.0)
		arm_r.rotation.x = lerpf(arm_r.rotation.x, -2.4, delta * 14.0)
		model.position.y = 0.0
		body.scale.y = 1.06
	elif sitting:
		leg_l.rotation.x = -1.45
		leg_r.rotation.x = -1.45
		arm_l.rotation.x = -0.55 + sin(_t * 1.3 + _seed) * 0.06
		arm_r.rotation.x = -0.55 + sin(_t * 1.1 + _seed) * 0.06
		model.position.y = sit_h - 0.30
		body.scale.y = 1.0 + sin(_t * 2.4 + _seed) * 0.015
	elif moving:
		_phase += delta * 11.0
		var s := sin(_phase)
		leg_l.rotation.x = s * 0.75
		leg_r.rotation.x = -s * 0.75
		arm_l.rotation.x = -s * 0.65
		arm_r.rotation.x = s * 0.65
		model.position.y = abs(s) * 0.05
		body.scale.y = 1.0
	else:
		leg_l.rotation.x = lerpf(leg_l.rotation.x, 0.0, delta * 10.0)
		leg_r.rotation.x = lerpf(leg_r.rotation.x, 0.0, delta * 10.0)
		arm_l.rotation.x = lerpf(arm_l.rotation.x, 0.0, delta * 10.0)
		arm_r.rotation.x = lerpf(arm_r.rotation.x, 0.0, delta * 10.0)
		model.position.y = lerpf(model.position.y, 0.0, delta * 10.0)
		body.scale.y = 1.0 + sin(_t * 2.4 + _seed) * 0.02
	if carrying:
		arm_l.rotation.x = -1.25
		arm_r.rotation.x = -1.25
	if _squash > 0.0:  # nhún khi tiếp đất
		_squash = maxf(_squash - delta * 5.0, 0.0)
		var k := sin(_squash * PI) * 0.18
		model.scale = Vector3(1.0 + k * 0.6, 1.0 - k, 1.0 + k * 0.6)
	elif model.scale != Vector3.ONE:
		model.scale = Vector3.ONE
	if waving:
		arm_r.rotation.z = 2.4 + sin(_t * 8.0) * 0.35
	head.rotation.z = sin(_t * 1.7 + _seed) * 0.05
	head.rotation.x = sin(_t * 1.1 + _seed) * 0.03
	if eating:
		_animate_eating(delta)

	# chớp mắt
	_blink -= delta
	var closed := _blink < 0.0
	for e in eyes:
		e.scale.y = 0.12 if closed else 1.0
	for h in highlights:
		h.visible = not closed
	if _blink < -0.12:
		_blink = randf_range(2.0, 5.0)

	rotation.y = lerp_angle(rotation.y, facing, delta * 12.0)


## Một nhịp ăn ~2,4 s: cúi gắp ở bát (0–0.3) → đưa đũa lên miệng (0.3–0.5) → nhai (0.5–1).
func _animate_eating(delta: float) -> void:
	_eat_t += delta
	var u := fmod(_eat_t, 2.4) / 2.4
	var arm := 0.0
	var nod := 0.0
	var chew := 0.0
	if u < 0.3:  # gắp: tay xuống bát, đầu cúi
		var k := smoothstep(0.0, 0.3, u)
		arm = lerpf(-1.7, -0.85, k)
		nod = lerpf(0.05, 0.28, k)
	elif u < 0.5:  # đưa lên miệng
		var k := smoothstep(0.3, 0.5, u)
		arm = lerpf(-0.85, -2.25, k)
		nod = lerpf(0.28, 0.12, k)
	else:  # nhai
		var k := smoothstep(0.5, 1.0, u)
		arm = lerpf(-2.25, -1.7, k)
		nod = 0.05 + sin(u * 40.0) * 0.03
		chew = absf(sin(u * 40.0))
	arm_r.rotation.x = arm
	arm_r.rotation.z = 0.45 * clampf(-arm - 0.8, 0.0, 1.0)  # khép tay vào giữa khi đưa lên miệng
	arm_l.rotation.x = -0.75  # tay trái tì cạnh bát
	head.rotation.x = nod
	if mouth:
		mouth.scale = Vector3(1.0, 1.0 + chew * 1.6, 1.0)
