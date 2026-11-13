"""Render nhà cửa, đồ vật thành ảnh 2D (2.5D) cho cảnh `town` trong Godot.

Chạy:  blender -b -P tools/blender/render_sprites.py -- godot/assets/models godot/assets/sprites [tên…]

Mỗi ảnh được chụp bằng camera trực giao, nghiêng PITCH độ, đúng góc camera trong game,
nên nhân vật/xe 3D trong Godot đứng khớp lên ảnh. Có viền nét (Freestyle) và bóng đổ
xuống đất (mặt hứng bóng của Cycles).

Quán mở mặt tiền được tách hai lớp:
- `back`: sàn, tường, đồ bên trong. Trong Godot, lớp này gập ở chân tường sau.
- `front`: cột, mái hiên, biển, tầng trên. Lớp này đứng ở mép mái hiên.
Nhân vật đứng trong quán nằm giữa hai lớp nên được vẽ đúng thứ tự trước/sau.

Kết quả: <tên>_<lớp>_day.png, <tên>_<lớp>_night.png và meta.json (kích thước, chỗ gập,
chân đế để chặn đường đi, chỗ ngồi cho nhân vật).
"""
import bpy
import json
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODELS = os.path.abspath(argv[0] if argv else 'godot/assets/models')
OUT = os.path.abspath(argv[1] if len(argv) > 1 else 'godot/assets/sprites')
ONLY = set(argv[2:])
FONT = os.path.abspath('godot/assets/fonts/NotoSans-Bold.ttf')
os.makedirs(OUT, exist_ok=True)

PITCH = 50.0   # độ, phải khớp CAM_PITCH trong godot/scripts/town.gd
PPM = 64       # điểm ảnh trên một mét
SAMPLES = 24
COS, SIN = math.cos(math.radians(PITCH)), math.sin(math.radians(PITCH))
UP = Vector((0, SIN, COS))         # trục "lên" của màn hình, trong toạ độ Blender
VIEW = Vector((0, COS, -SIN))      # hướng nhìn

# ---------------------------------------------------------------- danh sách ảnh cần render
RED, TEAL, YEL, PINK = '#e2412f', '#2a9d8f', '#f2b84b', '#e85d9a'


def darker(h, k=0.78):
    h = h.lstrip('#')
    return '#' + ''.join(f'{int(int(h[i:i + 2], 16) * k):02x}' for i in (0, 2, 4))


def faded(h, k=0.32):
    h = h.lstrip('#')
    v = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    g = sum(v) / 3
    return '#' + ''.join(f'{int(c + (g - c) * k):02x}' for c in v)


SUB = {
    'h_taphoa': 'Bia · Nước ngọt · Gạo', 'h_suaxe': 'Vá xe · Thay nhớt', 'h_thuoc': 'Đông y · Tây y', 'h_hoa': 'Hoa cưới · Hoa sự kiện',
    'h_dienthoai': 'Sửa chữa · Phụ kiện', 'h_vang': 'Mua bán vàng bạc', 'h_gao': 'Gạo các loại', 's_pho': 'Gia truyền · Hà Nội',
    's_gom': 'Gốm sứ · Quà lưu niệm', 's_buncha': 'Than hoa · Nem cua bể', 's_che': 'Chè ba miền · Sinh tố',
    'k_banhmi': 'Pate · Chả lụa', 'k_hutieu': 'Khô · Nước', 'k_taphoa': 'Đồ dùng gia đình',
}
NEON = {'s_cafe', 'h_cattoc', 'h_dienthoai', 'k_suadt'}


def house(name, glb, facade, text, board, glass=True, props=()):
    # trụ, gờ, bệ cửa cùng tông màu tường (đậm hơn) thay vì màu kem sáng nổi như cột trắng
    facade = faded(facade, 0.25)
    cols = {'Facade': facade, 'Trim': darker(facade, 0.86), 'ArchTrim': darker(facade, 0.9), 'Cream': darker(facade, 0.92),
            'Shutter': '#4f7a62', 'RoofTile': '#9a5a3c', 'TileRow': '#a8613f'}
    return dict(name=name, glb=glb, colors=cols, board=(text, board), glass=glass, props=list(props), kind='house',
                sub=SUB.get(name), neon=name in NEON)


def shop(name, glb, title, colors, props=(), people=(), lanterns=()):
    colors = {k: faded(v, 0.25) for k, v in colors.items()}
    if 'Facade' in colors:
        colors = dict(colors, Trim=darker(colors['Facade'], 0.86), ArchTrim=darker(colors['Facade'], 0.9))
    if 'Awning' in colors:
        colors['Awning'] = faded(colors['Awning'], 0.35)
    return dict(sub=SUB.get(name), neon=name in NEON, name=name, glb=glb, colors=colors, sign=title, props=list(props), people=list(people), lanterns=list(lanterns), kind='shop')


