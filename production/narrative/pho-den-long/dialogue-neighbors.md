# Thoại hàng xóm — Phố Đèn Lồng

> canon: draft | người viết: writer | ngôn ngữ: tiếng Việt
> Định dạng: `key` **Người nói:** lời. `[P]` = lời đáp của người chơi (tuỳ chọn hiển thị, luôn trung tính).
> Cổng mở khoá dùng `stars`, `shopLevel`, `lantern`, `day`. `needs:` = chỉ hiện khi NPC đó đang có mặt
> (gian của họ không phải của người chơi). Placeholder: {playerName} {shopName} {money} {day} {stars}.
> Tier 0 = lời chào luôn có. Vignette mở rồi thì mở mãi, đọc thứ tự nào cũng được.

---

## 1. pho — Bác Thìn (60s, Hà Nội)

**Tier 0**
- `npc.pho.greet.1` **Bác Thìn:** Lại đây, {playerName}. Ngồi xuống đã, nước dùng còn sôi đấy.
- `npc.pho.greet.2` **Bác Thìn:** Phố lên đèn rồi, con nhỉ. Giờ này phở thơm nhất.
- `npc.pho.greet.3` **Bác Thìn:** Bác đứng bếp bao năm, vẫn chưa chán cái mùi hành phi.

**Vignette 1** — cổng: `day>=2`
- `npc.pho.vig1.1` **Bác Thìn:** Hồi trước bác gánh phở đi bán rong, tiếng rao cuối ngõ là người ta ra cửa.
- `npc.pho.vig1.2` **[P]** Dạ, sao bác không gánh nữa ạ?
- `npc.pho.vig1.3` **Bác Thìn:** Gánh nặng, vai bác kêu. Giờ có quầy, nhưng cái tên thì bác giữ.
- `npc.pho.vig1.4` **Bác Thìn:** Có những thứ đổi chỗ được, đổi tên thì tiếc, con ạ.

**Vignette 2** — cổng: `stars>=10`
- `npc.pho.vig2.1` **Bác Thìn:** Ninh nước dùng không có đường tắt. Xương phải ninh cả đêm, lửa phải nhỏ.
- `npc.pho.vig2.2` **[P]** Dạ, bác có công thức riêng không ạ?
- `npc.pho.vig2.3` **Bác Thìn:** Có chứ. Là kiên nhẫn. Bác chưa tìm được ai đủ kiên nhẫn để giao.
- `npc.pho.vig2.4` **Bác Thìn:** Con đã có {stars} sao mà vẫn chịu khó đứng bếp. Bác để ý đấy.

---

## 2. buncha — Chị Hằng (40s, Hà Nội)

**Tier 0**
- `npc.buncha.greet.1` **Chị Hằng:** Ôi {playerName} sang chơi đấy à? Khói than nhà chị bay sang tận bên kia phố rồi nhỉ.
- `npc.buncha.greet.2` **Chị Hằng:** Than đỏ rồi, chả sắp chín. Em ngửi thấy chưa?
- `npc.buncha.greet.3` **Chị Hằng:** Chị bán bún chả, mà tối nào cũng cãi nhau với khói.

**Vignette 1** — cổng: `stars>=3`
- `npc.buncha.vig1.1` **Chị Hằng:** Em biết nước chấm ngon nhất là lúc nào không? Lúc có người ngồi chờ.
- `npc.buncha.vig1.2` **[P]** Dạ, vì sao ạ?
- `npc.buncha.vig1.3` **Chị Hằng:** Chờ thì đói, đói thì ăn gì cũng ngon. Chị đùa thôi, nhá.
- `npc.buncha.vig1.4` **Chị Hằng:** Thật ra chị nêm theo hơi than. Nước chấm cũng phải hợp với lửa.

**Vignette 2** — cổng: `stars>=8`; needs: pho (Bác Thìn)
- `npc.buncha.vig2.1` **Chị Hằng:** Bác Thìn bên phở cứ bảo bún chả của chị ồn ào. Phở của bác thì im lặng chắc?
- `npc.buncha.vig2.2` **[P]** Hai quán cạnh nhau hay cãi nhau ạ?
- `npc.buncha.vig2.3` **Chị Hằng:** Cãi thế thôi. Tối nào hết than, bác cũng sang cho mượn ít.
- `npc.buncha.vig2.4` **Chị Hằng:** Mà em đừng kể bác nhá. Bác mà biết chị khen là bác lên mặt đấy.

---

## 3. banhcuon — Cô Nhài (50s, Thanh Trì)

**Tier 0**
- `npc.banhcuon.greet.1` **Cô Nhài:** Con đến rồi à? Bánh vừa tráng, còn nóng hổi nhé.
- `npc.banhcuon.greet.2` **Cô Nhài:** Tráng bánh phải nhẹ tay. Mỏng quá thì rách, dày quá thì mất duyên.
- `npc.banhcuon.greet.3` **Cô Nhài:** Hơi nước bốc lên ấm cả tay. Cô mê cái ấy từ nhỏ.

