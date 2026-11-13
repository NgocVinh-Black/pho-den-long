class_name HudGame
extends CanvasLayer
## Giao diện chế độ góc nhìn thứ ba. Chữ MSDF (nét ở mọi độ phân giải), biểu tượng SVG, ảnh chân dung
## render từ Blender. Bố cục theo neo (anchor), co giãn theo màn hình, các khối không chồng nhau:
##   trên trái: thẻ nhân vật + ô theo dõi (đang bưng / việc vặt)   trên giữa: đồng hồ + thông báo
##   trên phải: 5 nút (Món ăn, Túi đồ, Sổ tay, Bản đồ, Cài đặt) có phím tắt
##   dưới trái: tên khu   dưới giữa: ô nhắc [E] + thanh nấu   dưới phải: hướng dẫn phím (H để ẩn)
## Bảng (panel) mở giữa màn hình; hộp thoại người đi đường ở dưới giữa.

signal setting_changed(key: String, value)
## Người chơi click vào ô nhắc [E] (thay cho phím E)
signal prompt_clicked

const UI := "res://assets/ui/"
const DARK := Color(0.13, 0.10, 0.08, 0.92)
const DARK2 := Color(0.20, 0.15, 0.11, 0.96)
const GOLD := Color("c9a55a")
const HOT := Color("f2c84b")
const CREAM := Color("f6edd8")
const INK := Color("1d140e")
const GOOD := Color("7fd36a")
const BAD := Color("ff8a7a")

var font: FontFile
var theme_ui: Theme
var root: Control
var state: GameState
## Hàm trả về dữ liệu bản đồ: {bounds, solids, shops: [{title, pos, own}], hero, markers: [{pos, color, text}]}
var map_source: Callable

var area: Label
var clock: Label
var clock_icon: TextureRect
var hp: ProgressBar
var energy: ProgressBar
var money_lbl: Label
var rep_lbl: Label
var lv_lbl: Label
var tracker: VBoxContainer
var carry_chip: PanelContainer
var carry_lbl: Label
var errand_chip: PanelContainer
var errand_lbl: Label
var goal_lbl: Label
var prompt_box: PanelContainer
var prompt: Label
var progress: ProgressBar
var progress_lbl: Label
var hints: PanelContainer
var toasts: VBoxContainer

var _modal: Control  # bảng đang mở (null = không)
var _dialog: PanelContainer
var _dialog_choices: Array = []  # [[nhãn, Callable]]
var _panel_kind := ""
var _rows: Array[Button] = []  # nút của các dòng trong bảng đang mở, theo thứ tự (phím 1–9)


func _ready() -> void:
	layer = 5
	font = (load("res://assets/fonts/NotoSans-Bold.ttf") as FontFile).duplicate()
	font.multichannel_signed_distance_field = true
	font.msdf_pixel_range = 14
	_build_theme()
	root = Control.new()
	root.theme = theme_ui
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	_build_card()
	_build_tracker()
	_build_clock()
	_build_buttons()
	_build_bottom()
	_build_prompt()


## Gắn trạng thái người chơi; thẻ nhân vật tự cập nhật khi trạng thái đổi.
func bind(s: GameState) -> void:
	state = s
	state.changed.connect(_refresh)
	state.toast.connect(toast)
	_refresh()


func modal_open() -> bool:
	return _modal != null or _dialog != null


# ================================================================ tiện ích
func _box(bg: Color, border: Color, radius: int, bw := 2, shadow := true) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(bw)
	sb.set_corner_radius_all(radius)
	sb.anti_aliasing = true
	if shadow:
		sb.shadow_color = Color(0, 0, 0, 0.35)
		sb.shadow_size = 6
		sb.shadow_offset = Vector2(0, 3)
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 8
	sb.content_margin_bottom = 8
	return sb