def kiosk(name, glb, title, awning, sign, wall='#f3d27a', people=()):
    # mái hiên tôn kẽm sọc xám xanh như phố cũ
    return dict(sub=SUB.get(name), neon=name in NEON, ink=sign, name=name, glb=glb, colors={'Awning': '#7f8d91', 'Cream': '#a3aeb1', 'Sign': sign, 'ShopWall': faded(wall, 0.3)}, sign=title, props=[], people=list(people), lanterns=[], kind='kiosk')


def prop(name, glb, colors=None, rot=0.0, extra=(), text=None, people=()):
    return dict(name=name, glb=glb, colors=colors or {}, rot=rot, props=list(extra), text=text, people=list(people), kind='prop')


# người: (x, y, hướng mặt độ theo Godot — 0 là quay ra camera, độ cao ghế hoặc -1 nếu đứng, kiểu)
SPRITES = [
    house('h_taphoa', 'house_3f_roof', '#f2c6b4', 'TẠP HÓA CÔ BA', '#2f7fd2'),
    house('h_suaxe', 'house_4f', '#a9d6e5', 'SỬA XE MÁY', RED, glass=False),
    house('h_cattoc', 'house_2f_roof', '#f6e3a1', 'CẮT TÓC NAM', '#9466d6'),
    house('h_thuoc', 'house_3f', '#c7e3b5', 'NHÀ THUỐC BÌNH AN', '#2fae8f'),
    house('h_hoa', 'house_3f_roof', '#c9b6e4', 'HOA TƯƠI', PINK,
          props=[('plant_pot', 0.6 + i * 0.6, -0.6 - (i % 2) * 0.3, 0, 0, {}) for i in range(4)]),
    house('h_dienthoai', 'house_4f', '#f6c79e', 'ĐIỆN THOẠI · SIM', '#f2a541'),
    house('h_vang', 'house_2f_roof', '#b5e0d0', 'TIỆM VÀNG KIM PHÁT', '#c0392b'),
    house('h_gao', 'house_3f', '#f3d27a', 'GẠO NGON MIỀN TÂY', '#6aa84f', glass=False,
          props=[('crate', 0.8 + i * 0.7, -0.55, 0, 0, {}) for i in range(3)]),
    dict(name='police', glb='police_station', colors={}, kind='police', props=[('flag_pole', 1.4, 1.1, 0, 0, {})],
         people=[(4.1, -0.4, 0, -1, 'police'), (6.9, 1.1, -20, -1, 'police')]),
    shop('s_gom', 'shop_open_7', 'XƯỞNG GỐM BÁT TRÀNG',
         {'Awning': '#2d5fa8', 'Sign': '#1f3f75', 'ShopWall': '#ead2b0', 'ShopFloor': '#c9a27e', 'Facade': '#e9d7b3'},
         props=[('kiln', 1.3, 6.8, 0, 0, {}), ('shelf', 4.6, 7.55, 0, 0, {}),
                ('potter_wheel', 2.4, 4.1, 0, 0, {}), ('potter_wheel', 4.6, 4.1, 0, 0, {}),
                ('stool_red', 2.4, 4.7, 0, 0, {}), ('stool_red', 4.6, 4.7, 0, 0, {}),
                ('table_low', 3.5, 1.4, 0, 0, {})]
         + [('vase', x, 7.55, 0, z, {}) for x in (3.9, 4.6, 5.3) for z in (0.1, 0.75, 1.4)]
         + [('vase', 3.2 + i * 0.3, 1.4, 0, 0.46, {}) for i in range(3)],
         people=[(2.4, 4.7, 0, 0.32, 'potter'), (4.6, 4.7, 0, 0.32, 'potter')],
         lanterns=[(1.5, '#2d5fa8'), (3.5, YEL), (5.5, '#2d5fa8')]),
    shop('s_pho', 'shop_open_6', 'PHỞ GÁNH ĐẦU NGÕ', {'Awning': '#c0392b', 'Facade': '#f0c96b'},
         props=[('counter', 1.6, 6.8, 0, 0, {}), ('pot_big', 3.7, 7.1, 0, 0, {}), ('altar', 4.9, 7.75, 0, 0, {}),
                ('fan', 5.5, 1.7, -150, 0, {})]
         + [t for (tx, ty) in ((1.4, 2.7), (4.3, 2.9), (1.4, 5.0)) for t in (
             ('table_low', tx, ty, 0, 0, {}), ('stool_red', tx - 0.22, ty + 0.62, 0, 0, {}), ('stool_red', tx + 0.22, ty - 0.62, 0, 0, {}),
             ('bowl', tx - 0.2, ty, 0, 0.46, {}), ('bowl', tx + 0.2, ty, 40, 0.46, {}))],
         people=[(1.6, 7.5, 0, -1, 'cook'), (1.18, 3.32, 0, 0.32, ''), (4.08, 3.52, 0, 0.32, ''), (4.52, 2.28, 180, 0.32, ''),
                 (1.62, 4.38, 180, 0.32, '')],
         lanterns=[(1.0, RED), (3.0, YEL), (5.0, RED)]),
    shop('s_cafe', 'shop_open_7', 'CÀ PHÊ TRỨNG GÁC MÁI',
         {'Awning': TEAL, 'Sign': '#1f6f66', 'ShopWall': '#f6e3c3', 'ShopFloor': '#8a5a3a', 'Facade': '#e8b4a0'},
         props=[('coffee_bar', 3.5, 7.0, 0, 0, {}), ('bookshelf', 6.2, 4.5, 90, 0, {})]
         + [t for (tx, ty) in ((1.8, 2.5), (4.6, 2.5), (2.8, 4.9)) for t in (
             ('round_table', tx, ty, 0, 0, {}), ('armchair', tx - 0.85, ty, -90, 0, {}), ('armchair', tx + 0.85, ty, 90, 0, {}))],
         people=[(3.5, 7.6, 0, -1, 'barista'), (0.95, 2.5, 90, 0.42, ''), (5.45, 2.5, -90, 0.42, ''), (1.95, 4.9, 90, 0.42, ''),
                 (3.65, 4.9, -90, 0.42, '')],
         lanterns=[(1.5, YEL), (3.5, RED), (5.5, YEL)]),
    shop('s_buncha', 'shop_open_7', 'BÚN CHẢ THAN HỒNG',
         {'Awning': '#e8573c', 'Sign': '#9b2d20', 'ShopWall': '#f2c6b4', 'ShopFloor': '#b5653a', 'Facade': '#f6e3a1'},
         props=[('grill', 3.5, 7.0, 0, 0, {}), ('long_table', 3.5, 2.5, 0, 0, {}), ('long_table', 3.5, 4.8, 0, 0, {})]
         + [('bowl', 2.7 + i * 0.8, ty, 0, 0.74, {}) for ty in (2.5, 4.8) for i in range(3)],
         people=[(3.5, 7.6, 0, -1, 'cook')] + [(2.7 + i * 0.8, ty + side * 0.75, 0 if side > 0 else 180, 0.44, '')
                                              for ty in (2.5, 4.8) for i in range(3) for side in (1, -1) if (i + ty) % 2 < 1.6],
         lanterns=[(1.5, RED), (3.5, YEL), (5.5, RED)]),
    shop('s_che', 'shop_open_6', 'CHÈ BA MIỀN',
         {'Awning': PINK, 'Sign': '#b83b78', 'ShopWall': '#fff3dc', 'ShopFloor': '#f6c7d0', 'Facade': '#d8e6f2'},
         props=[('jar_counter', 3.0, 6.9, 0, 0, {})]
         + [t for (tx, ty) in ((1.5, 2.9), (4.3, 4.1)) for t in (
             ('table_low', tx, ty, 0, 0, {}), ('stool_blue', tx - 0.22, ty + 0.62, 0, 0, {}), ('stool_blue', tx + 0.22, ty - 0.62, 0, 0, {}),
             ('stool_blue', tx - 0.75, ty, 0, 0, {}))],
         people=[(3.0, 7.55, 0, -1, 'seller'), (1.28, 3.52, 0, 0.32, ''), (0.75, 2.9, 90, 0.32, ''), (4.52, 3.48, 180, 0.32, '')],
         lanterns=[(1.0, PINK), (3.0, YEL), (5.0, PINK)]),
    kiosk('k_banhmi', 'kiosk_5', 'BÁNH MÌ PHỐ HỘI', '#f2a541', '#c0392b', people=[(2.5, 2.2, 0, -1, 'seller')]),
    kiosk('k_nuocmia', 'kiosk_5', 'NƯỚC MÍA SIÊU SẠCH', '#6aa84f', '#2f6b3a', '#e8f0d8', people=[(2.5, 2.2, 0, -1, 'seller')]),
    kiosk('k_giatui', 'kiosk_5', 'GIẶT ỦI SẠCH THƠM', '#3f8fd2', '#1f4f8f', '#d8e6f2'),
    kiosk('k_taphoa', 'kiosk_6', 'TẠP HÓA ÚT HIỀN', '#e2412f', '#9b2d20', people=[(3.0, 2.2, 0, -1, 'seller')]),
    kiosk('k_suadt', 'kiosk_5', 'SỬA ĐIỆN THOẠI', '#9466d6', '#5b3a8f', '#efe3f6'),
    kiosk('k_hutieu', 'kiosk_6', 'HỦ TIẾU NAM VANG', '#e8573c', '#9b2d20', people=[(3.0, 2.2, 0, -1, 'cook')]),
    dict(name='market', glb='market_hall', colors={}, kind='market', sign='CHỢ ĐẦU MỐI', props=[]),
    dict(name='tower_a', glb='tower_a', colors={}, kind='plain', props=[]),
    dict(name='tower_b', glb='tower_b', colors={}, kind='plain', props=[]),
    dict(name='tower_c', glb='tower_c', colors={}, kind='plain', props=[]),
    prop('tree', 'tree'), prop('banyan', 'banyan'), prop('power_pole', 'wire_pole'),
    prop('cyclo', 'cyclo'), prop('ba_gac', 'ba_gac'), prop('bricks', 'bricks'), prop('flower_bike', 'flower_bike'),
    prop('boat', 'boat'), prop('boat_r', 'boat', rot=180),
    prop('kitchen', 'sidewalk_kitchen', people=[(0.75, 0.55, 180, 0.2, 'cook')]),
    prop('lamp_n', 'street_lamp'), prop('lamp_s', 'street_lamp', rot=180),
    prop('umb_red', 'patio_umbrella', {'UmbrellaCloth': RED}), prop('umb_teal', 'patio_umbrella', {'UmbrellaCloth': TEAL}),
    prop('umb_yellow', 'patio_umbrella', {'UmbrellaCloth': YEL}), prop('umb_pink', 'patio_umbrella', {'UmbrellaCloth': PINK}),
    prop('banh_mi_cart', 'banh_mi_cart'), prop('fruit_cart', 'fruit_cart'), prop('hedge', 'hedge_planter'),
    prop('topiary', 'topiary'), prop('carton', 'carton'), prop('basins', 'basin_stack'), prop('crate', 'crate'),
    prop('aframe_red', 'aframe_sign', {'SignFace': RED}), prop('aframe_blue', 'aframe_sign', {'SignFace': '#2f7fd2'}),
    prop('aframe_purple', 'aframe_sign', {'SignFace': '#9466d6'}), prop('aframe_teal', 'aframe_sign', {'SignFace': TEAL}),
    prop('loud_pole', 'loud_pole'), prop('bus_stop', 'bus_stop', text=('TRẠM XE BUÝT', 1.25, 0.0, 2.35, 0.4)),
    prop('bench', 'bench_stone'), prop('plant_pot', 'plant_pot'),
    prop('stall_green', 'market_stall', {'Canvas': '#6aa84f'}), prop('stall_red', 'market_stall', {'Canvas': RED}),
    prop('stall_blue', 'market_stall', {'Canvas': '#3f8fd2'}),
    prop('eat_red', 'table_low', extra=[('stool_red', -0.22, 0.62, 0, 0, {}), ('stool_red', 0.22, -0.62, 0, 0, {}),
                                        ('stool_red', -0.75, 0, 0, 0, {}), ('stool_red', 0.75, 0, 0, 0, {}),
                                        ('bowl', -0.2, 0, 0, 0.46, {}), ('bowl', 0.2, 0, 60, 0.46, {})],
         people=[(-0.22, 0.62, 0, 0.32, ''), (0.22, -0.62, 180, 0.32, ''), (0.75, 0, -90, 0.32, '')]),
    prop('eat_blue', 'table_low', extra=[('stool_blue', -0.22, 0.62, 0, 0, {}), ('stool_blue', 0.22, -0.62, 0, 0, {}),
                                         ('stool_blue', -0.75, 0, 0, 0, {}), ('bowl', -0.2, 0, 0, 0.46, {})],
         people=[(-0.22, 0.62, 0, 0.32, ''), (-0.75, 0, 90, 0.32, '')]),
]