**Vignette 1** — cổng: `day>=3`
- `npc.banhcuon.vig1.1` **Cô Nhài:** Con có ngửi thấy mùi cà cuống không? Chỉ một giọt thôi mà thơm cả bát.
- `npc.banhcuon.vig1.2` **[P]** Dạ, thơm lạ lắm ạ.
- `npc.banhcuon.vig1.3` **Cô Nhài:** Hồi nhỏ mẹ cho cô chấm có một giọt, quý lắm. Giờ mới hiểu vì sao.
- `npc.banhcuon.vig1.4` **Cô Nhài:** Món ngon cũng vậy, ít mà nhớ lâu.

**Vignette 2** — cổng: `shopLevel>=2`
- `npc.banhcuon.vig2.1` **Cô Nhài:** {shopName} của con khá lên rồi. Cô thấy vui như thấy cây mình tưới.
- `npc.banhcuon.vig2.2` **[P]** Dạ, nhờ mọi người chỉ bảo ạ.
- `npc.banhcuon.vig2.3` **Cô Nhài:** Cô cũng ước có thêm cái bàn nhỏ cho khách ngồi lâu, ăn từ từ.
- `npc.banhcuon.vig2.4` **Cô Nhài:** Thôi, bánh còn nóng, nói mãi lại nguội. Con ăn đi, {playerName}.

---

## 4. com — Chú Quý (50s, làng Vòng)

**Tier 0**
- `npc.com.greet.1` **Chú Quý:** Chào {playerName}. Cốm mới về, gói lá sen còn thơm lắm.
- `npc.com.greet.2` **Chú Quý:** Mùa thu thì cốm xanh nhất. Mùa nào cũng có cái hay của mùa ấy.
- `npc.com.greet.3` **Chú Quý:** Ăn cốm phải ăn chậm, nhai kỹ, thế mới nghe được mùi lúa non.

**Vignette 1** — cổng: `stars>=5`
- `npc.com.vig1.1` **Chú Quý:** Cốm làm từ lúa nếp non, rang rồi giã, công phu lắm con ạ.
- `npc.com.vig1.2` **[P]** Dạ, làm cốm có vất vả không chú?
- `npc.com.vig1.3` **Chú Quý:** Thức khuya, giã nhẹ tay, nghe tiếng chày là biết cốm dẻo hay chưa.
- `npc.com.vig1.4` **Chú Quý:** Bán cốm cũng thế, đừng vội. Khách nán lại vì mình không vội.

**Vignette 2** — cổng: `day>=10`
- `npc.com.vig2.1` **Chú Quý:** Ngày thứ {day} rồi nhỉ. Chú đoán con sắp quen nhịp phố này.
- `npc.com.vig2.2` **[P]** Dạ, con vẫn còn bỡ ngỡ ạ.
- `npc.com.vig2.3` **Chú Quý:** Bỡ ngỡ là tốt. Người hết bỡ ngỡ thì hay quên ngẩng lên nhìn trời.
- `npc.com.vig2.4` **Chú Quý:** Chú đang muốn gói cốm tặng cả phố một buổi tối. Mỗi người một gói nhỏ.

---

## 5. caphe — Anh Phong (30s, Hà Nội)

**Tier 0**
- `npc.caphe.greet.1` **Anh Phong:** Ê, {playerName}! Lên gác mái đi, nhìn phố lên đèn thích lắm.
- `npc.caphe.greet.2` **Anh Phong:** Cà phê trứng á? Nghe lạ, uống vào là nghiện.
- `npc.caphe.greet.3` **Anh Phong:** Anh bỏ bàn giấy lên gác mái này, mà giờ còn dậy sớm hơn hồi đi làm.

**Vignette 1** — cổng: `lantern>=1`
- `npc.caphe.vig1.1` **Anh Phong:** Dây đèn lồng của em sáng lên, từ gác mái anh nhìn thấy rõ.
- `npc.caphe.vig1.2` **[P]** Dạ, trông có đẹp không ạ?
- `npc.caphe.vig1.3` **Anh Phong:** Đẹp. Cả phố như một sợi dây hạt, mỗi quán là một hạt.
- `npc.caphe.vig1.4` **Anh Phong:** Anh định chụp mà lại thôi. Có những thứ nhìn bằng mắt mới ấm.

**Vignette 2** — cổng: `stars>=15`
- `npc.caphe.vig2.1` **Anh Phong:** Hồi đi làm anh tưởng mình cần nhiều tiền. Giờ chỉ cần một cái ghế chắc.
- `npc.caphe.vig2.2` **[P]** Anh có tiếc công việc cũ không ạ?
- `npc.caphe.vig2.3` **Anh Phong:** Tiếc đúng một thứ: ghế văn phòng êm hơn ghế gác mái.
- `npc.caphe.vig2.4` **Anh Phong:** Nhưng ghế gác mái nhìn ra {shopName} của em. Ghế kia chỉ nhìn ra tường.

---

## 6. bunbo — O Huyền (40s, Huế)

**Tier 0**
- `npc.bunbo.greet.1` **O Huyền:** Mời con vô. Nước lèo nhà o đỏ au, thơm sả lắm nghe.
- `npc.bunbo.greet.2` **O Huyền:** Cay hay không cay, con nói trước nghe. Ớt nhà o khó tính lắm.
- `npc.bunbo.greet.3` **O Huyền:** Mắm ruốc hơi nồng, nhưng quen rồi là nhớ, {playerName} à.