func _build_theme() -> void:
	theme_ui = Theme.new()
	theme_ui.default_font = font
	theme_ui.default_font_size = 17
	theme_ui.set_color("font_color", "Label", CREAM)
	theme_ui.set_color("font_outline_color", "Label", INK)
	theme_ui.set_constant("outline_size", "Label", 4)
	theme_ui.set_stylebox("normal", "Button", _box(Color("8c3b2e"), HOT, 10, 2, false))
	theme_ui.set_stylebox("hover", "Button", _box(Color("a8483a"), Color("ffe08a"), 10, 2, false))
	theme_ui.set_stylebox("pressed", "Button", _box(Color("6e2c22"), Color("ffe08a"), 10, 2, false))
	theme_ui.set_stylebox("disabled", "Button", _box(Color(0.3, 0.27, 0.24, 0.9), Color(0.45, 0.4, 0.35), 10, 2, false))
	theme_ui.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	theme_ui.set_color("font_color", "Button", CREAM)
	theme_ui.set_color("font_hover_color", "Button", Color.WHITE)
	theme_ui.set_color("font_disabled_color", "Button", Color(0.75, 0.7, 0.62))
	theme_ui.set_font_size("font_size", "Button", 16)
	theme_ui.set_color("font_color", "CheckButton", CREAM)


func _label(parent: Node, txt: String, size: int, color := CREAM, outline := 4) -> Label:
	var l := Label.new()
	l.text = txt
	var ls := LabelSettings.new()
	ls.font = font
	ls.font_size = size
	ls.font_color = color
	ls.outline_size = outline
	ls.outline_color = INK
	l.label_settings = ls
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(l)
	return l


func _icon(parent: Node, name: String, size: int) -> TextureRect:
	var t := TextureRect.new()
	t.texture = load(UI + name + ".svg")
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.custom_minimum_size = Vector2(size, size)
	t.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(t)
	return t


func _bar(parent: Node, color: Color, value: float, width: int, height := 14) -> ProgressBar:
	var b := ProgressBar.new()
	b.custom_minimum_size = Vector2(width, height)
	b.value = value
	b.show_percentage = false
	b.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var bg := _box(Color(0, 0, 0, 0.55), Color(0, 0, 0, 0.8), 7, 1, false)
	bg.set_content_margin_all(0)
	var fill := _box(color, color.lightened(0.25), 7, 1, false)
	fill.set_content_margin_all(0)
	b.add_theme_stylebox_override("background", bg)
	b.add_theme_stylebox_override("fill", fill)
	parent.add_child(b)
	return b


func _panel(parent: Control, bg := DARK, border := GOLD, radius := 14) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box(bg, border, radius, 2))
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(p)
	return p


## Neo một khối vào góc/cạnh; khối tự lớn theo nội dung về phía trong màn hình.
func _anchor(c: Control, ax: float, ay: float, ox: float, oy: float) -> void:
	c.anchor_left = ax
	c.anchor_right = ax
	c.anchor_top = ay
	c.anchor_bottom = ay
	c.offset_left = ox
	c.offset_right = ox
	c.offset_top = oy
	c.offset_bottom = oy
	c.grow_horizontal = Control.GROW_DIRECTION_END if ax == 0.0 else (Control.GROW_DIRECTION_BEGIN if ax == 1.0 else Control.GROW_DIRECTION_BOTH)
	c.grow_vertical = Control.GROW_DIRECTION_END if ay == 0.0 else (Control.GROW_DIRECTION_BEGIN if ay == 1.0 else Control.GROW_DIRECTION_BOTH)


# ================================================================ khối cố định
func _build_card() -> void:
	var card := _panel(root, DARK, GOLD, 16)
	_anchor(card, 0, 0, 16, 14)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	card.add_child(row)
	var frame := Panel.new()
	frame.custom_minimum_size = Vector2(80, 80)
	frame.add_theme_stylebox_override("panel", _box(Color("4f7a8f"), GOLD, 40, 3, false))
	frame.clip_children = CanvasItem.CLIP_CHILDREN_AND_DRAW
	frame.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(frame)
	var pic := TextureRect.new()
	pic.texture = load(UI + "portrait.png")
	pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	pic.set_anchors_preset(Control.PRESET_FULL_RECT)
	frame.add_child(pic)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)
	row.add_child(col)
	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 8)
	col.add_child(name_row)
	var lv := PanelContainer.new()
	var lvs := _box(Color("b5322a"), CREAM, 9, 2, false)
	lvs.set_content_margin_all(1)
	lvs.content_margin_left = 8
	lvs.content_margin_right = 8
	lv.add_theme_stylebox_override("panel", lvs)
	name_row.add_child(lv)
	lv_lbl = _label(lv, "Cấp 1", 14, CREAM, 0)
	_label(name_row, "Chủ quán Phở", 19)
	for spec in [["heart", Color("d23b2f")], ["bolt", Color("e8b83a")]]:
		var r := HBoxContainer.new()
		r.add_theme_constant_override("separation", 6)
		col.add_child(r)
		_icon(r, spec[0], 18)
		var b := _bar(r, spec[1], 100.0, 170)
		b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		if spec[0] == "heart":
			hp = b
		else:
			energy = b
	var money := HBoxContainer.new()
	money.add_theme_constant_override("separation", 6)
	col.add_child(money)
	_icon(money, "coin", 18)
	money_lbl = _label(money, "0đ", 16, Color("ffe08a"))
	_icon(money, "star", 16)
	rep_lbl = _label(money, "0", 16, Color("ffe08a"))