FRONT_PREFIX = ('Pillar', 'Awn', 'SignBoard', 'SignText', 'Lamp', 'Upper', 'UpShell', 'UW', 'UB', 'UPil', 'UCornice', 'UpPar',
                'Tiles', 'RoofBack', 'Ridge', 'WallTop', 'Lantern')


# ---------------------------------------------------------------- cảnh, ánh sáng, camera
def hexlin(h):
    h = h.lstrip('#')
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]


def principled(m):
    if not m.use_nodes:
        m.use_nodes = True
    return next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def new_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    try:
        sc.render.engine = 'CYCLES'
    except TypeError:
        pass
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 4
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    vts = [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items]
    if 'Standard' in vts:
        sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = -0.45  # giữ màu đậm, không cháy sáng
    # viền nét kiểu tranh vẽ
    sc.render.use_freestyle = True
    sc.render.line_thickness_mode = 'ABSOLUTE'
    sc.render.line_thickness = 1.6
    fs = sc.view_layers[0].freestyle_settings
    ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new('Lines')
    ls.select_by_visibility = True
    ls.select_silhouette = True
    ls.select_border = True
    ls.select_crease = True
    if ls.linestyle is None:
        ls.linestyle = bpy.data.linestyles.new('Ink')
    ls.linestyle.color = (0.10, 0.06, 0.04)
    ls.linestyle.thickness = 1.6
    # chữ trên biển không vẽ viền (để đọc được): loại bộ sưu tập NoLine khỏi nét
    noline = bpy.data.collections.new('NoLine')
    sc.collection.children.link(noline)
    ls.select_by_collection = True
    ls.collection = noline
    ls.collection_negation = 'EXCLUSIVE'
    # nét vẽ tay: đường hơi rung, dày mỏng không đều
    if not ls.linestyle.geometry_modifiers:
        g = ls.linestyle.geometry_modifiers.new('Wobble', 'PERLIN_NOISE_1D')
        g.frequency = 3.0
        g.amplitude = 0.35
    if not ls.linestyle.thickness_modifiers:
        t = ls.linestyle.thickness_modifiers.new('Uneven', 'NOISE')
        t.amplitude = 0.6
        t.period = 20.0
    fs.crease_angle = math.radians(120)
    # mặt đất hứng bóng
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
    g = bpy.context.active_object
    g.name = 'ShadowCatcher'
    g.is_shadow_catcher = True
    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    sc.world = world
    return sc


