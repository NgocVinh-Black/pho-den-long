# Thư Bà nội — Phố Đèn Lồng

> canon: draft | người nói (tất cả): **Bà nội** (ngoài màn hình, chỉ qua thư; xem `lore-neighbors.md`).
> Mỗi thư là một chuỗi dòng `banoi.<event>.<n>` đọc theo thứ tự, mỗi dòng ≤120 ký tự. Không chỉ dẫn cơ chế.
> Placeholder: {playerName} {shopName} {money} {day} {stars}. `{money}` do game điền (số tiền bà gửi), không viết số cứng.
> Giọng: ấm, ngắn, không từ địa phương; gọi người chơi "cháu" (trung tính). Ký tên "Bà nội".

## Thư cứu trợ (gần hết tiền) — thay cho "Cố lên cháu!"

Điều kiện: người chơi gần hết tiền (cơ chế hiện có). Chọn một trong 5 biến thể, xoay vòng, không lặp liên tiếp.

**rescue_a**
- `banoi.rescue_a.1` {playerName} à, thư cháu ngắn quá, bà đọc giữa dòng mà thấy lo.
- `banoi.rescue_a.2` Bà gửi cháu {money}. Cứ cầm, đừng nghĩ chuyện trả.
- `banoi.rescue_a.3` Ăn một bữa nóng trước, tính toán sau. Bà nội.

**rescue_b**
- `banoi.rescue_b.1` Cháu ơi, ống tiền của bà hôm nay nhẹ đi một chút. Bà gửi cháu {money}.
- `banoi.rescue_b.2` Không phải tiền cho vay đâu. Là tiền của bà muốn ở bên cháu.
- `banoi.rescue_b.3` Thức khuya thì nhớ mặc ấm nhé. Bà nội.

**rescue_c**
- `banoi.rescue_c.1` Bà đếm tiền mà lẫn hết, đếm bốn lần mới ra {money}. Cháu nhận giùm bà.
- `banoi.rescue_c.2` Nhà vẫn ổn. Chỉ có con gà trống nhà bên là vẫn la như mọi hôm.
- `banoi.rescue_c.3` Cứ bình tĩnh, đường nào rồi cũng có ngã rẽ. Bà nội.

**rescue_d**
- `banoi.rescue_d.1` Hôm qua bà thắp đèn hiên, nghĩ đến cháu đứng quầy giữa phố.
- `banoi.rescue_d.2` Bà gửi {money}. Đủ để cháu thở một nhịp, rồi đứng dậy nấu tiếp.
- `banoi.rescue_d.3` Bà tin cháu. Bà nội.

**rescue_e**
- `banoi.rescue_e.1` Vấp một bước đâu có sao, cháu. Bà từng vấp nhiều hơn cháu tưởng.
- `banoi.rescue_e.2` Có {money} kèm theo thư. Mua đồ ngon cho quán, đừng tiếc.
- `banoi.rescue_e.3` Rồi sẽ có đêm khách đông. Bà nội.

## Ngày đầu đóng quán

Điều kiện: lần đầu đóng quán (một lần).

**firstday**
- `banoi.firstday.1` Vậy là {shopName} đã qua đêm đầu tiên rồi nhỉ. Bà đọc thư mà mừng.
- `banoi.firstday.2` Đêm đầu có khách ít cũng đừng buồn. Nồi nào cũng ấm dần lên từ ngọn lửa nhỏ.
- `banoi.firstday.3` Đi ngủ sớm một chút nhé. Bà nội.

## Học công thức

Điều kiện: học công thức 2 (cần 5⭐), học công thức 3 (cần 15⭐). Một lần mỗi mốc.

**recipe2**
- `banoi.recipe2.1` Cháu học thêm một món mới à? Giỏi quá, bà khoe với cả xóm rồi.
- `banoi.recipe2.2` Có {stars} sao mà vẫn chịu học tiếp, ấy là cháu biết nhìn xa.
- `banoi.recipe2.3` Tay nghề là thứ không ai lấy mất của cháu. Bà nội.

**recipe3**
- `banoi.recipe3.1` Món thứ ba rồi! Bà đọc thư hai lần cho chắc.
- `banoi.recipe3.2` Đã có {stars} sao, thế là người ta tin cháu rồi.
- `banoi.recipe3.3` Đừng quên món đầu tiên đã dạy cháu đứng quầy. Bà nội.

## Lên cấp quán

Điều kiện: `shopLevel` đạt 2, 3, 4, 5. Một lần mỗi mốc.

