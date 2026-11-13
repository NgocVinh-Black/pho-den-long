// spatial_proj_plate — chiếu tranh nền vẽ sẵn (render từ Blender bằng đúng camera này) lên khối che.
// Mọi khối đều hiện đúng điểm ảnh của tranh tại vị trí trên màn hình, nên trông y hệt tranh;
// vai trò của khối chỉ là ghi độ sâu để nhân vật 3D đi ra sau nhà thì bị che đúng chỗ.
// Tác giả: dựng cùng Claude. Pipeline: Forward+, một lần đọc texture.
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;

/** Tranh nền (ngày hoặc đêm), cùng tỉ lệ khung với cửa sổ game */
uniform sampler2D plate : source_color, filter_linear;

void fragment() {
	ALBEDO = texture(plate, SCREEN_UV).rgb;
}