def lighting(sc, night, spots):
    for o in [o for o in sc.objects if o.type == 'LIGHT']:
        bpy.data.objects.remove(o, do_unlink=True)
    bg = next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND')
    sun = bpy.data.lights.new('Sun', 'SUN')
    so = bpy.data.objects.new('Sun', sun)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(48), 0, math.radians(-28))
    sun.angle = math.radians(6)
    if night:
        bg.inputs['Color'].default_value = (*hexlin('#2a3466'), 1)
        bg.inputs['Strength'].default_value = 0.35
        sun.color = hexlin('#8fa0ff')
        sun.energy = 0.35
        for (x, y, z, e) in spots:
            pl = bpy.data.lights.new('Warm', 'POINT')
            pl.color = hexlin('#ffb46a')
            pl.energy = e
            pl.shadow_soft_size = 0.4
            po = bpy.data.objects.new('Warm', pl)
            sc.collection.objects.link(po)
            po.location = (x, y, z)
    else:
        bg.inputs['Color'].default_value = (*hexlin('#dfe8ff'), 1)
        bg.inputs['Strength'].default_value = 0.6
        sun.color = hexlin('#fff0d6')
        sun.energy = 2.6


def import_glb(name, x=0.0, y=0.0, rot=0.0, z=0.0, colors=None):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, name + '.glb'))
    new = [o for o in bpy.context.scene.objects if o not in before]
    roots = [o for o in new if o.parent is None]
    for r in roots:
        r.location = (r.location.x + x, r.location.y + y, r.location.z + z)
        r.rotation_mode = 'XYZ'
        r.rotation_euler.z += math.radians(rot)
    if colors:
        recolor(new, colors)
    return new


