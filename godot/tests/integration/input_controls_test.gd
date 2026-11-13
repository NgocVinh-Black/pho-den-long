extends SceneTree
## Giả lập bàn phím/chuột thật (Input.parse_input_event) trên cảnh street3p để chắc người chơi bấm được:
## WASD đi, Space nhảy, E vào quán, M mở bản đồ, Esc đóng, click chuột vào nút HUD.
##   godot --headless --path godot -s res://tests/integration/input_controls_test.gd

var fails := 0


func check(cond: bool, what: String) -> void:
	if cond:
		print("ok   ", what)
	else:
		fails += 1
		printerr("FAIL: ", what)


func key(code: Key, pressed: bool) -> void:
	var e := InputEventKey.new()
	e.keycode = code
	e.physical_keycode = code
	e.pressed = pressed
	Input.parse_input_event(e)


func tap(code: Key) -> void:
	key(code, true)
	await process_frame
	await process_frame
	key(code, false)
	await process_frame


func frames(n: int) -> void:
	for i in n:
		await process_frame


## Click vào điểm `at` (toạ độ giao diện) — đổi sang toạ độ cửa sổ như chuột thật.
func click(at: Vector2) -> void:
	at = root.get_final_transform() * at
	var mv := InputEventMouseMotion.new()
	mv.position = at
	mv.global_position = at
	Input.parse_input_event(mv)
	await process_frame
	for down in [true, false]:
		var e := InputEventMouseButton.new()
		e.button_index = MOUSE_BUTTON_LEFT
		e.pressed = down
		e.position = at
		e.global_position = at
		Input.parse_input_event(e)
		await process_frame


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var game: Node3D = (load("res://scenes/street3p.tscn") as PackedScene).instantiate()
	root.add_child(game)
	await frames(5)

	var p0: Vector3 = game.hero.position
	key(KEY_W, true)
	await frames(30)
	key(KEY_W, false)
	await frames(2)
	check(game.hero.position.distance_to(p0) > 0.2, "giữ W thì nhân vật đi (%.2f m)" % game.hero.position.distance_to(p0))

	await tap(KEY_SPACE)
	await frames(3)
	check(game.hero.position.y > 0.05 or game.jump_h > 0.0, "Space thì nhảy lên")
	await frames(60)

	await tap(KEY_M)
	check(game.hud.panel_kind() == "map", "M mở bản đồ")
	await tap(KEY_ESCAPE)
	check(not game.hud.modal_open(), "Esc đóng bảng")

	# click chuột vào nút Túi đồ trên HUD
	var bag: Button = null
	for b in game.hud.root.find_children("*", "Button", true, false):
		if (b as Button).tooltip_text.begins_with("Túi đồ"):
			bag = b
	await frames(2)
	await click(bag.get_global_rect().get_center())
	await frames(3)
	check(game.hud.panel_kind() == "bag", "click chuột vào nút Túi đồ mở túi")
	await tap(KEY_ESCAPE)

	# đi tới cửa quán của mình rồi bấm E
	for m in game.shop_marks:
		if m["own"]:
			game.hero.position = m["door"]
	await frames(5)
	check(game.focus != null, "đứng ở cửa quán thì có gợi ý E")
	await tap(KEY_E)
	await create_timer(0.8).timeout
	check(game.room != null, "bấm E vào được quán")
	await tap(KEY_E)  # ra lại phố (đang đứng trên vòng ra)
	await create_timer(0.8).timeout
	check(game.room == null, "bấm E ở vòng xanh thì ra phố")

	# việc vặt: tới gần người có dấu !, bấm E, click "Nhận việc"
	var giver = null
	for w in game.walkers:
		if w.has("errand"):
			giver = w
	game.hero.position = (giver["c"] as Node3D).position + Vector3(0.6, 0, 0)
	giver["wait"] = 5.0
	await frames(3)
	check(game.focus != null and String(game.focus["text"]).contains("việc"), "đứng cạnh người có ! thì hiện Nhận việc vặt")
	await tap(KEY_E)
	check(game.hud.dialog_open(), "bấm E mở hộp thoại")
	var accept: Button = null
	for b in game.hud._dialog.find_children("*", "Button", true, false):
		if (b as Button).text.contains("Nhận việc"):
			accept = b
	await click(accept.get_global_rect().get_center())
	await frames(3)
	check(not game.state.errand.is_empty(), "click Nhận việc thì nhận được việc")

	# giao việc: vào đúng quán đích
	for m in game.shop_marks:
		if m["shop"]["title"] == game.state.errand["target_title"]:
			game.hero.position = m["door"]
	var money: int = game.state.money
	await frames(3)
	await tap(KEY_E)
	await create_timer(0.8).timeout
	check(game.state.errand.is_empty() and game.state.money > money, "vào quán đích thì giao xong, được thưởng")

	# quán đích có quầy: tới quầy bấm E, click mua món đầu tiên
	game.hero.position = game.room["service"]
	await frames(3)
	await tap(KEY_E)
	check(game.hud.modal_open(), "tới quầy bấm E mở thực đơn/dịch vụ")
	var buy: Button = null
	for b in game.hud._modal.find_children("*", "Button", true, false):
		if (b as Button).text.contains("Mua") and not (b as Button).disabled:
			buy = b
			break
	money = game.state.money
	await click(buy.get_global_rect().get_center())
	await frames(3)
	check(game.state.money < money, "click Mua thì trả tiền, dùng được dịch vụ")

	# không dùng chuột: mở lại quầy, bấm phím 1 để mua
	await frames(3)
	await tap(KEY_E)
	money = game.state.money
	await tap(KEY_1)
	await frames(3)
	check(game.state.money < money, "bấm phím 1 trong bảng thì mua được (không cần chuột)")
	quit(1 if fails > 0 else 0)