**Vignette 1** — cổng: `day>=4`
- `npc.bunbo.vig1.1` **O Huyền:** Có khách hỏi răng bún bò Huế mà không thấy Huế. O nói: thì ở đây nè.
- `npc.bunbo.vig1.2` **[P]** Dạ, vậy là Huế mang vô phố ạ?
- `npc.bunbo.vig1.3` **O Huyền:** Rứa đó. Mang mùi sả, màu ớt, còn tiếng nói thì o giữ nguyên.
- `npc.bunbo.vig1.4` **O Huyền:** Quê mình đi đâu cũng theo mình, con ơi. Miễn đừng làm rơi.

**Vignette 2** — cổng: `stars>=8`; needs: miquang (Bà Tư)
- `npc.bunbo.vig2.1` **O Huyền:** Bà Tư bên mì Quảng cứ đòi hơn o chuyện ớt. Hai bên cãi hoài.
- `npc.bunbo.vig2.2` **[P]** Dạ, ớt Quảng với ớt Huế khác nhau ạ?
- `npc.bunbo.vig2.3` **O Huyền:** Khác chớ. Nhưng tới tối là bà Tư đem sang cho o một tô mì, o đem qua một tô bún.
- `npc.bunbo.vig2.4` **O Huyền:** Cãi cho vui miệng, đổi tô cho vui bụng. Con thấy có dễ thương không?

---

## 7. miquang — Bà Tư (70s, Quảng Nam)

**Tier 0**
- `npc.miquang.greet.1` **Bà Tư:** Ơi, {playerName}! Lại đây bà coi. Mặt mũi sáng sủa rứa là làm ăn được rồi.
- `npc.miquang.greet.2` **Bà Tư:** Mì Quảng ít nước thôi, đừng bắt bà nấu như phở, bà giận đó.
- `npc.miquang.greet.3` **Bà Tư:** Bánh tráng mè bà nướng vừa giòn. Bẻ thử một miếng, khỏi trả tiền.

**Vignette 1** — cổng: `stars>=2`
- `npc.miquang.vig1.1` **Bà Tư:** Mới có {stars} sao mà con dám đứng quầy giữa phố, giỏi hỉ.
- `npc.miquang.vig1.2` **[P]** Dạ, con còn nhiều thứ chưa biết ạ.
- `npc.miquang.vig1.3` **Bà Tư:** Biết hết thì ở nhà ngồi. Ra đây làm hoài rồi biết.
- `npc.miquang.vig1.4` **Bà Tư:** Nghề mình mà, lỗi thì sửa, nồi cháy thì cọ. Có chi mà sợ.

**Vignette 2** — cổng: `day>=20`
- `npc.miquang.vig2.1` **Bà Tư:** Nghệ ở phố này không thắm bằng nghệ nhà bà ở quê. Bà tiếc hoài.
- `npc.miquang.vig2.2` **[P]** Dạ, quê bà ở đâu ạ?
- `npc.miquang.vig2.3` **Bà Tư:** Một cái làng nhỏ, đi xe cả buổi. Giờ đi lại vất, bà nhờ người mang nghệ ra.
- `npc.miquang.vig2.4` **Bà Tư:** Qua {day} ngày ở phố, bà chỉ tin một điều: nghệ thắm thì mì mới có hồn.

---

## 8. caolau — Ông Hòa (60s, Hội An)

**Tier 0**
- `npc.caolau.greet.1` **Ông Hòa:** Chào {playerName}. Sợi cao lầu dai mà không cứng, ăn một lần là nhớ.
- `npc.caolau.greet.2` **Ông Hòa:** Người xưa bảo nước giếng cổ mới ra sợi ngon. Ông cứ tin vậy.
- `npc.caolau.greet.3` **Ông Hòa:** Phố Hội ngày xưa đèn sáng ven sông. Ở đây, đèn sáng ven đường.

**Vignette 1** — cổng: `lantern>=1`
- `npc.caolau.vig1.1` **Ông Hòa:** Dây đèn nhà con sáng rồi. Ông nhìn mà nhớ đêm rằm bên sông.
- `npc.caolau.vig1.2` **[P]** Dạ, đêm rằm ở quê ông thế nào ạ?
- `npc.caolau.vig1.3` **Ông Hòa:** Tắt đèn điện, thả hoa đăng, cả phố im phăng phắc, chỉ nghe nước chảy.
- `npc.caolau.vig1.4` **Ông Hòa:** Ở phố này ồn hơn. Nhưng ánh đèn thì giống. Vậy là đủ rồi.

**Vignette 2** — cổng: `lantern>=3`; needs: nonla (Cô Quyên)
- `npc.caolau.vig2.1` **Ông Hòa:** Đèn lụa treo trước quán ông đều do Cô Quyên bên nón lá làm cả.
- `npc.caolau.vig2.2` **[P]** Dạ, lụa của cô đẹp quá ạ.
- `npc.caolau.vig2.3` **Ông Hòa:** Lụa thì ai cũng dệt được. Làm cho đèn có hơi ấm mới là cái tài.
- `npc.caolau.vig2.4` **Ông Hòa:** Ông trả công bằng tô cao lầu. Cô ấy chê ít, ông lại thêm một tô.

---

## 9. beonamloc — Cô Thương (30s, Huế)