def recolor(objs, colors):
    """Đổi màu theo tên vật liệu, chỉ trong các vật vừa nhập (mỗi bản sao một màu riêng)."""
    for o in objs:
        if o.type != 'MESH':
            continue
        for slot in o.material_slots:
            if slot.material is None:
                continue
            base = slot.material.name.split('.')[0]
            if base in colors:
                m = slot.material.copy()
                p = principled(m)
                p.inputs['Base Color'].default_value = (*hexlin(colors[base]), 1)
                if p.inputs['Emission Strength'].default_value > 0:
                    p.inputs['Emission Color'].default_value = (*hexlin(colors[base]), 1)
                slot.material = m


SKIP_WEATHER = ('Porcelain', 'Glass', 'ShopGlass', 'WindowGlow', 'LanternSilk', 'Eye', 'Headlight', 'LampBulb', 'Neon',
                'SignText', 'Panel', 'Coal', 'Fire', 'Ember', 'OvenGlow', 'WallLamp', 'TowerLit', 'Screen')


def _sock(sockets, ident):
    return next(x for x in sockets if x.identifier == ident)


def weather(objs):
    """Phủ vết ố (nhiễu theo toạ độ vật) và vệt bẩn ở chân tường lên màu gốc, như tranh vẽ phố cũ."""
    done = set()
    for o in objs:
        if o.type != 'MESH':
            continue
        for slot in o.material_slots:
            m = slot.material
            if m is None or m.name in done or m.name.split('.')[0].startswith(SKIP_WEATHER):
                continue
            done.add(m.name)
            p = principled(m)
            if p.inputs['Emission Strength'].default_value > 0 or p.inputs['Base Color'].is_linked:
                continue
            c = list(p.inputs['Base Color'].default_value)
            N = m.node_tree.nodes
            L = m.node_tree.links
            base = N.new('ShaderNodeRGB')
            base.outputs[0].default_value = c
            tc = N.new('ShaderNodeTexCoord')
            noise = N.new('ShaderNodeTexNoise')
            noise.inputs['Scale'].default_value = 3.5
            noise.inputs['Detail'].default_value = 8.0
            L.new(tc.outputs['Object'], noise.inputs['Vector'])
            ramp = N.new('ShaderNodeValToRGB')
            ramp.color_ramp.elements[0].position = 0.5
            ramp.color_ramp.elements[1].position = 0.75
            L.new(noise.outputs['Fac'], ramp.inputs['Fac'])
            fac = N.new('ShaderNodeMath')
            fac.operation = 'MULTIPLY'
            fac.inputs[1].default_value = 0.32
            L.new(ramp.outputs['Color'], fac.inputs[0])
            stain = N.new('ShaderNodeMix')
            stain.data_type = 'RGBA'
            L.new(fac.outputs[0], _sock(stain.inputs, 'Factor_Float'))
            L.new(base.outputs[0], _sock(stain.inputs, 'A_Color'))
            _sock(stain.inputs, 'B_Color').default_value = (c[0] * 0.62, c[1] * 0.58, c[2] * 0.5, 1)
            # chân tường bẩn: tối dần khi xuống gần mặt đất
            geo = N.new('ShaderNodeNewGeometry')
            sep = N.new('ShaderNodeSeparateXYZ')
            L.new(geo.outputs['Position'], sep.inputs[0])
            mr = N.new('ShaderNodeMapRange')
            mr.inputs['From Min'].default_value = 0.0
            mr.inputs['From Max'].default_value = 1.3
            mr.inputs['To Min'].default_value = 0.38
            mr.inputs['To Max'].default_value = 0.0
            L.new(sep.outputs['Z'], mr.inputs['Value'])
            grime = N.new('ShaderNodeMix')
            grime.data_type = 'RGBA'
            L.new(mr.outputs['Result'], _sock(grime.inputs, 'Factor_Float'))
            L.new(_sock(stain.outputs, 'Result_Color'), _sock(grime.inputs, 'A_Color'))
            _sock(grime.inputs, 'B_Color').default_value = (0.16, 0.12, 0.08, 1)
            L.new(_sock(grime.outputs, 'Result_Color'), p.inputs['Base Color'])
            p.inputs['Roughness'].default_value = max(p.inputs['Roughness'].default_value, 0.7)


