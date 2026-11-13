class_name Hud
extends CanvasLayer
## Giao diện kiểu game web Việt: thẻ người chơi có avatar tròn, tên khu vực, đồng hồ,
## hàng nút tròn góc trên phải, nút "Về quán" góc dưới phải.

const FONT := preload("res://assets/fonts/NotoSans-Bold.ttf")
const RED := Color("c0392b")
const CREAM := Color("fff3dc")
const INK := Color("3a1a10")

var area: Label
var clock: Label


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


func _text(parent: Control, txt: String, size: int, color := CREAM, outline := 6) -> Label:
	var l := Label.new()
	l.text = txt
	var ls := LabelSettings.new()
	ls.font = FONT
	ls.font_size = size
	ls.font_color = color
	ls.outline_size = outline
	ls.outline_color = INK
	l.label_settings = ls
	parent.add_child(l)
	return l


func _round_button(parent: Control, icon: String, caption: String, bg: Color) -> void:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", -2)
	parent.add_child(box)
	var p := PanelContainer.new()
	p.custom_minimum_size = Vector2(54, 54)
	p.add_theme_stylebox_override("panel", _style(bg, CREAM, 27, 3))
	box.add_child(p)
	var ic := _text(p, icon, 26, Color.WHITE, 0)
	ic.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ic.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_text(box, caption, 13).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER


func _ready() -> void:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	var card := HBoxContainer.new()
	card.position = Vector2(14, 12)
	card.add_theme_constant_override("separation", 8)
	root.add_child(card)
	var avatar := PanelContainer.new()
	avatar.custom_minimum_size = Vector2(76, 76)
	avatar.add_theme_stylebox_override("panel", _style(Color("ffd9b8"), RED, 38, 4))
	card.add_child(avatar)
	var face := _text(avatar, "🧑‍🍳", 40, Color.WHITE, 0)
	face.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	face.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var info := VBoxContainer.new()
	info.add_theme_constant_override("separation", 2)
	card.add_child(info)
	var row := HBoxContainer.new()
	info.add_child(row)
	var lv := PanelContainer.new()
	lv.add_theme_stylebox_override("panel", _style(Color("3f8fd2"), CREAM, 10, 2))
	row.add_child(lv)
	_text(lv, "Cấp 12", 15)
	_text(row, "  Chủ quán Phở", 19)
	var money := PanelContainer.new()
	money.add_theme_stylebox_override("panel", _style(Color(0.1, 0.06, 0.04, 0.7), Color("f2b84b"), 12, 2))
	info.add_child(money)
	_text(money, "💰 20.286.000đ    ⭐ 4,6", 16, Color("ffe27a"))
	var bar := ProgressBar.new()
	bar.custom_minimum_size = Vector2(210, 12)
	bar.value = 68
	bar.show_percentage = false
	bar.add_theme_stylebox_override("background", _style(Color(0.1, 0.06, 0.04, 0.7), CREAM, 6, 1))
	bar.add_theme_stylebox_override("fill", _style(Color("6aa84f"), Color("6aa84f"), 6, 0))
	info.add_child(bar)

	var area_box := PanelContainer.new()
	area_box.position = Vector2(14, 100)
	area_box.add_theme_stylebox_override("panel", _style(RED, CREAM, 14, 3))
	root.add_child(area_box)
	area = _text(area_box, "", 17)

	var clock_box := PanelContainer.new()
	clock_box.anchor_left = 0.5
	clock_box.anchor_right = 0.5
	clock_box.offset_left = -95
	clock_box.offset_right = 95
	clock_box.offset_top = 12
	clock_box.add_theme_stylebox_override("panel", _style(CREAM, Color("e8b67a"), 16, 3))
	root.add_child(clock_box)
	clock = _text(clock_box, "", 18, INK, 0)
	clock.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

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
	hb.add_theme_stylebox_override("panel", _style(Color("fff8ec"), RED, 18, 4))
	home.add_child(hb)
	var hi := _text(hb, "🏠", 40, Color.WHITE, 0)
	hi.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hi.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_text(home, "Về quán", 15).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

	var hint := _text(root, "WASD / mũi tên: đi · Chuột trái: bấm để đi · N: ngày/đêm · Lăn chuột: gần/xa", 14)
	hint.anchor_top = 1.0
	hint.anchor_bottom = 1.0
	hint.offset_top = -30
	hint.offset_left = 16