**Tier 0**
- `npc.beonamloc.greet.1` **Cô Thương:** Dạ, chào {playerName}. Bánh bèo mới hấp, còn nóng hổi.
- `npc.beonamloc.greet.2` **Cô Thương:** Tôm chấy rắc nhẹ thôi, nhiều quá mất vị. Mà... mình nói rứa có đúng không ta?
- `npc.beonamloc.greet.3` **Cô Thương:** Mỗi cái chén nhỏ là một cái bánh. Nhỏ mà tốn công lắm, dạ.

**Vignette 1** — cổng: `day>=5`
- `npc.beonamloc.vig1.1` **Cô Thương:** Dạ... {playerName} có thấy mình nói nhỏ quá không? Nhiều người nghe không rõ.
- `npc.beonamloc.vig1.2` **[P]** Dạ không, nghe rõ mà ạ.
- `npc.beonamloc.vig1.3` **Cô Thương:** Hồi nhỏ mạ dặn làm bánh phải nhẹ tay, nói cũng nhẹ luôn. Thành tật.
- `npc.beonamloc.vig1.4` **Cô Thương:** Nhưng bánh thì không cần nói. Bánh ngon là bánh tự lên tiếng.

**Vignette 2** — cổng: `stars>=12`; needs: chehue (Mệ Diệu)
- `npc.beonamloc.vig2.1` **Cô Thương:** Mệ Diệu bên chè sang ăn thử bánh bèo của mình. Mình run quá, đứng im luôn.
- `npc.beonamloc.vig2.2` **[P]** Dạ, mệ nói sao ạ?
- `npc.beonamloc.vig2.3` **Cô Thương:** Mệ chỉ nói: nước mắm pha được rồi. Mình vui cả tuần luôn.
- `npc.beonamloc.vig2.4` **Cô Thương:** Mệ nói ít mà chắc. Mình ước một ngày được lời khen thứ hai.

---

## 10. chehue — Mệ Diệu (70s, Huế)

**Tier 0**
- `npc.chehue.greet.1` **Mệ Diệu:** Con vô ngồi đi. Chè cung đình ăn chậm, đừng vội.
- `npc.chehue.greet.2` **Mệ Diệu:** Mệ nấu chè bằng sự nhẫn nại, đường chỉ là phụ.
- `npc.chehue.greet.3` **Mệ Diệu:** Hạt sen phải bỏ tim, không thì đắng. Việc nhỏ, mà phân ra người làm với người nấu.

**Vignette 1** — cổng: `stars>=5`
- `npc.chehue.vig1.1` **Mệ Diệu:** Mệ nghe nói con đã có {stars} sao. Chưa nhiều, nhưng mệ để ý.
- `npc.chehue.vig1.2` **[P]** Dạ, con cảm ơn mệ.
- `npc.chehue.vig1.3` **Mệ Diệu:** Đừng cảm ơn. Sao nhiều rồi mà quên bỏ tim hạt sen thì mệ chê liền.
- `npc.chehue.vig1.4` **Mệ Diệu:** Chuyện lớn do người ta khen. Chuyện nhỏ do mình tự giữ.

**Vignette 2** — cổng: `day>=40`
- `npc.chehue.vig2.1` **Mệ Diệu:** Ngày thứ {day} rồi, con còn nhớ lúc đầu đứng quầy không?
- `npc.chehue.vig2.2` **[P]** Dạ nhớ. Lúc đó run lắm ạ.
- `npc.chehue.vig2.3` **Mệ Diệu:** Mệ cũng run, lần đầu bưng chè cho khách lạ. Run là biết quý nghề.
- `npc.chehue.vig2.4` **Mệ Diệu:** Bây giờ mệ chỉ còn run khi hết đường phèn. Cười đi con, mệ nói thật.

---

## 11. comtam — Anh Hậu (40s, Sài Gòn)

**Tier 0**
- `npc.comtam.greet.1` **Anh Hậu:** Ê, {playerName}! Tới ăn dĩa cơm tấm hông? Sườn mới nướng, thơm dữ nghen.
- `npc.comtam.greet.2` **Anh Hậu:** Mỡ hành phải phi cho vừa, cháy một cái là đắng liền.
- `npc.comtam.greet.3` **Anh Hậu:** Sài Gòn sống bằng cơm tấm với cà phê. Anh nói thiệt đó.

**Vignette 1** — cổng: `day>=3`
- `npc.comtam.vig1.1` **Anh Hậu:** Ướp sườn bằng mật ong, em biết sao anh dùng hông? Cho nó bóng, với cho nó hiền.
- `npc.comtam.vig1.2` **[P]** Dạ, hiền là sao ạ?
- `npc.comtam.vig1.3` **Anh Hậu:** Ngọt dịu, khỏi gắt. Ăn xong phải thấy dễ chịu mới là cơm tấm.
- `npc.comtam.vig1.4` **Anh Hậu:** Món ăn cũng như người, hiền hiền mà thương nghen.

**Vignette 2** — cổng: `shopLevel>=2`
- `npc.comtam.vig2.1` **Anh Hậu:** {shopName} của em khá hơn rồi hén. Hồi đầu anh nhìn, tưởng lâu lắm.
- `npc.comtam.vig2.2` **[P]** Dạ, nhờ anh chỉ cho nhiều ạ.
- `npc.comtam.vig2.3` **Anh Hậu:** Anh có chỉ gì đâu, toàn ăn thử giùm em thôi.
- `npc.comtam.vig2.4` **Anh Hậu:** Mà ăn thử cũng là một công việc đó nghen. Mệt lắm.