func _build_tracker() -> void:
	tracker = VBoxContainer.new()
	tracker.add_theme_constant_override("separation", 6)
	tracker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_anchor(tracker, 0, 0, 16, 136)
	root.add_child(tracker)
	var goal := _panel(tracker, Color(0.12, 0.22, 0.12, 0.92), Color("9ff08a"), 10)
	var rg := HBoxContainer.new()
	rg.add_theme_constant_override("separation", 6)
	goal.add_child(rg)
	_icon(rg, "star", 18)
	goal_lbl = _label(rg, "", 15)
	goal_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	goal_lbl.custom_minimum_size = Vector2(250, 0)
	carry_chip = _panel(tracker, Color(0.32, 0.18, 0.10, 0.92), HOT, 10)
	var r1 := HBoxContainer.new()
	r1.add_theme_constant_override("separation", 6)
	carry_chip.add_child(r1)
	_icon(r1, "food", 20)
	carry_lbl = _label(r1, "", 15)
	carry_chip.visible = false
	errand_chip = _panel(tracker, Color(0.10, 0.20, 0.26, 0.92), Color("6ad0ff"), 10)
	var r2 := HBoxContainer.new()
	r2.add_theme_constant_override("separation", 6)
	errand_chip.add_child(r2)
	_icon(r2, "bag", 20)
	errand_lbl = _label(r2, "", 15)
	errand_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	errand_lbl.custom_minimum_size = Vector2(250, 0)
	errand_chip.visible = false


func _build_clock() -> void:
	var col := VBoxContainer.new()
	col.alignment = BoxContainer.ALIGNMENT_BEGIN
	col.add_theme_constant_override("separation", 8)
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_anchor(col, 0.5, 0, 0, 14)
	root.add_child(col)
	var box := _panel(col, DARK, GOLD, 18)
	box.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 8)
	box.add_child(row)
	clock_icon = _icon(row, "sun", 22)
	clock = _label(row, "07:00 · Thứ Hai", 18)
	toasts = VBoxContainer.new()
	toasts.add_theme_constant_override("separation", 6)
	toasts.mouse_filter = Control.MOUSE_FILTER_IGNORE
	col.add_child(toasts)


const BUTTONS := [["food", "Món ăn", "F"], ["bag", "Túi đồ", "Tab"], ["book", "Sổ tay", "J"], ["map", "Bản đồ", "M"], ["gear", "Cài đặt", "Esc"]]


func _build_buttons() -> void:
	var bar := HBoxContainer.new()
	bar.add_theme_constant_override("separation", 8)
	_anchor(bar, 1, 0, -16, 14)
	root.add_child(bar)
	for spec in BUTTONS:
		var v := VBoxContainer.new()
		v.add_theme_constant_override("separation", 2)
		bar.add_child(v)
		var b := Button.new()
		b.custom_minimum_size = Vector2(54, 54)
		b.focus_mode = Control.FOCUS_NONE
		b.icon = load(UI + spec[0] + ".svg")
		b.expand_icon = true
		b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		b.add_theme_stylebox_override("normal", _box(DARK, GOLD, 12, 2))
		b.add_theme_stylebox_override("hover", _box(Color(0.25, 0.19, 0.12, 0.95), HOT, 12, 3))
		b.add_theme_stylebox_override("pressed", _box(Color(0.35, 0.25, 0.14, 0.95), HOT, 12, 3))
		for k in ["normal", "hover", "pressed"]:
			(b.get_theme_stylebox(k) as StyleBoxFlat).set_content_margin_all(8)
		b.tooltip_text = "%s (%s)" % [spec[1], spec[2]]
		b.pressed.connect(open_named.bind(spec[0]))
		v.add_child(b)
		var cap := _label(v, spec[1], 14, CREAM, 5)
		cap.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER


func _build_bottom() -> void:
	var box := _panel(root, DARK, GOLD, 14)
	_anchor(box, 0, 1, 16, -16)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	box.add_child(row)
	_icon(row, "map", 20)
	area = _label(row, "Ngõ Phố Cổ", 17)
	hints = _panel(root, Color(0.10, 0.08, 0.06, 0.72), Color(0.79, 0.65, 0.35, 0.6), 12)
	_anchor(hints, 1, 1, -16, -16)
	var h := _label(hints, "WASD đi · Shift chạy · Space nhảy · E tương tác\nChuột phải/Q·R xoay · Lăn chuột gần/xa\nF món · Tab túi · J sổ · M bản đồ · H ẩn", 13, Color(1, 1, 1, 0.9), 3)
	h.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT


func _build_prompt() -> void:
	var col := VBoxContainer.new()
	col.alignment = BoxContainer.ALIGNMENT_END
	col.add_theme_constant_override("separation", 6)
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_anchor(col, 0.5, 1, 0, -96)
	root.add_child(col)
	var pb := VBoxContainer.new()
	pb.add_theme_constant_override("separation", 2)
	pb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	col.add_child(pb)
	progress_lbl = _label(pb, "", 15)
	progress_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	progress = _bar(pb, Color("e8b83a"), 0.0, 260, 16)
	progress.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	pb.visible = false
	progress.set_meta("box", pb)
	prompt_box = _panel(col, DARK, HOT, 14)
	prompt_box.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	prompt_box.visible = false
	prompt_box.mouse_filter = Control.MOUSE_FILTER_STOP
	prompt_box.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	prompt_box.tooltip_text = "Bấm E hoặc click vào đây"
	prompt_box.gui_input.connect(func(e: InputEvent):
		if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT:
			prompt_clicked.emit())
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	prompt_box.add_child(row)
	var key := PanelContainer.new()
	var ks := _box(CREAM, INK, 6, 2, false)
	ks.set_content_margin_all(1)
	ks.content_margin_left = 9
	ks.content_margin_right = 9
	key.add_theme_stylebox_override("panel", ks)
	row.add_child(key)
	_label(key, "E", 17, INK, 0)
	prompt = _label(row, "", 18)


# ================================================================ cập nhật
func _refresh() -> void:
	if state == null:
		return
	hp.value = state.hp
	energy.value = state.energy
	money_lbl.text = GameState.money_text(state.money)
	rep_lbl.text = str(state.rep)
	lv_lbl.text = "Cấp %d" % (1 + state.rep / 5)
	clock.text = state.clock_text()
	clock_icon.texture = load(UI + ("moon" if state.is_night() else "sun") + ".svg")
	errand_chip.visible = not state.errand.is_empty()
	if errand_chip.visible:
		errand_lbl.text = "Mang %s tới %s  (+%s)" % [state.errand["item"], String(state.errand["target_title"]).capitalize(), GameState.money_text(int(state.errand["reward"]))]


func set_prompt(text: String) -> void:
	prompt_box.visible = text != "" and not modal_open()
	prompt.text = text


## Dòng "Việc cần làm" ở góc trên trái.
func set_goal(text: String) -> void:
	goal_lbl.text = "Việc cần làm: " + text


func set_carry(text: String) -> void:
	carry_chip.visible = text != ""
	carry_lbl.text = "Đang bưng: " + text


## v < 0 thì ẩn thanh tiến độ.
func set_progress(text: String, v: float) -> void:
	var pb: Control = progress.get_meta("box")
	pb.visible = v >= 0.0
	progress_lbl.text = text
	progress.value = v * 100.0


func toggle_hints() -> void:
	_hints_on = not _hints_on
	_sync_hints()


func toast(text: String, color := CREAM) -> void:
	var p := _panel(toasts, Color(0.12, 0.09, 0.07, 0.9), HOT, 12)
	p.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var l := _label(p, text, 16, color)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	while toasts.get_child_count() > 3:
		toasts.get_child(0).free()
	var tw := p.create_tween()
	tw.tween_interval(2.6)
	tw.tween_property(p, "modulate:a", 0.0, 0.4)
	tw.tween_callback(p.queue_free)