**levelup2**
- `banoi.levelup2.1` {shopName} rộng ra rồi hả cháu. Bà tưởng tượng thấy mà thích.
- `banoi.levelup2.2` Chỗ rộng ra thì lòng cũng đừng chật lại nhé.
- `banoi.levelup2.3` Bà nội.

**levelup3**
- `banoi.levelup3.1` Quán lên thêm một bậc nữa. Hồi bà gánh hàng, chỉ có mỗi cái đòn gánh.
- `banoi.levelup3.2` Cháu có {shopName}, bà thấy đáng mừng hơn mọi thứ.
- `banoi.levelup3.3` Giữ sức khoẻ nhé. Bà nội.

**levelup4**
- `banoi.levelup4.1` Quán lên bốn bậc rồi, bà kể cho cả xóm nghe, ai cũng gửi lời hỏi thăm cháu.
- `banoi.levelup4.2` Lớn thế nào cũng được, miễn cháu vẫn nhớ bát cơm đầu tiên mình nấu.
- `banoi.levelup4.3` Bà nội.

**levelup5**
- `banoi.levelup5.1` Bậc cao nhất rồi sao? Bà đọc đến đây phải gỡ kính ra lau.
- `banoi.levelup5.2` Bà không hỏi cháu có giàu không. Bà chỉ hỏi cháu có vui không.
- `banoi.levelup5.3` {playerName}, cháu làm bà tự hào. Bà nội.

## Dây đèn lồng

Điều kiện: `lantern` đạt 1..5. Một lần mỗi mốc. (Dây đèn lồng là đèn chung của phố, không phải chùm đèn trong quán.)

**lantern1**
- `banoi.lantern1.1` Cháu mới treo dây đèn lồng đầu tiên à? Bà nhớ ngọn đèn hiên nhà mình.
- `banoi.lantern1.2` Một ngọn đèn nhỏ cũng đủ cho người đi đường nhìn thấy cửa.
- `banoi.lantern1.3` Bà nội.

**lantern2**
- `banoi.lantern2.1` Hai dây đèn rồi. Bà chắc phố sáng hơn nhiều.
- `banoi.lantern2.2` Đèn sáng thì người ta dừng lại. Người dừng lại thì biết cháu ở đó.
- `banoi.lantern2.3` Bà nội.

**lantern3**
- `banoi.lantern3.1` Ba dây đèn! Bà đếm trên ngón tay, còn hai dây nữa là đủ.
- `banoi.lantern3.2` Nhưng đủ hay chưa, ấy là cháu quyết, không phải bà.
- `banoi.lantern3.3` Bà nội.

**lantern4**
- `banoi.lantern4.1` Bốn dây đèn, bà thấy cả phố trong thư cháu cũng sáng lên.
- `banoi.lantern4.2` Mỗi ngọn đèn là một lời chào. Cháu chào nhiều thì phố chào lại.
- `banoi.lantern4.3` Bà nội.

**lantern5**
- `banoi.lantern5.1` Năm dây đèn lồng, trọn đủ rồi. Bà xúc động hết cả.
- `banoi.lantern5.2` Hồi còn gánh hàng, bà chỉ ước một lần được thấy con phố đầy đèn.
- `banoi.lantern5.3` Cháu làm được thay bà. Bà nội.

## Mốc ngày

Điều kiện: `day` đạt 7, 30, 100. Một lần mỗi mốc.

**day7**
- `banoi.day7.1` Một tuần rồi, {playerName}! Bà gạch đủ bảy ngày trên tờ lịch.
- `banoi.day7.2` Tuần đầu là tuần khó nhất. Qua được rồi, những tuần sau nhẹ tay hơn.
- `banoi.day7.3` Bà làm mứt gừng để dành, chờ cháu về ăn với trà nóng.
- `banoi.day7.4` Bà nội.

**day30**
- `banoi.day30.1` Ngày thứ {day} rồi. Một tháng! Bà mừng không nói thành lời.
- `banoi.day30.2` Bà nhớ ngày cháu mới đi, hành lý nhỏ, mặt thì lo.
- `banoi.day30.3` Giờ thư nào cháu viết cũng có mùi khói bếp. Bà thích lắm.
- `banoi.day30.4` Bà nội.

**day100**
- `banoi.day100.1` Ngày thứ {day}! Trăm ngày rồi cháu ơi, bà phải ngồi xuống cho khỏi xúc động.
- `banoi.day100.2` Người ta bảo trăm ngày đủ để một thói quen thành một nghề.
- `banoi.day100.3` Bà không biết cháu ở phố đó bao lâu, mà cũng không cần biết.
- `banoi.day100.4` Cứ nấu, cứ mở đèn. Bà luôn thắp một ngọn ở hiên nhà. Bà nội.