---

## 12. hutieu — Bác Chín (60s, miền Tây)

**Tier 0**
- `npc.hutieu.greet.1` **Bác Chín:** Lóc cóc, lóc cóc. Nghe tiếng gõ là biết bác tới rồi, {playerName} ơi.
- `npc.hutieu.greet.2` **Bác Chín:** Hủ tiếu bán trên ghe, đứng đâu cũng là bến, hen.
- `npc.hutieu.greet.3` **Bác Chín:** Nước lèo ngọt từ xương với khô mực. Bác nấu hoài chưa thấy chán.

**Vignette 1** — cổng: `stars>=4`
- `npc.hutieu.vig1.1` **Bác Chín:** Hồi trước bác bán dưới sông, khách tới bằng xuồng, bác thả sợi hủ tiếu xuống tô.
- `npc.hutieu.vig1.2` **[P]** Dạ, bán trên sông có bất tiện không bác?
- `npc.hutieu.vig1.3` **Bác Chín:** Bất tiện hết. Nhưng sáng ra gió mát, bán xong là mát lòng.
- `npc.hutieu.vig1.4` **Bác Chín:** Giờ lên bờ rồi, bác vẫn gõ lóc cóc cho đỡ nhớ sông.

**Vignette 2** — cổng: `lantern>=2`
- `npc.hutieu.vig2.1` **Bác Chín:** Đèn lồng dọc phố này làm bác nhớ đèn ghe đêm trên sông.
- `npc.hutieu.vig2.2` **[P]** Dạ, đêm trên sông thế nào ạ?
- `npc.hutieu.vig2.3` **Bác Chín:** Tối thui, chỉ có ánh đèn ghe này tới ghe kia. Ai cũng biết ghe nào còn bán.
- `npc.hutieu.vig2.4` **Bác Chín:** Cái đèn là lời nhắn: tui còn đây, ghé ăn đi. Giản dị vậy thôi.

---

## 13. banhxeo — Dì Hai (50s, Cần Thơ)

**Tier 0**
- `npc.banhxeo.greet.1` **Dì Hai:** Vô đây, {playerName}! Bánh xèo dì to bằng cái chảo thiệt, ăn một mình hổng hết đâu.
- `npc.banhxeo.greet.2` **Dì Hai:** Nghe tiếng xèo xèo hông? Đó là bột gặp chảo nóng đó.
- `npc.banhxeo.greet.3` **Dì Hai:** Ăn bánh xèo phải cuốn rau, chấm nước mắm. Không là phí nghen.

**Vignette 1** — cổng: `day>=6`
- `npc.banhxeo.vig1.1` **Dì Hai:** Hồi nhỏ dì tưởng cái bánh xèo lớn nhất đời là cái nón của ba dì.
- `npc.banhxeo.vig1.2` **[P]** Dạ, vậy bánh dì giờ lớn thật nhỉ.
- `npc.banhxeo.vig1.3` **Dì Hai:** Lớn chớ! Nhưng dì chưa làm được cái nào bằng nón ba. Chắc phải tập thêm.
- `npc.banhxeo.vig1.4` **Dì Hai:** Mà thôi, khách ăn hết là dì mừng, nón hay bánh gì cũng được nghen.

**Vignette 2** — cổng: `shopLevel>=4`
- `npc.banhxeo.vig2.1` **Dì Hai:** {shopName} của con lên tới đây rồi, dì thấy tự hào như dì nuôi.
- `npc.banhxeo.vig2.2` **[P]** Dạ, nhờ có dì cho ăn nhiều đó ạ.
- `npc.banhxeo.vig2.3` **Dì Hai:** Haha, ăn nhiều mới lớn. Dì hứa, tối nào rảnh dì làm cái bánh to bằng cái mâm.
- `npc.banhxeo.vig2.4` **Dì Hai:** Hứa là hứa. Tới ăn đi, đừng ngại, ăn không hết dì gói về.

---

## 14. laumam — Chị Bảy (40s, U Minh)

**Tier 0**
- `npc.laumam.greet.1` **Chị Bảy:** Chào {playerName}. Lẩu mắm nấu lâu mới ngon, ngồi chờ xíu nghen.
- `npc.laumam.greet.2` **Chị Bảy:** Rổ rau đồng chị hái sáng nay, đủ thứ hết. Em cứ lựa.
- `npc.laumam.greet.3` **Chị Bảy:** Mắm thì nặng mùi, mà quen rồi là nhớ. Ai chê chị cũng không giận.

**Vignette 1** — cổng: `stars>=6`
- `npc.laumam.vig1.1` **Chị Bảy:** Hồi đầu có khách bịt mũi nghe mùi mắm. Chị buồn lắm.
- `npc.laumam.vig1.2` **[P]** Dạ, rồi sao ạ?
- `npc.laumam.vig1.3` **Chị Bảy:** Chị đem một chén nước lẩu cho thử. Ảnh ăn xong xin thêm chén nữa.
- `npc.laumam.vig1.4` **Chị Bảy:** Mùi chỉ là cái cửa. Vô trong rồi mới thấy nhà.