def flat(name, color, emit=0.0):
    m = bpy.data.materials.new(name)
    p = principled(m)
    p.inputs['Base Color'].default_value = (*hexlin(color), 1)
    p.inputs['Roughness'].default_value = 0.7
    if emit:
        p.inputs['Emission Color'].default_value = (*hexlin(color), 1)
        p.inputs['Emission Strength'].default_value = emit
    return m


def board(name, x0, x1, y, z0, z1, color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, y, (z0 + z1) / 2))
    o = bpy.context.active_object
    o.name = name
    o.scale = (x1 - x0, 0.12, z1 - z0)
    o.data.materials.append(flat(name + 'M', color))
    b = o.modifiers.new('B', 'BEVEL')
    b.width = 0.04
    b.segments = 2
    return o


def text(name, body, x, y, z, width, height, color='#ffe7a8'):
    """Chữ dựng đứng quay ra trước (-Y), tự thu nhỏ cho vừa khung width × height."""
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.font = bpy.data.fonts.load(FONT, check_existing=True)
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.size = height
    cu.extrude = 0.01
    o = bpy.data.objects.new(name, cu)
    bpy.data.collections['NoLine'].objects.link(o)
    o.rotation_euler = (math.radians(90), 0, 0)
    o.location = (x, y, z)
    o.data.materials.append(flat(name + 'M', color, emit=0.6))
    bpy.context.view_layer.update()
    if o.dimensions.x > width:
        s = width / o.dimensions.x
        o.scale = (s, s, s)
    return o