# ================================================================ bảng giữa màn hình
## Mở một bảng có tiêu đề; trả về hộp nội dung (VBox trong vùng cuộn) để điền.
func open_panel(title: String, kind := "", width := 560.0, height := 440.0) -> VBoxContainer:
	close_panel()
	_rows.clear()
	_panel_kind = kind
	var back := ColorRect.new()
	back.color = Color(0, 0, 0, 0.45)
	back.set_anchors_preset(Control.PRESET_FULL_RECT)
	back.mouse_filter = Control.MOUSE_FILTER_STOP
	back.gui_input.connect(func(e: InputEvent):
		if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT:
			close_panel())
	root.add_child(back)
	_modal = back
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box(DARK2, GOLD, 18, 3))
	p.anchor_left = 0.5
	p.anchor_right = 0.5
	p.anchor_top = 0.5
	p.anchor_bottom = 0.5
	p.offset_left = -width / 2
	p.offset_right = width / 2
	p.offset_top = -height / 2
	p.offset_bottom = height / 2
	p.mouse_filter = Control.MOUSE_FILTER_STOP
	back.add_child(p)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	p.add_child(col)
	var head := HBoxContainer.new()
	col.add_child(head)
	var t := _label(head, title, 22, Color("ffe08a"))
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var x := Button.new()
	x.text = "✕  Esc"
	x.focus_mode = Control.FOCUS_NONE
	x.pressed.connect(close_panel)
	head.add_child(x)
	var sep := HSeparator.new()
	col.add_child(sep)
	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	col.add_child(sc)
	var body := VBoxContainer.new()
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 8)
	sc.add_child(body)
	set_prompt(prompt.text)
	_sync_hints()
	return body


func close_panel() -> void:
	if _modal:
		_modal.queue_free()
		_modal = null
		_panel_kind = ""
	set_prompt(prompt.text)
	_sync_hints()


func panel_kind() -> String:
	return _panel_kind if _modal else ""


## Một dòng trong bảng: chữ chính, chữ phụ, nút bên phải. Trả về nút.
func row(body: Control, title: String, sub: String, button: String, enabled: bool, on_press: Callable, swatch := Color.TRANSPARENT) -> Button:
	var p := PanelContainer.new()
	var sb := _box(Color(1, 1, 1, 0.05), Color(1, 1, 1, 0.12), 10, 1, false)
	p.add_theme_stylebox_override("panel", sb)
	body.add_child(p)
	var r := HBoxContainer.new()
	r.add_theme_constant_override("separation", 10)
	p.add_child(r)
	if swatch.a > 0.0:
		var c := Panel.new()
		c.custom_minimum_size = Vector2(26, 26)
		c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		c.add_theme_stylebox_override("panel", _box(swatch, INK, 6, 2, false))
		r.add_child(c)
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.add_theme_constant_override("separation", 0)
	r.add_child(col)
	_label(col, title, 17)
	if sub != "":
		var s := _label(col, sub, 14, Color(0.9, 0.84, 0.72), 2)
		s.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	if button == "":
		b.visible = false
	if button != "" and _rows.size() < 9:
		_rows.append(b)
		button = "[%d] %s" % [_rows.size(), button]
	b.text = button
	b.disabled = not enabled
	b.custom_minimum_size = Vector2(124, 38)
	b.pressed.connect(on_press)
	r.add_child(b)
	return b


## Bấm nút của dòng thứ i (phím số).
func press_row(i: int) -> void:
	if i < _rows.size() and is_instance_valid(_rows[i]) and not _rows[i].disabled:
		_rows[i].pressed.emit()


func note(body: Control, text: String, color := Color(0.92, 0.86, 0.74), size := 15) -> Label:
	var l := _label(body, text, size, color, 2)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


## Mở bảng theo tên nút: food, bag, book, map, gear. Bấm lại nút của bảng đang mở thì đóng.
func open_named(kind: String) -> void:
	if panel_kind() == kind:
		close_panel()
		return
	match kind:
		"food":
			_open_recipes()
		"bag":
			_open_bag()
		"book":
			_open_book()
		"map":
			_open_map()
		"gear":
			_open_settings()


func _open_recipes() -> void:
	var body := open_panel("Món ăn của quán", "food")
	note(body, "Nấu ở bếp trong quán Phở Gánh (dãy phố bên trái). Mỗi bát cần đủ các nguyên liệu dưới đây; thiếu thì ra chợ mua.")
	for r in state.cfg["recipes"]:
		var parts: Array[String] = []
		for id in r["ingredients"]:
			parts.append("%s %d" % [state.item_name(id), state.count(id)])
		var ok := state.missing_for(r["id"]).is_empty()
		row(body, "%s  ·  %s" % [r["name"], GameState.money_text(int(r["price"]))], "Có: " + ", ".join(parts),
			"Nấu được" if ok else "Thiếu đồ", false, func(): pass, GOOD if ok else BAD)