**Vignette 2** — cổng: `lantern>=4`
- `npc.laumam.vig2.1` **Chị Bảy:** Đèn phố sáng dữ. Chị nhớ đêm ở U Minh, đom đóm đầy cây.
- `npc.laumam.vig2.2` **[P]** Dạ, đom đóm đẹp lắm ạ?
- `npc.laumam.vig2.3` **Chị Bảy:** Đẹp. Mà đèn lồng ở đây còn đẹp hơn, vì có người ngồi ăn bên dưới.
- `npc.laumam.vig2.4` **Chị Bảy:** Cảnh đẹp cỡ nào mà ăn một mình cũng buồn, em à. Phải có bạn.

---

## 15. traicay — Anh Thuận (20s, Bến Tre)

**Tier 0**
- `npc.traicay.greet.1` **Anh Thuận:** Dạ chào {playerName}! Sinh tố hôm nay có xoài, mãng cầu, bơ. Chọn đi!
- `npc.traicay.greet.2` **Anh Thuận:** Nước mía vắt tươi liền. Nghe tiếng ép mía hông? Sướng tai ghê.
- `npc.traicay.greet.3` **Anh Thuận:** Trái cây miệt vườn, mua một chùm ăn cho mát bụng nghen.

**Vignette 1** — cổng: `day>=2`
- `npc.traicay.vig1.1` **Anh Thuận:** Đố em, trái nào trên quầy anh ngọt nhất?
- `npc.traicay.vig1.2` **[P]** Dạ, chắc là xoài ạ?
- `npc.traicay.vig1.3` **Anh Thuận:** Sai! Là trái anh ăn thử trước khi bán. Không thử sao biết ngọt?
- `npc.traicay.vig1.4` **Anh Thuận:** Nghề bán trái cây là nghề ăn thử, em ơi. Sướng ghê hông?

**Vignette 2** — cổng: `shopLevel>=3`
- `npc.traicay.vig2.1` **Anh Thuận:** Anh đang để dành tiền mua miếng đất, trồng thử vài cây.
- `npc.traicay.vig2.2` **[P]** Dạ, anh định trồng cây gì ạ?
- `npc.traicay.vig2.3` **Anh Thuận:** Cây gì chưa biết, miễn có chỗ cho má anh ngồi dưới gốc cây.
- `npc.traicay.vig2.4` **Anh Thuận:** Thấy {shopName} của em khá lên, anh cũng muốn cố. Hai đứa mình cùng cố hen.

---

## 16. aodai — Chị Duyên (40s, Nam Định)

**Tier 0**
- `npc.aodai.greet.1` **Chị Duyên:** Chào {playerName}. Ghé xem áo dài nhé, mặc thử không mất gì cả.
- `npc.aodai.greet.2` **Chị Duyên:** Áo dài đẹp nhất khi vừa vặn. May đo là để hiểu người mặc.
- `npc.aodai.greet.3` **Chị Duyên:** Khách thuê áo chụp ảnh nhiều lắm. Chị thích thấy họ cười lúc soi gương.

**Vignette 1** — cổng: `stars>=3`
- `npc.aodai.vig1.1` **Chị Duyên:** Có cô khách mấy năm trước thuê áo cưới ở đây, giờ quay lại may áo cho con gái.
- `npc.aodai.vig1.2` **[P]** Dạ, nghe cảm động quá ạ.
- `npc.aodai.vig1.3` **Chị Duyên:** Áo dài là thế, đi qua đời người này rồi sang đời người sau.
- `npc.aodai.vig1.4` **Chị Duyên:** Nên chị không bao giờ may ẩu. Biết đâu áo lại thành kỷ niệm.

**Vignette 2** — cổng: `lantern>=3`; needs: nonla (Cô Quyên)
- `npc.aodai.vig2.1` **Chị Duyên:** Cô Quyên bên nón lá cho chị mượn nón để khách chụp ảnh. Đẹp lắm.
- `npc.aodai.vig2.2` **[P]** Dạ, áo dài với nón lá hợp ạ.
- `npc.aodai.vig2.3` **Chị Duyên:** Hợp. Chị đền cô ấy một chiếc khăn lụa, cô ấy cười mãi.
- `npc.aodai.vig2.4` **Chị Duyên:** Nhờ đèn lồng sáng, ảnh lên đẹp hơn nhiều. Ơn đèn, ơn nón, ơn cả phố.

---

## 17. nonla — Cô Quyên (50s, Thừa Thiên Huế)

**Tier 0**
- `npc.nonla.greet.1` **Cô Quyên:** Chào {playerName}. Nón lá vẽ tay, đèn lồng lụa, cái nào cũng nhẹ như gió.
- `npc.nonla.greet.2` **Cô Quyên:** Nón bài thơ cầm lên soi nắng thì thấy hình hiện ra. Lạ không?
- `npc.nonla.greet.3` **Cô Quyên:** Cô khâu từng vòng lá. Tay có chai, nhưng nhìn nón đẹp là hết đau.

**Vignette 1** — cổng: `lantern>=1`
- `npc.nonla.vig1.1` **Cô Quyên:** Con vừa treo thêm dây đèn à? Cô thấy phố sáng hẳn lên.
- `npc.nonla.vig1.2` **[P]** Dạ, con thấy treo xong vui lắm ạ.
- `npc.nonla.vig1.3` **Cô Quyên:** Đèn lụa cũng vậy. Căng khung xong, thắp lên mới thấy cái đẹp.
- `npc.nonla.vig1.4` **Cô Quyên:** Đèn dây trên phố là của chung. Đèn trong nhà là của riêng. Cả hai đều quý nghe.

