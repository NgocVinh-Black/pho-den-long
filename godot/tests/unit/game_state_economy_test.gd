extends SceneTree
## Kiểm thử GameState (logic tiền, nấu, mua, đồng hồ). Chạy:
##   godot --headless --path godot -s res://tests/unit/game_state_economy_test.gd
## Thoát mã 0 nếu qua hết, 1 nếu có lỗi.

var fails := 0


func _cfg() -> Dictionary:
	return {
		"start": {"money": 100, "hp": 50, "energy": 50, "minute": 420, "inventory": {"a": 1, "b": 1}},
		"clock": {"sec_per_game_minute": 1.0, "night_from": 1080, "night_to": 330},
		"energy": {"drain_per_game_minute": 1.0, "run_multiplier": 2.0, "tired_below": 15},
		"ingredients": {"a": {"name": "A", "price": 4}, "b": {"name": "B", "price": 10}},
		"recipes": [{"id": "r", "name": "R", "price": 30, "ingredients": ["a", "b"]}],
	}


func check(cond: bool, what: String) -> void:
	if not cond:
		fails += 1
		printerr("FAIL: ", what)
	else:
		print("ok   ", what)


func _init() -> void:
	var s := GameState.new(_cfg())
	check(s.missing_for("r").is_empty(), "đủ nguyên liệu thì không thiếu gì")
	check(s.cook("r"), "nấu được khi đủ nguyên liệu")
	check(s.count("a") == 0 and s.count("b") == 0, "nấu xong trừ mỗi thứ một phần")
	check(not s.cook("r"), "hết nguyên liệu thì không nấu được")
	check(Array(s.missing_for("r")) == ["a", "b"], "liệt kê đúng thứ còn thiếu")

	check(s.buy("b", 2) and s.money == 80 and s.count("b") == 2, "mua 2 phần b trừ 20k")
	check(not s.buy("b", 9) and s.money == 80, "không đủ tiền thì không mua, không trừ tiền")

	s.earn(30)
	check(s.money == 110 and s.served == 1 and s.earned == 30, "bán một bát cộng tiền và đếm khách")

	check(s.consume({"price": 10, "energy": 80, "hp": -60}) and s.energy == 100.0 and s.hp == 0.0, "ăn uống giới hạn 0..100")
	s.minute = 1430.0
	s.tick(20.0, false, false)
	check(s.day == 2 and is_equal_approx(s.minute, 10.0), "qua nửa đêm sang ngày mới")
	check(s.is_night(), "0 giờ 10 là ban đêm")
	s.energy = 50.0
	s.tick(5.0, true, true)
	check(is_equal_approx(s.energy, 40.0), "chạy hao thể lực gấp đôi")
	check(s.consume({"price": 0, "sleep": true}) and s.minute == 360.0 and s.day == 2, "ngủ sau nửa đêm dậy 6 giờ cùng ngày")

	check(GameState.money_text(20286) == "20.286.000đ", "định dạng tiền có dấu chấm")
	check(GameState.money_text(5) == "5.000đ", "định dạng tiền nhỏ")
	quit(1 if fails > 0 else 0)
