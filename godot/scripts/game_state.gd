class_name GameState
extends RefCounted
## Trạng thái người chơi ở chế độ góc nhìn thứ ba: tiền, máu, thể lực, uy tín, túi đồ, đồng hồ,
## việc vặt đang nhận. Chỉ có logic, không chạm vào cảnh, để kiểm thử được (tests/unit/game_state_economy_test.gd).
## Số liệu lấy từ data/gameplay.json, truyền vào qua `cfg`.

signal changed
signal toast(text: String)

var cfg: Dictionary
var money := 0
var hp := 100.0
var energy := 100.0
var rep := 0
## Phút trong ngày (0..1439); 420 = 7:00
var minute := 420.0
var day := 1
var inventory := {}
## Việc vặt đang làm: {ask, target, item, reward} hoặc {}
var errand := {}
var served := 0
var earned := 0
var walkouts := 0
var _clock_acc := 0.0

const DAYS := ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"]


func _init(config: Dictionary) -> void:
	cfg = config
	var s: Dictionary = cfg["start"]
	money = int(s["money"])
	hp = float(s["hp"])
	energy = float(s["energy"])
	minute = float(s["minute"])
	inventory = (s["inventory"] as Dictionary).duplicate()


## Tên hiển thị của nguyên liệu.
func item_name(id: String) -> String:
	return String(cfg["ingredients"].get(id, {}).get("name", id))


func count(id: String) -> int:
	return int(inventory.get(id, 0))


func recipe(id: String) -> Dictionary:
	for r in cfg["recipes"]:
		if r["id"] == id:
			return r
	return {}


## Còn thiếu nguyên liệu nào cho món này (rỗng = nấu được).
func missing_for(recipe_id: String) -> Array[String]:
	var out: Array[String] = []
	for id in recipe(recipe_id).get("ingredients", []):
		if count(id) < 1:
			out.append(String(id))
	return out


## Trừ nguyên liệu để nấu. Trả về false (và không trừ gì) nếu thiếu.
func cook(recipe_id: String) -> bool:
	if not missing_for(recipe_id).is_empty() or recipe(recipe_id).is_empty():
		return false
	for id in recipe(recipe_id)["ingredients"]:
		inventory[id] = count(id) - 1
	changed.emit()
	return true


## Mua `qty` phần nguyên liệu ở chợ.
func buy(id: String, qty := 1) -> bool:
	var price := int(cfg["ingredients"][id]["price"]) * qty
	if not spend(price):
		return false
	inventory[id] = count(id) + qty
	changed.emit()
	return true


func spend(amount: int) -> bool:
	if amount > money:
		toast.emit("Không đủ tiền")
		return false
	money -= amount
	changed.emit()
	return true


## Nhận tiền khách trả cho một bát.
func earn(amount: int, from_customer := true) -> void:
	money += amount
	if from_customer:
		earned += amount
		served += 1
	changed.emit()


## Mua một món/dịch vụ ở quán khác: {price, energy, hp, rep, item, sleep}.
func consume(entry: Dictionary) -> bool:
	if not spend(int(entry["price"])):
		return false
	energy = clampf(energy + float(entry.get("energy", 0)), 0.0, 100.0)
	hp = clampf(hp + float(entry.get("hp", 0)), 0.0, 100.0)
	rep += int(entry.get("rep", 0))
	if entry.has("item"):
		inventory[entry["item"]] = count(entry["item"]) + 1
	if entry.get("sleep", false):
		if minute > 360.0:
			day += 1
		minute = 360.0
	changed.emit()
	return true


func add_rep(n: int) -> void:
	rep = maxi(rep + n, 0)
	changed.emit()


## Chạy đồng hồ và hao thể lực. `running` khi giữ Shift.
func tick(delta: float, moving: bool, running: bool) -> void:
	var gm := delta / float(cfg["clock"]["sec_per_game_minute"])
	minute += gm
	if minute >= 1440.0:
		minute -= 1440.0
		day += 1
	if moving:
		var e: Dictionary = cfg["energy"]
		energy = maxf(energy - gm * float(e["drain_per_game_minute"]) * (float(e["run_multiplier"]) if running else 1.0), 0.0)
	_clock_acc += delta
	if _clock_acc > 0.5:
		_clock_acc = 0.0
		changed.emit()


func is_night() -> bool:
	var c: Dictionary = cfg["clock"]
	return minute >= float(c["night_from"]) or minute < float(c["night_to"])


func is_tired() -> bool:
	return energy < float(cfg["energy"]["tired_below"])


func clock_text() -> String:
	var m := int(minute)
	return "%02d:%02d · %s" % [m / 60, m % 60, DAYS[(day - 1) % 7]]


## "20.286.000đ" từ số nghìn đồng.
static func money_text(k: int) -> String:
	var s := str(absi(k) * 1000)
	var out := ""
	while s.length() > 3:
		out = "." + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return ("-" if k < 0 else "") + s + out + "đ"