**Vignette 2** — cổng: `day>=15`
- `npc.nonla.vig2.1` **Cô Quyên:** Cô muốn mở lớp vẽ nón cho mấy đứa nhỏ trong phố, vào cuối tuần.
- `npc.nonla.vig2.2` **[P]** Dạ, hay quá ạ.
- `npc.nonla.vig2.3` **Cô Quyên:** Hay mà chưa có người đỡ. Một mình cô vừa bán vừa dạy thì rối.
- `npc.nonla.vig2.4` **Cô Quyên:** Ngày thứ {day} rồi, tối nào cô cũng nghĩ chuyện ấy. Chắc rồi sẽ làm được.

---

## 18. gom — Anh Kiên (30s, Bát Tràng)

**Tier 0**
- `npc.gom.greet.1` **Anh Kiên:** Ừ, chào {playerName}. Cứ ngồi vào bàn xoay mà nặn, hỏng cũng không sao.
- `npc.gom.greet.2` **Anh Kiên:** Đất sét có trí nhớ. Nắn thế nào nó nhớ thế ấy.
- `npc.gom.greet.3` **Anh Kiên:** Gốm nung xong mới biết thành hay bại. Nên anh quen chờ.

**Vignette 1** — cổng: `shopLevel>=2`
- `npc.gom.vig1.1` **Anh Kiên:** {shopName} khá lên rồi à? Gốm cũng vậy, nung thêm một lửa là chắc hơn.
- `npc.gom.vig1.2` **[P]** Dạ, anh nói nghe hợp lý ạ.
- `npc.gom.vig1.3` **Anh Kiên:** Hợp lý thì chưa chắc. Lửa to quá là nứt. Từ từ thôi.
- `npc.gom.vig1.4` **Anh Kiên:** Làm quán lớn lên cũng là một lần nung. Đừng nóng vội.

**Vignette 2** — cổng: `stars>=12`; needs: tranh (Cụ Thuần)
- `npc.gom.vig2.1` **Anh Kiên:** Cụ Thuần bên thư pháp viết chữ lên cái bình của anh. Bình đẹp hẳn.
- `npc.gom.vig2.2` **[P]** Dạ, chữ gì thế ạ?
- `npc.gom.vig2.3` **Anh Kiên:** Chữ Nhẫn. Anh xin cụ viết nhẹ tay, cụ cười: chữ nhẫn mà không nhẫn thì viết làm gì.
- `npc.gom.vig2.4` **Anh Kiên:** Anh nhìn cái bình mỗi sáng. Nó nhắc anh đừng cáu khi nặn hỏng.

---

## 19. tranh — Cụ Thuần (70s, Kinh Bắc)

**Tier 0**
- `npc.tranh.greet.1` **Cụ Thuần:** Cháu {playerName} đến đấy à? Ngồi xuống, ông viết cho một chữ.
- `npc.tranh.greet.2` **Cụ Thuần:** Mực phải mài từ từ. Mài mực cũng là mài lòng.
- `npc.tranh.greet.3` **Cụ Thuần:** Tranh Đông Hồ màu lấy từ lá, từ vỏ sò. Không màu nào tự dưng mà có.

**Vignette 1** — cổng: `day>=8`
- `npc.tranh.vig1.1` **Cụ Thuần:** Ông viết chữ An tặng nhiều người, mà ít ai hỏi vì sao.
- `npc.tranh.vig1.2` **[P]** Dạ, vì sao ạ?
- `npc.tranh.vig1.3` **Cụ Thuần:** Vì An không phải là không có việc. An là có việc mà lòng vẫn yên.
- `npc.tranh.vig1.4` **Cụ Thuần:** Cháu bán hàng giữa phố ồn mà giữ được lòng yên, ấy là có chữ An rồi.

**Vignette 2** — cổng: `stars>=30`
- `npc.tranh.vig2.1` **Cụ Thuần:** Cháu đã có {stars} sao. Ông thấy tên cháu bắt đầu được người ta nhắc.
- `npc.tranh.vig2.2` **[P]** Dạ, con vẫn thấy mình còn non ạ.
- `npc.tranh.vig2.3` **Cụ Thuần:** Non thì mới lớn được. Cây già chỉ còn cho bóng.
- `npc.tranh.vig2.4` **Cụ Thuần:** Ông tặng cháu nét bút đầu của buổi tối nay. Cháu cứ nhận, đừng ngại.

---

## 20. roinuoc — Chú Lộc (50s, Thái Bình)

**Tier 0**
- `npc.roinuoc.greet.1` **Chú Lộc:** Kính chào quý khách {playerName}! Chú Tễu xin ra mắt, rồng sắp phun nước!
- `npc.roinuoc.greet.2` **Chú Lộc:** Rối nước, cháu ạ, người đứng sau mành lội nước cả buổi. Chú quen rồi.
- `npc.roinuoc.greet.3` **Chú Lộc:** Tiếng đờn ca tài tử ngân lên là hết mệt. Cháu ngồi nghe một khúc nhé.