def panel(x0, x1, y, z0, z1, color, title, sub=None, neon=False):
    """Biển hiệu: nền kem, viền màu, chữ màu (dòng phụ nhỏ hơn); hoặc biển neon nền tối, chữ và viền phát sáng."""
    out = [board('PanelBG', x0, x1, y, z0, z1, '#2a2230' if neon else '#efe4c8')]
    t = 0.07
    edge = flat('NeonEdge', color, emit=6.0) if neon else flat('PanelEdge', color)
    for (a0, a1, b0, b1) in ((x0, x1, z1 - t, z1), (x0, x1, z0, z0 + t), (x0, x0 + t, z0, z1), (x1 - t, x1, z0, z1)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=((a0 + a1) / 2, y - 0.075, (b0 + b1) / 2))
        e = bpy.context.active_object
        e.name = 'PanelEdge'
        e.scale = (a1 - a0, 0.04, b1 - b0)
        e.data.materials.append(edge)
        out.append(e)
    h, w = z1 - z0, x1 - x0
    if sub:
        out.append(text('SignTextMain', title, (x0 + x1) / 2, y - 0.1, z0 + h * 0.64, w * 0.9, h * 0.48, color))
        out.append(text('SignTextSub', sub, (x0 + x1) / 2, y - 0.1, z0 + h * 0.24, w * 0.82, h * 0.24, '#9ff5ff' if neon else '#3a2a20'))
    else:
        out.append(text('SignTextMain', title, (x0 + x1) / 2, y - 0.1, (z0 + z1) / 2, w * 0.9, h * 0.6, color))
    if neon:
        for o in out:
            if o.name.startswith('SignText'):
                principled(o.data.materials[0]).inputs['Emission Strength'].default_value = 5.0
    return out


