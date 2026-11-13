extends SceneTree
## Chạy thử vòng chơi quán phở trên cảnh thật (không cần màn hình):
## mua nguyên liệu ở chợ → vào quán → khách vào ngồi → nhận order → nấu → bưng ra → khách ăn xong trả tiền.
## Cũng kiểm tra va chạm trượt không để nhân vật kẹt trong khối.
##   godot --headless --path godot -s res://tests/integration/pho_shop_loop_test.gd

var fails := 0


func check(cond: bool, what: String) -> void:
	if cond:
		print("ok   ", what)
	else:
		fails += 1
		printerr("FAIL: ", what)


func step(n: int) -> void:
	for i in n:
		await process_frame


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var game: Node3D = (load("res://scenes/street3p.tscn") as PackedScene).instantiate()
	root.add_child(game)
	await step(3)
	var st: GameState = game.state

	# chợ: mua thêm thịt bò
	var money0 := st.money
	var beef0 := st.count("thit_bo")
	game._buy(game.sellers[1], "thit_bo", 2)
	check(st.count("thit_bo") == beef0 + 2 and st.money == money0 - 24, "mua 2 thịt bò ở chợ trừ 24k")
	game.hud.close_panel()

	# va chạm trượt: đi thẳng vào tường/góc nhiều hướng, không bao giờ lọt vào trong khối và vẫn trượt được
	var hero: Chibi = game.hero
	var stuck_inside := false
	var moved := 0.0
	for dir in [Vector2(1, 1), Vector2(-1, 1), Vector2(1, -1), Vector2(-1, -1), Vector2(1, 0), Vector2(0, -1)]:
		hero.position = Vector3(1.5, 0, -2.0)
		for i in 300:
			var a: Vector2 = game.flat(hero.position)
			var np: Vector2 = game._slide(a + dir.normalized() * 0.1, game.HERO_RADIUS)
			if game._overlaps(np, game.HERO_RADIUS - 0.02):
				np = a
			moved += a.distance_to(np)
			hero.position = Vector3(np.x, 0, np.y)
			if game._overlaps(np, game.HERO_RADIUS - 0.05):
				stuck_inside = true
	check(not stuck_inside, "đi vào tường/góc theo 6 hướng không lọt vào trong khối")
	check(moved > 60.0, "trượt dọc tường thay vì đứng khựng (đi được %.0f m)" % moved)

	# vào quán của mình
	for m in game.shop_marks:
		if m["own"]:
			game._enter_now(m)
	check(game.room != null and game.room["kind"] == "pho", "vào được quán Phở Gánh")
	check(game.room["seats"].size() >= 4, "quán có ghế trống cho khách")
	check(game.room["stove"] != null, "quán có bếp")

	game._spawn_customer()
	var cu: Dictionary = game.customers[0]
	for i in 400:
		await process_frame
		game._update_customers(0.05)
		if cu["state"] == "order":
			break
	check(cu["state"] == "order", "khách đi tới ghế và ngồi gọi món")

	game._customer_act(cu)
	check(cu["state"] == "wait" and cu["order"] != "", "nhận order")
	# đảm bảo đủ nguyên liệu cho món khách gọi
	for id in st.recipe(cu["order"])["ingredients"]:
		st.inventory[id] = 1
	game._cook(st.recipe(cu["order"]))
	for i in 200:
		game._update_cooking(0.05)
		if game.cooking.is_empty():
			break
	check(game.carrying == cu["order"], "nấu xong đang bưng đúng món")

	var before := st.money
	game._customer_act(cu)
	check(cu["state"] == "eat" and game.carrying == "", "bưng ra cho khách")
	for i in 400:
		game._update_customers(0.05)
		if cu["state"] == "out":
			break
	check(st.money >= before + int(st.recipe(cu["order"])["price"]) and st.served == 1, "khách ăn xong trả tiền")

	game._exit_now()
	check(game.room == null, "ra lại phố")
	quit(1 if fails > 0 else 0)