**Vignette 1** — cổng: `stars>=10`
- `npc.roinuoc.vig1.1` **Chú Lộc:** Chú Tễu mở màn là phải cười. Cười không được thì Tễu mất nghề.
- `npc.roinuoc.vig1.2` **[P]** Dạ, chú Tễu hay pha trò nhỉ.
- `npc.roinuoc.vig1.3` **Chú Lộc:** Pha trò dễ thôi. Khó là giữ cái nghiêm trang sau tấm mành.
- `npc.roinuoc.vig1.4` **Chú Lộc:** Cháu bán hàng cũng vậy, cười ngoài, tính trong. Chú nói đùa đấy!

**Vignette 2** — cổng: `lantern>=5`
- `npc.roinuoc.vig2.1` **Chú Lộc:** Năm dây đèn rồi à? Cả phố sáng như hội làng!
- `npc.roinuoc.vig2.2` **[P]** Dạ, đẹp thật ạ.
- `npc.roinuoc.vig2.3` **Chú Lộc:** Hội làng quê chú cũng vậy. Ao đình đầy đèn, rồng phun nước, con nít chạy loạn.
- `npc.roinuoc.vig2.4` **Chú Lộc:** Tối nay chú cho rồng phun thêm một lần. Tặng cháu và cả phố.

---

## Mẹo (8 mẹo cũ viết lại, mỗi mẹo một người nói)

Điều kiện: luôn có (thay cho "Chủ quán" ngẫu nhiên). Mẹo chỉ nói hướng, không nêu số cơ chế.
- `npc.pho.tip.1` **Bác Thìn:** Hàng tươi để qua đêm là hư mất một nửa. Mua vừa đủ thôi con, đừng tham. (hao hụt)
- `npc.aodai.tip.1` **Chị Duyên:** Khách phương xa mê đồ lưu niệm lắm. Có món nhỏ xinh cho họ mang về là họ vui liền. (lưu niệm)
- `npc.caolau.tip.1` **Ông Hòa:** Dây đèn lồng càng sáng, người qua phố càng đông. Đèn tối thì phố cũng buồn, con ạ. (đèn lồng)
- `npc.chehue.tip.1` **Mệ Diệu:** Dân sành ăn nếm một muỗng là biết liền. Món cẩu thả thì đừng bưng ra, con. (dân sành ăn)
- `npc.hutieu.tip.1` **Bác Chín:** Gánh nặng quá thì đi chậm lắm con. Đơn nhiều cứ gọi xe ba gác chở về, đỡ cái vai. (gánh / xe ba gác)
- `npc.gom.tip.1` **Anh Kiên:** Sửa quán như nung lại lò gốm em ạ: xong rồi món bán được giá hơn, vai gánh cũng khỏe hơn. (nâng cấp)
- `npc.caphe.tip.1` **Anh Phong:** Có người đi nếm rồi viết lại về quán, không báo trước đâu. Món nào cũng làm như có người xem. (reviewer)
- `npc.miquang.tip.1` **Bà Tư:** Giá chợ mỗi ngày một khác. Đi một vòng hỏi giá rồi hãy mua, đừng chạy thẳng, con. (giá chợ)

---

## Self-check

> Đây là bản tự kiểm tra của người viết (writer), KHÔNG phải kết luận ND-CONSISTENCY của narrative-director.

- **Vi phạm độ dài dòng (>120 ký tự, phần lời):** 0 vi phạm (kiểm bằng regex `.{121,}` trên phần lời sau thẻ người nói, cả
  tệp này lẫn `dialogue-ba-noi.md`). Chú thích trong ngoặc ở mục Mẹo là ghi chú nội bộ, không phải chuỗi hiển thị.
- **Placeholder dùng:** {playerName}, {shopName}, {money}, {day}, {stars}. Trong tệp này dùng {playerName},
  {shopName}, {day}, {stars}; {money} dành cho thư bà nội. Không nối chuỗi; tên NPC khác trong lời thoại là danh từ
  riêng cố định (6 vignette `needs:`).
- **Văn hoá / vùng miền:** xưng hô theo tuổi người nói (con/cháu cho người lớn tuổi, em/bạn/mình cho người cùng
  hay trẻ hơn); từ vùng miền tối đa một dấu hiệu / dòng, không phiên âm hài. "Nước giếng cổ" của cao lầu viết như
  truyền thuyết ("người xưa bảo"). Nón bài thơ, chữ An, chữ Nhẫn, chú Tễu, đờn ca tài tử dùng đúng nghĩa. Nên nhờ
  người bản ngữ từng vùng đọc lại: Huế (mệ, o, mạ, chừ, răng, rứa), Quảng (chi, hỉ), Nam bộ (nghen, hen, hông, hổng).
- **Mâu thuẫn với canon:** không phát hiện. Hai điểm cần ND xác nhận: (1) canon cũ để hàng xóm gọi người chơi là "con";
  ở đây NPC trẻ hoặc cùng tuổi gọi "em/bạn/mình" (vẫn trung tính); (2) mẹo xe đẩy và nâng cấp được viết mơ hồ, vì cơ
  chế chưa được người viết xác nhận với game-designer.
- **Gian bị người chơi sở hữu:** 6 vignette `needs:` ẩn khi NPC vắng (buncha v2, bunbo v2, caolau v2, beonamloc v2,
  aodai v2, gom v2). Không NPC nào là điều kiện mở nội dung của NPC khác.
