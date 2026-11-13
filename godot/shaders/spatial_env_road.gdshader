// spatial_env_road — mặt đường nhựa cho đường cong (dải băng), Phố Đèn Lồng 2.5D.
// Tác giả: dựng cùng Claude. Pipeline: Forward+ (desktop), không đọc texture.
// UV.x = quãng đường dọc tim đường (m), UV.y = 0..1 từ mép trái sang mép phải,
// nên vạch kẻ đi theo đúng đường cong.
shader_type spatial;
render_mode diffuse_toon, specular_toon;

group_uniforms road;
uniform vec3 asphalt_color : source_color = vec3(0.36, 0.36, 0.37);
uniform vec3 paint_color : source_color = vec3(0.86, 0.83, 0.72);
/** Chu kỳ vạch đứt giữa đường (m) */
uniform float dash_period = 3.0;
/** Bề rộng vạch giữa, theo phần bề ngang đường */
uniform float center_width = 0.012;
/** Vị trí vạch mép, theo phần bề ngang đường tính từ mép */
uniform float edge_inset = 0.05;
/** 1 = có vạch kẻ, 0 = đường trơn (hẻm, đường nhỏ) */
uniform float show_lines : hint_range(0.0, 1.0) = 1.0;
group_uniforms;

const float NOISE_SCALE = 6.0;   // hạt nhựa đường, số ô trên một mét

varying vec3 wp;

void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

float h(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void fragment() {
	vec3 c = asphalt_color * (0.9 + h(floor(wp.xz * NOISE_SCALE)) * 0.18);
	float dash = step(0.45, fract(UV.x / dash_period)) * (1.0 - step(center_width, abs(UV.y - 0.5)));
	float edge = 1.0 - step(0.012, abs(abs(UV.y - 0.5) - (0.5 - edge_inset)));
	c = mix(c, paint_color, max(dash, edge * 0.85) * show_lines);
	// mảng vá nhựa đường và vết bẩn
	float patch = smoothstep(0.62, 0.8, h(floor(wp.xz * 0.45)));
	c = mix(c, c * 0.8, patch);
	ALBEDO = c;
	ROUGHNESS = 0.9;
}