def world_bbox(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type not in ('MESH', 'FONT', 'CURVE') or o.name == 'ShadowCatcher':
            continue
        oe = o.evaluated_get(dg)
        for c in oe.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
            hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
    return lo, hi


def is_front(o):
    p = o
    while p is not None:
        if p.name.split('.')[0].startswith(FRONT_PREFIX):
            return True
        p = p.parent
    return False


def render(sc, objs, path, bounds):
    """Chụp các vật `objs` (ẩn phần còn lại) với khung `bounds` = (px0, px1, py0, py1)."""
    keep = set(objs)
    for o in sc.objects:
        if o.type in ('MESH', 'FONT', 'CURVE') and o.name != 'ShadowCatcher':
            o.hide_render = o not in keep
    px0, px1, py0, py1 = bounds
    w, h = px1 - px0, py1 - py0
    cam = sc.camera
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = max(w, h)
    cam.data.clip_end = 400
    cam.rotation_euler = (math.radians(90 - PITCH), 0, 0)
    cx, cy = (px0 + px1) / 2, (py0 + py1) / 2
    cam.location = Vector((cx, 0, 0)) + UP * cy - VIEW * 120
    sc.render.resolution_x = max(4, round(w * PPM))
    sc.render.resolution_y = max(4, round(h * PPM))
    sc.render.resolution_percentage = 100
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def build(spec):
    sc = new_scene()
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    objs = import_glb(spec['glb'], rot=spec.get('rot', 0.0), colors=spec.get('colors'))
    roof = {'shop_open_6': 6.9, 'shop_open_7': 6.9, 'house_3f': 10.2, 'house_4f': 13.4}.get(spec['glb'])
    if roof:
        # mái bằng: bồn nước, chậu cây, dây phơi như phố thật
        ww = 6.0 if spec['glb'] == 'shop_open_6' else 7.0 if spec['glb'] == 'shop_open_7' else 4.0
        for (g, x, y) in (('water_tank', ww * 0.3, 5.5), ('plant_pot', ww * 0.75, 1.0), ('plant_pot', ww * 0.85, 1.6),
                          ('clothes_line', ww * 0.55, 3.2)):
            for o in import_glb(g, x, y, 0, roof - 0.5):
                o.name = 'UpperRoof' + o.name  # thuộc lớp ngoài cùng tầng trên
                objs.append(o)
    for (g, x, y, rot, z, cols) in spec.get('props', []):
        objs += import_glb(g, x, y, rot, z, cols)
    lo, hi = world_bbox(objs)
    w = hi.x - lo.x
    kind = spec['kind']
    if kind == 'house':
        txt, col = spec['board']
        # biển treo nhô ra trước, thấp hơn ban công để camera nhìn cao vẫn thấy
        objs += panel(0.15, w - 0.15, -0.38, 1.85, 2.62, col, txt, spec.get('sub'), spec.get('neon', False))
        if spec.get('glass'):
            objs += import_glb('glass_shopfront', (w - 3.0) / 2, -0.05)
    elif kind in ('shop', 'kiosk', 'market'):
        col = spec.get('ink') or darker(spec['colors'].get('Sign', spec['colors'].get('Awning', '#c0392b')), 0.8)
        if kind == 'shop':
            # biển gắn ở mép mái hiên (biển gốc nằm dưới ban công, nhìn từ trên bị che)
            rect = (0.4, w - 0.4, -1.34, 2.25, 3.05)
        else:
            sb = next(o for o in objs if o.name.split('.')[0] == 'SignBoard')
            slo, shi = world_bbox([sb])
            rect = (slo.x, shi.x, slo.y - 0.02, slo.z, shi.z)
        for o in panel(*rect, col, spec['sign'], spec.get('sub'), spec.get('neon', False)):
            o.name = 'SignBoard' + o.name
            objs.append(o)
        for (lx, col) in spec.get('lanterns', []):
            for o in import_glb('lantern', lx, -0.7, 0, 1.75, {'LanternSilk': col}):
                o.name = 'Lantern' + o.name
                objs.append(o)
    elif kind == 'police':
        objs.append(text('SignText', 'CÔNG AN PHƯỜNG ĐÈN LỒNG', 4.0, 2.27, 6.45, 6.8, 0.42, '#ffe27a'))
    if kind == 'prop' and spec.get('text'):
        t, x, y, z, hgt = spec['text']
        objs.append(text('SignText', t, x, y - 0.06, z, 1.8, hgt, '#ffffff'))

    weather(objs)
    lo, hi = world_bbox(objs)
    pad = 0.25
    # chiếu 8 góc khung bao lên mặt phẳng ảnh
    pys = [UP.dot(Vector((x, y, z))) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    bounds = (lo.x - pad, hi.x + pad, min(pys) - pad, max(pys) + pad)

    # chân đế: những vật chạm đất
    ground = [o for o in objs if o.type == 'MESH' and world_bbox([o])[0].z < 0.3 and not o.name.startswith('Lantern')]
    flo, fhi = world_bbox(ground) if ground else (lo, hi)

    layers = []
    if kind in ('shop', 'kiosk'):
        front = [o for o in objs if is_front(o)]
        back = [o for o in objs if not is_front(o)]
        wb = next((o for o in objs if o.name.split('.')[0] == 'WallBack'), None)
        fold_back = world_bbox([wb])[0].y if wb else hi.y
        flo_f = world_bbox([o for o in front if o.type in ('MESH', 'FONT')])[0]
        layers.append(('back', back, fold_back, lo.y - pad))
        layers.append(('front', front, flo_f.y, flo_f.y))
    else:
        fold = 0.0 if kind in ('house', 'police', 'market', 'plain') else (lo.y + hi.y) / 2
        if kind == 'police':
            fold = 2.5  # mặt nhà lùi sau sân
            layers.append(('yard', [o for o in objs if world_bbox([o])[1].y <= 2.45], 0.0, lo.y - pad))
            layers.append(('main', [o for o in objs if world_bbox([o])[1].y > 2.45], fold, fold))
        else:
            layers.append(('main', objs, fold, lo.y - pad))

    spots = [(w * 0.3, lo.y - 1.2, 2.6, 260), (w * 0.7, lo.y - 1.2, 2.6, 260)] if kind != 'prop' else []
    if spec['glb'] == 'street_lamp':
        spots = [(0, -1.15 if spec.get('rot', 0) == 0 else 1.15, 4.1, 400)]
    meta_layers = []
    for (tag, lobjs, fold, ymin) in layers:
        entry = dict(tag=tag, fold=fold, ymin=ymin)
        for night in (False, True):
            lighting(sc, night, spots)
            fn = f"{spec['name']}_{tag}_{'night' if night else 'day'}.png"
            render(sc, lobjs, os.path.join(OUT, fn), bounds)
            grade(os.path.join(OUT, fn), night)
            entry['night' if night else 'day'] = 'res://assets/sprites/' + fn
        meta_layers.append(entry)
    return dict(
        bounds=bounds, layers=meta_layers, foot=[flo.x, flo.y, fhi.x, fhi.y], height=hi.z,
        width=w, x0=lo.x, people=spec.get('people', []), kind=kind,
    )


def grade(path, night):
    """Hậu kỳ kiểu tranh minh hoạ: giảm bão hoà, ngả ấm, tăng tương phản nhẹ, phủ hạt giấy."""
    import numpy as np
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    rgb = px[..., :3]
    lum = (rgb * np.array([0.299, 0.587, 0.114], dtype=np.float32)).sum(-1, keepdims=True)
    rgb = lum + (rgb - lum) * (1.0 if not night else 0.98)
    rgb = rgb * np.array([1.06, 1.0, 0.86] if not night else [1.0, 0.98, 1.02], dtype=np.float32)
    rgb = (rgb - 0.5) * 1.06 + 0.5
    rng = np.random.default_rng(len(path))
    grain = 1.0 + (rng.random((h, w, 1), dtype=np.float32) - 0.5) * 0.07
    px[..., :3] = np.clip(rgb * grain, 0.0, 1.0)
    img.pixels[:] = px.ravel()
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


if __name__ == '__main__':
    meta_path = os.path.join(OUT, 'meta.json')
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    for spec in SPRITES:
        if ONLY and spec['name'] not in ONLY:
            continue
        print('render', spec['name'], flush=True)
        meta[spec['name']] = build(spec)
        json.dump(meta, open(meta_path, 'w'), ensure_ascii=False, indent=1)
    meta['_camera'] = dict(pitch=PITCH, ppm=PPM)
    json.dump(meta, open(meta_path, 'w'), ensure_ascii=False, indent=1)
    print('XONG')
