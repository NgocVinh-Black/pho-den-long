// spatial_env_street — mặt đất khu phố Phố Đèn Lồng (đường nhựa, vỉa hè, hẻm, sân gạch, cỏ).
// Tác giả: dựng cùng Claude cho bản thử Godot. Pipeline: Forward+ (desktop), không đọc texture.
// Hoa văn tính theo toạ độ thế giới nên các khối nối nhau không lộ đường ghép.
// Không rẽ nhánh: tính cả năm kiểu rồi chọn bằng trọng số theo `surface_kind`.
shader_type spatial;
render_mode diffuse_toon, specular_toon;

group_uniforms surface;
/** 0 đường nhựa, 1 vỉa hè, 2 xi măng hẻm, 3 sân gạch, 4 đất cỏ */
uniform int surface_kind : hint_range(0, 4) = 0;
group_uniforms;

group_uniforms road;
uniform vec3 asphalt_color : source_color = vec3(0.40, 0.41, 0.46);
uniform vec3 paint_color : source_color = vec3(0.95, 0.92, 0.80);
/** Chu kỳ vạch đứt giữa đường (m) */
uniform float dash_period = 3.0;
/** Khoảng cách từ tim đường tới vạch mép (m) */
uniform float edge_line_z = 3.15;
/** Toạ độ z của tim đường (đường chạy theo trục X) */
uniform float lane_center = 0.0;
/** 1 = vẽ vạch kẻ đường, 0 = không (đường ngang dọc) */
uniform float show_lines : hint_range(0.0, 1.0) = 1.0;
group_uniforms;

group_uniforms tiles;
/** Cạnh viên gạch vỉa hè (m) */
uniform float sidewalk_tile = 0.5;
uniform vec3 brick_a : source_color = vec3(0.60, 0.57, 0.52);
uniform vec3 brick_b : source_color = vec3(0.67, 0.64, 0.58);
uniform vec3 grout : source_color = vec3(0.42, 0.40, 0.36);
group_uniforms;

const float GROUT_W = 0.07;   // bề dày mạch vữa, theo phần trăm viên gạch

varying vec3 wp;

void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

// nhiễu giả ngẫu nhiên theo ô lưới
float h(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// 1 trên mạch vữa, 0 trong lòng viên gạch
float grout_mask(vec2 f, float w) {
	return max(step(f.x, w), step(f.y, w));
}

void fragment() {
	// đường nhựa + vạch đứt giữa + vạch mép
	vec3 road = asphalt_color * (0.9 + h(floor(wp.xz * 6.0)) * 0.18);
	float rz = wp.z - lane_center;
	float dash = step(0.45, fract(wp.x / dash_period)) * (1.0 - step(0.08, abs(rz)));
	float edge = 1.0 - step(0.06, abs(abs(rz) - edge_line_z));
	road = mix(road, paint_color, max(dash, edge * 0.85) * show_lines);

	// vỉa hè gạch đỏ
	vec2 g1 = wp.xz / sidewalk_tile;
	vec3 walk = mix(brick_a, brick_b, h(floor(g1)));
	walk = mix(walk, grout, grout_mask(fract(g1), GROUT_W));

	// xi măng hẻm, ô lớn 1.2 m
	vec2 g2 = wp.xz / 1.2;
	vec3 alley = vec3(0.68, 0.66, 0.62) * (0.92 + h(floor(wp.xz * 3.0)) * 0.12);
	alley = mix(alley, vec3(0.48, 0.46, 0.43), grout_mask(fract(g2), 0.02));

	// sân gạch vàng, ô 0.8 m
	vec2 g3 = wp.xz / 0.8;
	vec3 plaza = mix(vec3(0.84, 0.76, 0.62), vec3(0.9, 0.83, 0.68), h(floor(g3)));
	plaza = mix(plaza, vec3(0.62, 0.54, 0.42), grout_mask(fract(g3), 0.05));

	// đất cỏ
	vec3 grass = mix(vec3(0.36, 0.55, 0.26), vec3(0.44, 0.63, 0.30), h(floor(wp.xz * 1.5)));

	float k = float(surface_kind);
	vec3 c = road * (1.0 - step(0.5, k))
		+ walk * step(0.5, k) * (1.0 - step(1.5, k))
		+ alley * step(1.5, k) * (1.0 - step(2.5, k))
		+ plaza * step(2.5, k) * (1.0 - step(3.5, k))
		+ grass * step(3.5, k);
	// vết loang, ố bẩn tầng thấp như nền vẽ tay
	float blot = smoothstep(0.55, 0.9, h(floor(wp.xz * 0.7)) * 0.6 + h(floor(wp.xz * 2.3)) * 0.4);
	c *= 1.0 - blot * 0.18;
	ALBEDO = c;
	ROUGHNESS = 0.9;
}
