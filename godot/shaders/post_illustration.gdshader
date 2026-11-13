// post_illustration — lọc toàn màn hình cho cảnh town: kéo nhân vật 3D và nền 2D về cùng một
// chất tranh minh hoạ (màu trầm ấm, hạt giấy, tối nhẹ ở rìa).
// Tác giả: dựng cùng Claude. Pipeline: Forward+ / Mobile, một lần đọc texture màn hình.
shader_type canvas_item;

uniform sampler2D screen_tex : hint_screen_texture, filter_linear;

group_uniforms grade;
/** Độ bão hoà (1 = giữ nguyên) */
uniform float saturation : hint_range(0.0, 1.5) = 0.9;
/** Nhân màu để ngả ấm */
uniform vec3 warm = vec3(1.03, 1.0, 0.93);
/** Độ mạnh hạt giấy */
uniform float grain : hint_range(0.0, 0.2) = 0.04;
/** Độ tối ở rìa khung hình */
uniform float vignette : hint_range(0.0, 1.0) = 0.28;
group_uniforms;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);

float h(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void fragment() {
	vec3 c = texture(screen_tex, SCREEN_UV).rgb;
	float l = dot(c, LUMA);
	c = mix(vec3(l), c, saturation) * warm;
	// hạt giấy cố định theo điểm ảnh (không nhảy theo thời gian)
	c *= 1.0 + (h(floor(FRAGCOORD.xy)) - 0.5) * grain;
	vec2 d = SCREEN_UV - 0.5;
	c *= 1.0 - dot(d, d) * vignette * 1.6;
	COLOR = vec4(c, 1.0);
}