func _open_bag() -> void:
	var body := open_panel("Túi đồ", "bag")
	note(body, "Tiền: %s   ·   Uy tín: %d" % [GameState.money_text(state.money), state.rep], Color("ffe08a"), 17)
	var any := false
	for id in state.cfg["ingredients"]:
		var n := state.count(id)
		if n > 0:
			any = true
			row(body, "%s × %d" % [state.item_name(id), n], "", "", false, func(): pass, Color(state.cfg["ingredients"][id]["color"]))
	if not any:
		note(body, "Túi trống. Ra chợ (bên phải ngã tư) mua nguyên liệu nhé.")
	if not state.errand.is_empty():
		row(body, String(state.errand["item"]).capitalize(), "Đồ mang hộ, giao tới " + String(state.errand["target_title"]).capitalize(), "", false, func(): pass, Color("6ad0ff"))


func _open_book() -> void:
	var body := open_panel("Sổ tay", "book")
	note(body, "Hôm nay", Color("ffe08a"), 18)
	note(body, "Đã bán %d bát · Thu %s · Khách bỏ về %d" % [state.served, GameState.money_text(state.earned), state.walkouts])
	note(body, "Việc vặt", Color("ffe08a"), 18)
	if state.errand.is_empty():
		note(body, "Chưa nhận việc nào. Người đi đường có dấu ! trên đầu đang cần nhờ.")
	else:
		note(body, "Mang %s tới %s, được %s." % [state.errand["item"], String(state.errand["target_title"]).capitalize(), GameState.money_text(int(state.errand["reward"]))])
	note(body, "Cách chơi", Color("ffe08a"), 18)
	note(body, "1. Ra chợ bấm E ở sạp để mua bánh phở, thịt, xương, rau.\n2. Vào quán Phở Gánh, khách vào ngồi có dấu ! → bấm E nhận order.\n3. Bấm E ở bếp chọn món để nấu, rồi bưng ra đúng bàn.\n4. Đói, mệt thì vào quán khác ngồi ăn; tối vào nhà nghỉ ngủ.")


func _open_map() -> void:
	var body := open_panel("Bản đồ khu phố", "map", 720.0, 560.0)
	var m := Control.new()
	m.custom_minimum_size = Vector2(680, 440)
	m.mouse_filter = Control.MOUSE_FILTER_IGNORE
	m.clip_contents = true
	body.add_child(m)
	m.draw.connect(_draw_map.bind(m))
	var legend := HBoxContainer.new()
	legend.add_theme_constant_override("separation", 16)
	body.add_child(legend)
	for spec in [["Bạn", Color("4fb3ff")], ["Quán của bạn", Color("e2412f")], ["Chợ", GOOD], ["Việc vặt", Color("6ad0ff")], ["Quán khác", HOT]]:
		var c := ColorRect.new()
		c.color = spec[1]
		c.custom_minimum_size = Vector2(14, 14)
		c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		legend.add_child(c)
		_label(legend, spec[0], 14)


func _draw_map(m: Control) -> void:
	if not map_source.is_valid():
		return
	var d: Dictionary = map_source.call()
	var b: Rect2 = d["bounds"]
	var sc := minf(m.size.x / b.size.x, m.size.y / b.size.y)
	var off := (m.size - b.size * sc) / 2.0
	var P := func(v: Vector2) -> Vector2: return off + (v - b.position) * sc
	m.draw_rect(Rect2(off, b.size * sc), Color("cfc2a2"))
	for pts in d.get("roads", []):
		var sp := PackedVector2Array()
		for v in pts:
			sp.append(P.call(v))
		m.draw_polyline(sp, Color("77777a"), 3.6 * sc, true)
	for r in d["solids"]:
		var rr: Rect2 = (r as Rect2).intersection(b)
		if rr.size.x <= 0.0 or rr.size.y <= 0.0:
			continue
		var big := rr.size.x * rr.size.y > 6.0
		m.draw_rect(Rect2(P.call(rr.position), rr.size * sc), Color("8a6a4a") if big else Color("a08868"))
	for s in d["shops"]:
		var c: Color = Color("e2412f") if s.get("own", false) else HOT
		var p: Vector2 = P.call(s["pos"])
		m.draw_circle(p, 5.0 if not s.get("own", false) else 8.0, c)
	for mk in d.get("markers", []):
		var p2: Vector2 = P.call(mk["pos"])
		m.draw_circle(p2, 9.0, mk["color"])
		m.draw_string(font, p2 + Vector2(12, 5), mk["text"], HORIZONTAL_ALIGNMENT_LEFT, -1, 15, INK)
	var hp2: Vector2 = P.call(d["hero"])
	m.draw_circle(hp2, 8.0, Color.WHITE)
	m.draw_circle(hp2, 6.0, Color("4fb3ff"))


