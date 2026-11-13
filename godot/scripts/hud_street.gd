class_name HudStreet
extends CanvasLayer
## Giao diện theo ảnh mẫu phố vẽ tay: góc trên trái có chân dung tròn viền tối, thanh máu đỏ
## trong khung tối, hai biểu tượng nhỏ (năng lượng, tâm trạng); góc trên phải ba nút vuông nền tối viền vàng.

const FONT := preload("res://assets/fonts/NotoSans-Bold.ttf")
const DARK := Color("2b2622")
const DARK2 := Color("3a332d")
const GOLD := Color("b89a5a")
const CREAM := Color("efe4c8")

var area: Label
var clock: Label
var hp: ProgressBar


func _box(bg: Color, border: Color, radius: int, bw := 2) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(bw)
	sb.set_corner_radius_all(radius)
	sb.shadow_color = Color(0, 0, 0, 0.45)
	sb.shadow_size = 3
	sb.shadow_offset = Vector2(0, 2)
	return sb


func _label(parent: Node, txt: String, size: int, color := CREAM) -> Label:
	var l := Label.new()
	l.text = txt
	var ls := LabelSettings.new()
	ls.font = FONT
	ls.font_size = size
	ls.font_color = color
	ls.outline_size = 4
	ls.outline_color = Color("1a1410")
	l.label_settings = ls
	parent.add_child(l)
	return l


func _square_button(parent: Node, icon: String, tint: Color) -> void:
	var p := PanelContainer.new()
	p.custom_minimum_size = Vector2(46, 46)
	p.add_theme_stylebox_override("panel", _box(DARK, GOLD, 8, 2))
	parent.add_child(p)
	var inner := PanelContainer.new()
	inner.add_theme_stylebox_override("panel", _box(tint, Color(0, 0, 0, 0), 6, 0))
	p.add_child(inner)
	var l := _label(inner, icon, 22, Color.WHITE)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER


func _ready() -> void:
	layer = 2
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	# --- chân dung + thanh máu
	var bar_bg := PanelContainer.new()
	bar_bg.position = Vector2(54, 18)
	bar_bg.custom_minimum_size = Vector2(170, 22)
	bar_bg.add_theme_stylebox_override("panel", _box(DARK, Color("15110e"), 6, 2))
	root.add_child(bar_bg)
	hp = ProgressBar.new()
	hp.value = 62
	hp.show_percentage = false
	hp.custom_minimum_size = Vector2(150, 12)
	var fill := _box(Color("b5322a"), Color(0, 0, 0, 0), 3, 0)
	fill.shadow_size = 0
	hp.add_theme_stylebox_override("fill", fill)
	var empty := _box(Color("4a2a24"), Color(0, 0, 0, 0), 3, 0)
	empty.shadow_size = 0
	hp.add_theme_stylebox_override("background", empty)
	var pad := MarginContainer.new()
	for side in ["left", "right", "top", "bottom"]:
		pad.add_theme_constant_override("margin_" + side, 4)
	pad.add_theme_constant_override("margin_left", 26)
	bar_bg.add_child(pad)
	pad.add_child(hp)

	var icons := PanelContainer.new()
	icons.position = Vector2(70, 44)
	icons.add_theme_stylebox_override("panel", _box(DARK, Color("15110e"), 6, 2))
	root.add_child(icons)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	icons.add_child(row)
	_label(row, " ⚡", 15, Color("f2c84b"))
	_label(row, "😊 ", 15)

	var portrait := PanelContainer.new()
	portrait.position = Vector2(10, 8)
	portrait.custom_minimum_size = Vector2(62, 62)
	var ring := _box(Color("4a6a7a"), DARK, 31, 4)
	ring.border_width_left = 4
	portrait.add_theme_stylebox_override("panel", ring)
	root.add_child(portrait)
	var face := _label(portrait, "🧑", 32, Color.WHITE)
	face.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	face.vertical_alignment = VERTICAL_ALIGNMENT_CENTER

	# --- tên khu + giờ, chữ nhỏ dưới chân dung
	var info := VBoxContainer.new()
	info.position = Vector2(12, 76)
	info.add_theme_constant_override("separation", 0)
	root.add_child(info)
	area = _label(info, "", 14)
	clock = _label(info, "", 13, Color("d8c8a0"))

	# --- ba nút vuông góc trên phải
	var buttons := HBoxContainer.new()
	buttons.anchor_left = 1.0
	buttons.anchor_right = 1.0
	buttons.offset_left = -170
	buttons.offset_right = -12
	buttons.offset_top = 8
	buttons.alignment = BoxContainer.ALIGNMENT_END
	buttons.add_theme_constant_override("separation", 8)
	root.add_child(buttons)
	_square_button(buttons, "🍲", Color("3f6b45"))
	_square_button(buttons, "📒", Color("4a4038"))
	_square_button(buttons, "⚙", Color("4a4038"))