func _open_settings() -> void:
	var body := open_panel("Cài đặt", "gear", 480.0, 380.0)
	var night := CheckButton.new()
	night.text = "Ban đêm (đèn lồng)"
	night.button_pressed = state.is_night()
	night.toggled.connect(func(v: bool): setting_changed.emit("night", v))
	body.add_child(night)
	var hint := CheckButton.new()
	hint.text = "Hiện hướng dẫn phím"
	hint.button_pressed = _hints_on
	hint.toggled.connect(func(v: bool): _hints_on = v)
	body.add_child(hint)
	note(body, "Độ nhạy chuột khi xoay camera")
	var sl := HSlider.new()
	sl.min_value = 0.05
	sl.max_value = 0.6
	sl.step = 0.01
	sl.value = 0.25
	sl.custom_minimum_size = Vector2(300, 24)
	sl.value_changed.connect(func(v: float): setting_changed.emit("sensitivity", v))
	body.add_child(sl)
	var q := Button.new()
	q.text = "Thoát game"
	q.focus_mode = Control.FOCUS_NONE
	q.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	q.pressed.connect(func(): get_tree().quit())
	body.add_child(q)


# ================================================================ hộp thoại
## Hộp thoại dưới giữa màn hình. choices: [[nhãn, Callable], …]; lựa chọn đầu nhận bằng E/Space,
## lựa chọn cuối bằng Esc. Không có lựa chọn thì E/Esc đóng.
func show_dialog(speaker: String, text: String, choices: Array = []) -> void:
	close_dialog()
	_dialog_choices = choices
	_dialog = PanelContainer.new()
	_dialog.add_theme_stylebox_override("panel", _box(DARK2, HOT, 16, 3))
	_dialog.anchor_left = 0.5
	_dialog.anchor_right = 0.5
	_dialog.anchor_top = 1.0
	_dialog.anchor_bottom = 1.0
	_dialog.offset_left = -340
	_dialog.offset_right = 340
	_dialog.offset_bottom = -24
	_dialog.offset_top = -24
	_dialog.grow_vertical = Control.GROW_DIRECTION_BEGIN
	root.add_child(_dialog)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	_dialog.add_child(col)
	_label(col, speaker, 17, Color("ffe08a"))
	var t := _label(col, text, 18)
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var r := HBoxContainer.new()
	r.alignment = BoxContainer.ALIGNMENT_END
	r.add_theme_constant_override("separation", 10)
	col.add_child(r)
	if choices.is_empty():
		choices = [["Tiếp", func(): pass]]
		_dialog_choices = choices
	for i in choices.size():
		var b := Button.new()
		var key := "[E] " if i == 0 else ("[Esc] " if i == choices.size() - 1 else "")
		b.text = key + String(choices[i][0])
		b.focus_mode = Control.FOCUS_NONE
		b.pressed.connect(_choose.bind(i))
		r.add_child(b)
	set_prompt(prompt.text)
	_sync_hints()


func _choose(i: int) -> void:
	var cb: Callable = _dialog_choices[i][1]
	close_dialog()
	cb.call()


func dialog_key(accept: bool) -> void:
	if _dialog == null:
		return
	_choose(0 if accept else _dialog_choices.size() - 1)


func close_dialog() -> void:
	if _dialog:
		_dialog.queue_free()
		_dialog = null
	set_prompt(prompt.text)
	_sync_hints()


var _hints_on := true


## Ô hướng dẫn ẩn khi có bảng / hộp thoại để không chồng lên nhau.
func _sync_hints() -> void:
	hints.visible = _hints_on and _modal == null and _dialog == null


func dialog_open() -> bool:
	return _dialog != null
