"""Dựng mô hình 3D cho Phố Đèn Lồng (bản Godot) và xuất ra .glb.

Chạy:  blender -b -P tools/blender/build_assets.py -- godot/assets/models

Quy ước (Blender, Z hướng lên):
- Mặt tiền / mặt trước của vật quay về -Y (sang Godot thành +Z, hướng ra phố).
- Nhà: chân trước nằm ở y = 0, kéo về phía sau (+Y). Gốc toạ độ ở góc trước-trái.
- Đồ vật nhỏ: gốc toạ độ ở giữa đáy.
- Tên vật liệu là "khoá" để Godot đổi màu theo từng bản sao (Shirt, Facade, Awning…).
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Matrix, Vector

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'godot/assets/models'
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- tiện ích
MATS = {}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(name, color, emit=0.0, rough=0.75, metal=0.0, alpha=1.0):
    """Vật liệu Principled đơn giản. color là hex '#rrggbb'."""
    if name in MATS:
        return MATS[name]
    h = color.lstrip('#')
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*lin, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emit > 0:
        p.inputs['Emission Color'].default_value = (*lin, 1)
        p.inputs['Emission Strength'].default_value = emit
    if alpha < 1:
        p.inputs['Alpha'].default_value = alpha
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'BLENDED'
    MATS[name] = m
    return m


def root(name):
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    return o


def _finish(o, name, m, parent, smooth=True, bevel=0.0, seg=2):
    o.name = name
    if m is not None:
        o.data.materials.clear()
        o.data.materials.append(m)
    if smooth:
        o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    if bevel > 0:
        b = o.modifiers.new('Bevel', 'BEVEL')
        b.width = bevel
        b.segments = seg
        b.limit_method = 'ANGLE'
        o.modifiers.new('WN', 'WEIGHTED_NORMAL').keep_sharp = True
    if parent is not None:
        o.parent = parent
        o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o


def box(name, x0, y0, z0, x1, y1, z1, m, parent=None, bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.active_object
    o.scale = (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bv = min(bevel, abs(x1 - x0) / 2.2, abs(y1 - y0) / 2.2, abs(z1 - z0) / 2.2)
    return _finish(o, name, m, parent, smooth=bv > 0, bevel=bv)


def cyl(name, x, y, z0, r, h, m, parent=None, verts=20, r2=None, axis='Z', bevel=0.0):
    """Trụ (hoặc nón cụt khi có r2) đứng trên z0. axis='X'/'Y' thì nằm ngang, tâm tại (x, y, z0)."""
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(0, 0, 0))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=h, location=(0, 0, 0))
    o = bpy.context.active_object
    if axis == 'Z':
        o.location = (x, y, z0 + h / 2)
    else:
        o.rotation_euler = (0, math.pi / 2, 0) if axis == 'X' else (math.pi / 2, 0, 0)
        o.location = (x, y, z0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o = _finish(o, name, m, parent, smooth=True, bevel=bevel)
    # trụ: chỉ làm mịn mặt bên, giữ mép nắp sắc
    for p in o.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return o


def sph(name, x, y, z, rx, ry, rz, m, parent=None, seg=24, rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=(x, y, z))
    o = bpy.context.active_object
    o.scale = (rx, ry, rz)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(o, name, m, parent)


def set_origin(o, p):
    """Đặt gốc của vật tại điểm p (toạ độ thế giới) mà hình không xê dịch: làm khớp xoay cho tay chân."""
    p = Vector(p)
    d = p - o.matrix_world.translation
    o.data.transform(Matrix.Translation(-d))
    o.location = o.location + d


def stripes(name, x0, y0, z0, x1, y1, z1, n, m1, m2, parent):
    """Dải sọc dọc theo trục X (mái hiên, bạt che)."""
    w = (x1 - x0) / n
    for i in range(n):
        box(f'{name}{i}', x0 + i * w, y0, z0, x0 + (i + 1) * w, y1, z1, m1 if i % 2 == 0 else m2, parent, bevel=0.01)


def export(name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, f'{name}.glb'),
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )
    print('xuất', name)


# ---------------------------------------------------------------- bảng màu chung
def palette():
    return dict(
        wood=mat('Wood', '#b8763f'), wood_d=mat('WoodDark', '#7a4a2a'), wood_l=mat('WoodLight', '#d9a66a'),
        red=mat('PlasticRed', '#e2412f', rough=.45), blue=mat('PlasticBlue', '#3f8fd2', rough=.45),
        white=mat('Porcelain', '#fbf7ef', rough=.3), steel=mat('Steel', '#b9c2cc', rough=.35, metal=.6),
        dark=mat('Dark', '#2e2a2c'), broth=mat('Broth', '#c9803c', rough=.2), herb=mat('Herb', '#4f9d4a'),
        stone=mat('Stone', '#e9e2d4'), gold=mat('Gold', '#f2b84b', metal=.4, rough=.4),
        glass=mat('Glass', '#bfe6f2', rough=.05, alpha=.45), leaf=mat('Leaf', '#4f9d4a'), leaf2=mat('Leaf2', '#7cc46a'),
        trunk=mat('Trunk', '#7a4a2a'), concrete=mat('Concrete', '#bdb6aa'), cream=mat('Cream', '#fff3dc'),
        clay=mat('Clay', '#c9774a'), terracotta=mat('Terracotta', '#b5653a'),
    )


# ================================================================= NHÂN VẬT CHIBI
def build_chibi():
    reset()
    R = root('Chibi')
    skin, hair = mat('Skin', '#ffd9b8', rough=.6), mat('Hair', '#2b1a12', rough=.5)
    shirt, pants = mat('Shirt', '#e8573c'), mat('Pants', '#3c4f6b')
    shoe, belt = mat('Shoe', '#3b2a22'), mat('Belt', '#5b2a1c')
    eye, hi = mat('Eye', '#1a110c', rough=.15), mat('EyeHi', '#ffffff', emit=.6, rough=.1)
    blush, mouth, apron = mat('Blush', '#ff9a8a', rough=.8), mat('Mouth', '#6b2a22'), mat('Apron', '#fff8ec')

    for side, sx in (('L', -1), ('R', 1)):
        leg = box(f'Leg{side}', sx * 0.13 - 0.055, -0.075, 0.07, sx * 0.13 + 0.055, 0.075, 0.30, pants, R, bevel=.03)
        set_origin(leg, (sx * 0.13, 0, 0.30))
        foot = box(f'Foot{side}', sx * 0.13 - 0.075, -0.12, 0.0, sx * 0.13 + 0.075, 0.08, 0.09, shoe, leg, bevel=.035)

    body = box('Body', -0.21, -0.15, 0.26, 0.21, 0.15, 0.64, shirt, R, bevel=.09)
    set_origin(body, (0, 0, 0.26))
    box('Belt', -0.22, -0.16, 0.34, 0.22, 0.16, 0.40, belt, body, bevel=.02)
    sph('Knot', 0.09, -0.165, 0.37, 0.05, 0.03, 0.04, belt, body)
    box('Apron', -0.15, -0.165, 0.18, 0.15, -0.15, 0.40, apron, body, bevel=.01)
    # cổ áo chéo
    box('Collar', -0.02, -0.158, 0.48, 0.13, -0.148, 0.62, mat('Collar', '#5a2a1c'), body, bevel=.005)

    for side, sx in (('L', -1), ('R', 1)):
        arm = cyl(f'Arm{side}', sx * 0.255, 0, 0.40, 0.065, 0.22, shirt, R, verts=16)
        set_origin(arm, (sx * 0.255, 0, 0.60))
        sph(f'Hand{side}', sx * 0.26, 0, 0.38, 0.072, 0.072, 0.072, skin, arm)

    head = sph('Head', 0, 0, 0.93, 0.34, 0.31, 0.31, skin, R, seg=32, rings=18)
    set_origin(head, (0, 0, 0.62))
    # tóc: vỏ cầu phía sau + mái bằng
    hb = sph('HairBack', 0, 0.035, 0.98, 0.36, 0.33, 0.33, hair, head, seg=32, rings=18)
    bm = bmesh.new()
    bm.from_mesh(hb.data)
    # toạ độ đỉnh là toạ độ cục bộ: tâm cầu tóc ở (0, 0.035, 0.98)
    kill = [v for v in bm.verts if v.co.y + 0.035 < -0.10 and v.co.z + 0.98 < 1.06]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(hb.data)
    bm.free()
    sph('Bangs', 0, -0.20, 1.10, 0.31, 0.12, 0.13, hair, head)
    sph('Tuft', 0.05, 0.0, 1.30, 0.06, 0.04, 0.09, hair, head)

    for side, sx in (('L', -1), ('R', 1)):
        sph(f'Eye{side}', sx * 0.115, -0.272, 0.91, 0.068, 0.035, 0.088, eye, head)
        sph(f'EyeHi{side}', sx * 0.115 - 0.024, -0.302, 0.945, 0.024, 0.012, 0.024, hi, head)
        sph(f'EyeHi2{side}', sx * 0.115 + 0.022, -0.300, 0.875, 0.011, 0.008, 0.011, hi, head)
        sph(f'Blush{side}', sx * 0.205, -0.228, 0.83, 0.05, 0.014, 0.028, blush, head)
        b = box(f'Brow{side}', sx * 0.115 - 0.06, -0.29, 1.005, sx * 0.115 + 0.06, -0.265, 1.03, hair, head, bevel=.01)
        b.rotation_euler.y = sx * 0.12
    sph('Mouth', 0, -0.278, 0.80, 0.024, 0.01, 0.013, mouth, head)
    export('chibi')

    # ---- mũ, nón: cùng hệ toạ độ với nhân vật (Godot gắn vào Head và bù gốc cổ)
    reset()
    R = root('NonLa')
    cyl('Cone', 0, 0, 1.13, 0.52, 0.36, mat('NonLa', '#f3dc9c', rough=.7), R, verts=32, r2=0.01)
    cyl('Rim', 0, 0, 1.12, 0.53, 0.025, mat('NonLaRim', '#d9b96a'), R, verts=32)
    export('hat_nonla')

    reset()
    R = root('Helmet')
    hm = sph('Shell', 0, 0.01, 0.98, 0.37, 0.36, 0.34, mat('Helmet', '#f2b84b', rough=.25), R, seg=32, rings=18)
    bm = bmesh.new()
    bm.from_mesh(hm.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z + 0.98 < 0.97 or (v.co.y + 0.01 < -0.15 and v.co.z + 0.98 < 1.06)], context='VERTS')
    bm.to_mesh(hm.data)
    bm.free()
    export('hat_helmet')

    reset()
    R = root('PoliceCap')
    cyl('Crown', 0, 0.02, 1.13, 0.33, 0.14, mat('CapGreen', '#4d6b3a'), R, verts=28, r2=0.36)
    cyl('Band', 0, 0.02, 1.13, 0.335, 0.05, mat('CapRed', '#c0392b'), R, verts=28)
    box('Visor', -0.2, -0.40, 1.12, 0.2, -0.22, 1.15, mat('Visor', '#1f1f1f'), R, bevel=.012)
    sph('Badge', 0, -0.33, 1.22, 0.05, 0.015, 0.05, mat('Badge', '#f2b84b', emit=.3, metal=.5), R)
    export('hat_police')

    reset()
    R = root('Khan')
    cyl('Band', 0, 0, 1.0, 0.345, 0.075, mat('Khan', '#c0392b'), R, verts=28)
    sph('KnotK', 0, 0.33, 1.04, 0.06, 0.04, 0.05, mat('Khan', '#c0392b'), R)
    export('hat_khan')


# ================================================================= ĐỒ VẬT
def build_props():
    def one(name, fn):
        reset()
        P = palette()
        r = root(name)
        fn(r, P)
        export(name)

    def stool(r, P):
        cyl('Seat', 0, 0, 0.27, 0.16, 0.05, P['red'], r, verts=4, r2=0.15).rotation_euler.z = math.pi / 4
        for dx in (-1, 1):
            for dy in (-1, 1):
                box('Leg', dx * 0.1 - 0.025, dy * 0.1 - 0.025, 0, dx * 0.1 + 0.025, dy * 0.1 + 0.025, 0.28, P['red'], r, bevel=.01)
    one('stool_red', stool)

    def stool_blue(r, P):
        cyl('Seat', 0, 0, 0.27, 0.16, 0.05, P['blue'], r, verts=4, r2=0.15).rotation_euler.z = math.pi / 4
        for dx in (-1, 1):
            for dy in (-1, 1):
                box('Leg', dx * 0.1 - 0.025, dy * 0.1 - 0.025, 0, dx * 0.1 + 0.025, dy * 0.1 + 0.025, 0.28, P['blue'], r, bevel=.01)
    one('stool_blue', stool_blue)

    def table_low(r, P):
        box('Top', -0.45, -0.32, 0.40, 0.45, 0.32, 0.46, P['wood_l'], r, bevel=.02)
        for dx in (-1, 1):
            for dy in (-1, 1):
                box('Leg', dx * 0.38 - 0.03, dy * 0.25 - 0.03, 0, dx * 0.38 + 0.03, dy * 0.25 + 0.03, 0.40, P['wood_d'], r, bevel=.01)
    one('table_low', table_low)

    def bowl(r, P):
        cyl('Bowl', 0, 0, 0, 0.055, 0.075, P['white'], r, verts=20, r2=0.1)
        cyl('Soup', 0, 0, 0.062, 0.09, 0.006, P['broth'], r, verts=20)
        sph('Beef', 0.02, 0.01, 0.07, 0.04, 0.025, 0.008, mat('Beef', '#e7a39a'), r)
        sph('Herb', -0.03, -0.02, 0.07, 0.02, 0.02, 0.01, P['herb'], r)
        box('Chop1', 0.03, -0.12, 0.075, 0.04, 0.12, 0.083, P['wood_l'], r, bevel=0)
    one('bowl', bowl)

    def pot_big(r, P):
        cyl('Stove', 0, 0, 0, 0.36, 0.22, P['dark'], r, verts=24)
        cyl('Fire', 0, 0, 0.18, 0.28, 0.04, mat('Fire', '#ff7a2a', emit=4), r, verts=20)
        cyl('Pot', 0, 0, 0.22, 0.33, 0.48, P['steel'], r, verts=28)
        cyl('Broth', 0, 0, 0.66, 0.30, 0.02, P['broth'], r, verts=28)
        box('Handle', -0.38, -0.03, 0.55, 0.38, 0.03, 0.6, P['dark'], r, bevel=.01)
    one('pot_big', pot_big)

    def counter(r, P):
        box('Body', -1.2, -0.35, 0, 1.2, 0.35, 0.86, P['wood'], r, bevel=.03)
        box('Top', -1.25, -0.4, 0.86, 1.25, 0.4, 0.93, P['stone'], r, bevel=.02)
        for i in range(4):
            box('Panel', -1.1 + i * 0.58, -0.36, 0.12, -0.62 + i * 0.58, -0.35, 0.74, P['wood_d'], r, bevel=0)
    one('counter', counter)

    def lantern(r, P):
        silk = mat('LanternSilk', '#e2412f', emit=2.2, rough=.6)
        cyl('String', 0, 0, 0.36, 0.006, 0.4, P['dark'], r, verts=6)
        sph('Body', 0, 0, 0.18, 0.15, 0.15, 0.17, silk, r, seg=16, rings=10)
        cyl('CapT', 0, 0, 0.32, 0.07, 0.04, P['gold'], r, verts=12)
        cyl('CapB', 0, 0, 0.0, 0.07, 0.04, P['gold'], r, verts=12)
        cyl('Tassel', 0, 0, -0.16, 0.012, 0.16, P['gold'], r, verts=6)
    one('lantern', lantern)

    def motorbike(r, P):
        body = mat('BikeBody', '#e8573c', rough=.3)
        for x in (-0.6, 0.6):
            cyl('Wheel', x, 0, 0.26, 0.26, 0.11, P['dark'], r, verts=20, axis='Y')
            cyl('Hub', x, 0, 0.26, 0.11, 0.12, P['steel'], r, verts=12, axis='Y')
        box('Frame', -0.55, -0.12, 0.30, 0.45, 0.12, 0.58, body, r, bevel=.08)
        box('Seat', -0.55, -0.15, 0.58, 0.15, 0.15, 0.68, mat('Seat', '#3b2a22'), r, bevel=.05)
        box('Front', 0.40, -0.16, 0.30, 0.66, 0.16, 0.95, body, r, bevel=.08)
        box('Bar', 0.52, -0.38, 0.95, 0.60, 0.38, 1.0, P['dark'], r, bevel=.02)
        sph('Light', 0.67, 0, 0.82, 0.04, 0.08, 0.06, mat('Headlight', '#fff6c8', emit=5), r)
        sph('Tail', -0.58, 0, 0.62, 0.03, 0.06, 0.03, mat('Taillight', '#ff3b2a', emit=3), r)
    one('motorbike', motorbike)

    def tree(r, P):
        box('Planter', -0.45, -0.45, 0, 0.45, 0.45, 0.45, P['terracotta'], r, bevel=.04)
        cyl('Soil', 0, 0, 0.42, 0.38, 0.04, mat('Soil', '#5a3a22'), r, verts=4).rotation_euler.z = math.pi / 4
        cyl('Trunk', 0, 0, 0.4, 0.11, 2.2, P['trunk'], r, verts=10, r2=0.07)
        for (x, y, z, s, m) in [(0, 0, 2.7, .9, 'leaf'), (-.6, .2, 2.4, .65, 'leaf'), (.6, -.2, 2.45, .7, 'leaf'),
                                (.2, .55, 2.55, .6, 'leaf2'), (-.3, -.5, 2.6, .6, 'leaf2'), (0, 0, 3.25, .6, 'leaf2')]:
            sph('Blob', x, y, z, s, s, s * .85, P[m], r, seg=14, rings=8)
    one('tree', tree)

    def banyan(r, P):
        cyl('Trunk', 0, 0, 0, 0.55, 3.0, P['trunk'], r, verts=12, r2=0.35)
        for a in range(6):
            ang = a * math.pi / 3
            cyl('Root', math.cos(ang) * 0.6, math.sin(ang) * 0.6, 0, 0.12, 0.6, P['trunk'], r, verts=8, r2=0.05)
        for (x, y, z, s, m) in [(0, 0, 4.0, 2.0, 'leaf'), (-1.7, .5, 3.5, 1.4, 'leaf'), (1.6, -.4, 3.6, 1.5, 'leaf'),
                                (.5, 1.5, 3.8, 1.3, 'leaf2'), (-.6, -1.5, 3.9, 1.3, 'leaf2'), (0, 0, 5.2, 1.3, 'leaf2')]:
            sph('Blob', x, y, z, s, s, s * .8, P[m], r, seg=16, rings=9)
        box('Bench', -1.6, 1.0, 0, -0.2, 1.4, 0.42, P['concrete'], r, bevel=.04)
    one('banyan', banyan)

    def power_pole(r, P):
        cyl('Pole', 0, 0, 0, 0.13, 7.2, P['concrete'], r, verts=10, r2=0.09)
        box('Arm', -0.9, -0.06, 6.6, 0.9, 0.06, 6.72, P['concrete'], r, bevel=.02)
        box('Trafo', -0.32, -0.42, 4.6, 0.32, -0.12, 5.4, mat('Trafo', '#7d8b8a', metal=.3), r, bevel=.04)
        for x in (-0.8, 0, 0.8):
            cyl('Insul', x, 0, 6.72, 0.04, 0.1, P['white'], r, verts=8)
    one('power_pole', power_pole)

    def street_lamp(r, P):
        cyl('Pole', 0, 0, 0, 0.08, 4.6, mat('LampPole', '#3d4652', metal=.4), r, verts=10)
        box('Arm', -0.05, -1.1, 4.45, 0.05, 0, 4.55, mat('LampPole', '#3d4652'), r, bevel=.02)
        sph('Head', 0, -1.15, 4.42, 0.22, 0.3, 0.1, mat('LampPole', '#3d4652'), r)
        sph('Bulb', 0, -1.15, 4.35, 0.15, 0.22, 0.05, mat('LampBulb', '#fff1b8', emit=6), r)
    one('street_lamp', street_lamp)

    def banh_mi_cart(r, P):
        for x in (-0.55, 0.55):
            cyl('Wheel', x, 0.32, 0.18, 0.18, 0.06, P['dark'], r, verts=16, axis='Y')
        box('Body', -0.75, -0.35, 0.18, 0.75, 0.35, 0.95, mat('CartRed', '#d9532f'), r, bevel=.04)
        box('Top', -0.78, -0.38, 0.95, 0.78, 0.38, 1.0, P['steel'], r, bevel=.01)
        box('Case', -0.7, -0.3, 1.0, 0.7, 0.3, 1.45, P['glass'], r, bevel=.01)
        for i in range(5):
            sph('Bread', -0.5 + i * 0.25, 0, 1.08, 0.1, 0.05, 0.05, mat('Bread', '#e0a356'), r)
        cyl('UmbPole', 0.7, 0.3, 1.0, 0.025, 1.4, P['dark'], r, verts=6)
        cyl('Umb', 0.7, 0.3, 2.3, 0.95, 0.3, mat('Umbrella', '#2a9d8f'), r, verts=8, r2=0.03)
    one('banh_mi_cart', banh_mi_cart)

    def fruit_cart(r, P):
        for x in (-0.5, 0.5):
            cyl('Wheel', x, 0.0, 0.2, 0.2, 0.06, P['dark'], r, verts=16, axis='Y')
        box('Bed', -0.7, -0.4, 0.35, 0.7, 0.4, 0.5, P['wood'], r, bevel=.03)
        cols = ['#f2d43b', '#e2412f', '#9ccc55', '#f2a541', '#e85d9a']
        for i in range(5):
            for j in range(3):
                sph('Fruit', -0.55 + i * 0.27, -0.27 + j * 0.27, 0.6, 0.11, 0.11, 0.1, mat(f'Fruit{i}', cols[i]), r, seg=10, rings=6)
        box('Handle', 0.7, -0.35, 0.45, 1.1, 0.35, 0.5, P['wood_d'], r, bevel=.01)
    one('fruit_cart', fruit_cart)

    def bench_stone(r, P):
        box('Seat', -0.8, -0.22, 0.36, 0.8, 0.22, 0.46, P['concrete'], r, bevel=.04)
        for x in (-0.6, 0.6):
            box('Leg', x - 0.08, -0.18, 0, x + 0.08, 0.18, 0.36, P['concrete'], r, bevel=.02)
    one('bench_stone', bench_stone)

    def potter_wheel(r, P):
        cyl('Base', 0, 0, 0, 0.32, 0.42, P['wood_d'], r, verts=16)
        cyl('Plate', 0, 0, 0.42, 0.3, 0.05, P['steel'], r, verts=24)
        cyl('Clay', 0, 0, 0.47, 0.12, 0.25, P['clay'], r, verts=16, r2=0.08)
    one('potter_wheel', potter_wheel)

    def vase(r, P):
        bluew = mat('VaseWhite', '#f4f1ea', rough=.25)
        blue = mat('VaseBlue', '#2d5fa8', rough=.25)
        cyl('Foot', 0, 0, 0, 0.09, 0.04, blue, r, verts=20)
        sph('Belly', 0, 0, 0.2, 0.17, 0.17, 0.18, bluew, r)
        cyl('Band', 0, 0, 0.17, 0.175, 0.05, blue, r, verts=24)
        cyl('Neck', 0, 0, 0.34, 0.06, 0.16, bluew, r, verts=16, r2=0.08)
    one('vase', vase)

    def kiln(r, P):
        brick = mat('Brick', '#a5553a')
        box('Body', -0.8, -0.7, 0, 0.8, 0.7, 1.6, brick, r, bevel=.06)
        sph('Dome', 0, 0, 1.6, 0.8, 0.7, 0.45, brick, r)
        box('Mouth', -0.32, -0.72, 0.15, 0.32, -0.66, 0.7, mat('Ember', '#ff7a2a', emit=4), r, bevel=.02)
        cyl('Chimney', 0.45, 0.35, 1.7, 0.16, 1.2, brick, r, verts=10)
    one('kiln', kiln)

    def shelf(r, P):
        box('Back', -1.0, 0.18, 0, 1.0, 0.24, 2.0, P['wood_d'], r, bevel=.02)
        for z in (0.05, 0.7, 1.35, 1.95):
            box('Board', -1.0, -0.2, z, 1.0, 0.24, z + 0.05, P['wood'], r, bevel=.01)
        for x in (-1.0, 0.95):
            box('Side', x, -0.2, 0, x + 0.05, 0.24, 2.0, P['wood'], r, bevel=.01)
    one('shelf', shelf)

    def round_table(r, P):
        cyl('Top', 0, 0, 0.7, 0.42, 0.05, P['wood_l'], r, verts=24)
        cyl('Stem', 0, 0, 0.05, 0.05, 0.65, P['dark'], r, verts=10)
        cyl('Foot', 0, 0, 0, 0.22, 0.05, P['dark'], r, verts=16)
        cyl('Cup', 0.12, 0, 0.75, 0.05, 0.08, P['white'], r, verts=14)
        cyl('Foam', 0.12, 0, 0.83, 0.045, 0.01, mat('EggFoam', '#f6d27a'), r, verts=14)
    one('round_table', round_table)

    def armchair(r, P):
        fab = mat('Fabric', '#2fae8f')
        box('Seat', -0.3, -0.28, 0.22, 0.3, 0.28, 0.42, fab, r, bevel=.06)
        box('Back', -0.3, 0.18, 0.42, 0.3, 0.3, 0.85, fab, r, bevel=.06)
        for x in (-0.33, 0.27):
            box('ArmRest', x, -0.28, 0.42, x + 0.06, 0.3, 0.58, fab, r, bevel=.03)
        box('Legs', -0.28, -0.26, 0, 0.28, 0.26, 0.22, P['wood_d'], r, bevel=.02)
    one('armchair', armchair)

    def coffee_bar(r, P):
        box('Body', -1.2, -0.35, 0, 1.2, 0.35, 1.0, P['wood_d'], r, bevel=.03)
        box('Top', -1.25, -0.4, 1.0, 1.25, 0.4, 1.06, P['wood_l'], r, bevel=.02)
        box('Machine', -0.9, -0.2, 1.06, -0.3, 0.3, 1.5, P['steel'], r, bevel=.05)
        cyl('Grinder', 0.1, 0.1, 1.06, 0.1, 0.35, P['dark'], r, verts=12)
        for i in range(4):
            cyl('Cup', 0.45 + i * 0.16, -0.1, 1.06, 0.05, 0.09, P['white'], r, verts=12)
    one('coffee_bar', coffee_bar)

    def bookshelf(r, P):
        box('Frame', -0.8, -0.2, 0, 0.8, 0.2, 2.0, P['wood_d'], r, bevel=.02)
        cols = ['#e2412f', '#3f8fd2', '#f2b84b', '#2fae8f', '#9466d6', '#f5f0e6']
        for row in range(4):
            x = -0.72
            i = 0
            while x < 0.68:
                w = 0.07 + (i * 37 % 5) * 0.012
                box('Book', x, -0.21, 0.08 + row * 0.48, x + w, 0.1, 0.42 + row * 0.48 - (i % 3) * 0.04, mat(f'Book{i % 6}', cols[i % 6]), r, bevel=.005)
                x += w + 0.01
                i += 1
    one('bookshelf', bookshelf)

    def bed(r, P):
        box('Frame', -0.8, -1.0, 0, 0.8, 1.0, 0.35, P['wood'], r, bevel=.04)
        box('Mattress', -0.75, -0.95, 0.35, 0.75, 0.95, 0.5, mat('Sheet', '#f6c7d0'), r, bevel=.06)
        box('Pillow', -0.5, 0.55, 0.5, 0.5, 0.85, 0.62, P['white'], r, bevel=.05)
        box('Head', -0.8, 0.95, 0, 0.8, 1.05, 0.9, P['wood'], r, bevel=.03)
    one('bed', bed)

    def altar(r, P):
        lac = mat('Lacquer', '#9b2d20', rough=.3)
        box('Shelf', -0.7, -0.25, 1.3, 0.7, 0.25, 1.4, lac, r, bevel=.02)
        box('Box', -0.4, -0.1, 1.4, 0.4, 0.2, 1.8, lac, r, bevel=.02)
        cyl('Incense', 0, -0.15, 1.4, 0.08, 0.1, P['gold'], r, verts=12)
        for x in (-0.55, 0.55):
            sph('Fruit', x, -0.12, 1.47, 0.07, 0.07, 0.07, mat('Pomelo', '#9ccc55'), r)
            cyl('Candle', x * 0.6, -0.12, 1.4, 0.025, 0.14, mat('Candle', '#ff5a3a', emit=2), r, verts=8)
    one('altar', altar)

    def tv_cabinet(r, P):
        box('Cab', -0.8, -0.25, 0, 0.8, 0.25, 0.5, P['wood'], r, bevel=.03)
        box('TV', -0.55, -0.05, 0.5, 0.55, 0.05, 1.15, P['dark'], r, bevel=.02)
        box('Screen', -0.5, -0.06, 0.55, 0.5, -0.05, 1.1, mat('Screen', '#6fb2e0', emit=1.2), r, bevel=0)
    one('tv_cabinet', tv_cabinet)

    def sofa(r, P):
        fab = mat('SofaFabric', '#7a5ad6')
        box('Seat', -0.9, -0.35, 0.2, 0.9, 0.35, 0.45, fab, r, bevel=.08)
        box('Back', -0.9, 0.2, 0.45, 0.9, 0.38, 0.85, fab, r, bevel=.08)
        for x in (-0.95, 0.85):
            box('Arm', x, -0.35, 0.2, x + 0.1, 0.38, 0.6, fab, r, bevel=.04)
    one('sofa', sofa)

    def fan(r, P):
        cyl('Base', 0, 0, 0, 0.2, 0.05, P['white'], r, verts=16)
        cyl('Pole', 0, 0, 0.05, 0.025, 1.0, P['white'], r, verts=8)
        cyl('Cage', 0, -0.05, 1.15, 0.25, 0.1, mat('FanBlue', '#7fb3d5', alpha=.7), r, verts=20, axis='Y')
        cyl('Motor', 0, 0.08, 1.15, 0.08, 0.14, P['white'], r, verts=12, axis='Y')
    one('fan', fan)

    def plant_pot(r, P):
        cyl('Pot', 0, 0, 0, 0.16, 0.3, P['white'], r, verts=16, r2=0.2)
        for i in range(6):
            a = i * math.pi / 3
            l = sph('Leaf', math.cos(a) * 0.12, math.sin(a) * 0.12, 0.55, 0.07, 0.07, 0.28, P['leaf'], r, seg=10, rings=6)
            l.rotation_euler = (math.sin(a) * 0.5, -math.cos(a) * 0.5, 0)
    one('plant_pot', plant_pot)

    def flag_pole(r, P):
        cyl('Pole', 0, 0, 0, 0.04, 6.0, P['steel'], r, verts=10)
        box('Flag', 0.04, -0.01, 4.8, 1.44, 0.01, 5.75, mat('FlagRed', '#da251d'), r, bevel=0)
        # ngôi sao vàng năm cánh
        bm = bmesh.new()
        pts = []
        for i in range(10):
            a = math.pi / 2 + i * math.pi / 5
            rad = 0.28 if i % 2 == 0 else 0.11
            pts.append(bm.verts.new((0.74 + math.cos(a) * rad, -0.02, 5.27 + math.sin(a) * rad)))
        bm.faces.new(pts)
        me = bpy.data.meshes.new('Star')
        bm.to_mesh(me)
        bm.free()
        star = bpy.data.objects.new('Star', me)
        bpy.context.scene.collection.objects.link(star)
        star.data.materials.append(mat('FlagStar', '#ffcd00', emit=.4))
        star.parent = r
        cyl('Base', 0, 0, 0, 0.3, 0.3, P['concrete'], r, verts=12)
    one('flag_pole', flag_pole)

    def clothes_line(r, P):
        for x in (-1.5, 1.5):
            cyl('Pole', x, 0, 0, 0.03, 2.3, P['steel'], r, verts=6)
        box('Line', -1.5, -0.006, 2.2, 1.5, 0.006, 2.212, P['dark'], r, bevel=0)
        cols = ['#e85d9a', '#3f8fd2', '#f2b84b', '#f5f0e6', '#2fae8f', '#e2412f']
        for i in range(6):
            x = -1.25 + i * 0.5
            h = 0.5 + (i % 3) * 0.12
            box('Cloth', x - 0.18, -0.02, 2.2 - h, x + 0.18, 0.02, 2.2, mat(f'Cloth{i}', cols[i]), r, bevel=.01)
    one('clothes_line', clothes_line)

    def jar_counter(r, P):
        box('Body', -1.2, -0.35, 0, 1.2, 0.35, 0.9, mat('CheCounter', '#f6c7d0'), r, bevel=.04)
        box('Top', -1.25, -0.4, 0.9, 1.25, 0.4, 0.95, P['white'], r, bevel=.02)
        cols = ['#9ccc55', '#e85d9a', '#f2d43b', '#8a5a3a', '#f5f0e6', '#9466d6']
        for i in range(6):
            x = -1.0 + i * 0.4
            cyl('Jar', x, 0, 0.95, 0.15, 0.3, P['glass'], r, verts=16)
            cyl('Che', x, 0, 0.96, 0.13, 0.2, mat(f'Che{i}', cols[i], rough=.3), r, verts=16)
    one('jar_counter', jar_counter)

    def oven(r, P):
        box('Body', -0.7, -0.45, 0, 0.7, 0.45, 1.4, P['steel'], r, bevel=.05)
        box('Window', -0.5, -0.46, 0.5, 0.5, -0.44, 1.1, mat('OvenGlow', '#ff9a3a', emit=3), r, bevel=.01)
    one('oven', oven)

    def ac_unit(r, P):
        box('Body', -0.4, -0.15, 0, 0.4, 0.15, 0.55, P['white'], r, bevel=.03)
        cyl('Grill', 0.05, -0.16, 0.27, 0.19, 0.02, mat('Grill', '#9aa3ad'), r, verts=20, axis='Y')
    one('ac_unit', ac_unit)

    def water_tank(r, P):
        for x in (-0.3, 0.3):
            box('Stand', x - 0.04, -0.3, 0, x + 0.04, 0.3, 0.4, P['steel'], r, bevel=.01)
        cyl('Tank', -0.6, 0, 0.75, 0.38, 1.2, mat('Inox', '#d6dde4', metal=.7, rough=.25), r, verts=20, axis='X')
    one('water_tank', water_tank)

    def market_stall(r, P):
        canvas = mat('Canvas', '#6aa84f')
        box('Table', -1.1, -0.45, 0, 1.1, 0.45, 0.8, P['wood'], r, bevel=.03)
        for dx in (-1, 1):
            for dy in (-1, 1):
                cyl('Pole', dx * 1.05, dy * 0.6, 0, 0.035, 2.3, P['wood_d'], r, verts=8)
        stripes('Roof', -1.3, -0.85, 2.3, 1.3, 0.85, 2.36, 8, canvas, P['cream'], r)
        stripes('Skirt', -1.3, -0.87, 2.05, 1.3, -0.84, 2.36, 8, canvas, P['cream'], r)
        cols = ['#7cc46a', '#e2412f', '#f2a541', '#e98a8a', '#f2d43b']
        for i in range(5):
            for j in range(2):
                sph('Goods', -0.85 + i * 0.42, -0.18 + j * 0.36, 0.88, 0.16, 0.14, 0.09, mat(f'Goods{i}', cols[i]), r, seg=12, rings=7)
    one('market_stall', market_stall)

    def grill(r, P):
        box('Body', -0.9, -0.3, 0, 0.9, 0.3, 0.7, P['dark'], r, bevel=.03)
        box('Coal', -0.85, -0.25, 0.7, 0.85, 0.25, 0.74, mat('Coal', '#ff6a1a', emit=5), r, bevel=0)
        for i in range(7):
            box('Rack', -0.85 + i * 0.27, -0.28, 0.76, -0.8 + i * 0.27, 0.28, 0.78, P['steel'], r, bevel=0)
        for i in range(5):
            box('Meat', -0.7 + i * 0.32, -0.18, 0.78, -0.5 + i * 0.32, 0.18, 0.82, mat('Grilled', '#8a4a22'), r, bevel=.01)
    one('grill', grill)

    def long_table(r, P):
        box('Top', -1.2, -0.4, 0.68, 1.2, 0.4, 0.74, P['wood_l'], r, bevel=.02)
        for x in (-1.05, 1.05):
            box('Leg', x - 0.05, -0.35, 0, x + 0.05, 0.35, 0.68, P['wood_d'], r, bevel=.01)
        for y in (-0.75, 0.75):
            box('Bench', -1.2, y - 0.16, 0.38, 1.2, y + 0.16, 0.44, P['wood'], r, bevel=.02)
            for x in (-1.0, 1.0):
                box('BLeg', x - 0.04, y - 0.12, 0, x + 0.04, y + 0.12, 0.38, P['wood_d'], r, bevel=.01)
    one('long_table', long_table)


# ================================================================= NHÀ CỬA
def arch(name, cx, y, z, r, m, parent, depth=0.1):
    """Nửa đĩa (vòm) đứng, tâm (cx, y, z), mặt phẳng XZ."""
    o = cyl(name, cx, y, z, r, depth, m, parent, verts=28, axis='Y')
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    return o


def facade_window(name, x0, x1, z0, z1, y, P, parent, shutter):
    cx, hw = (x0 + x1) / 2, (x1 - x0) / 2
    # vòm trang trí trên đầu cửa sổ, ô kính hình quạt sáng đèn
    arch(name + 'Arch', cx, y - 0.06, z1 + 0.08, hw + 0.16, mat('ArchTrim', '#fff3dc'), parent, depth=0.12)
    arch(name + 'Fan', cx, y - 0.1, z1 + 0.1, hw - 0.02, mat('WindowGlow', '#ffd88a', emit=.8, rough=.2), parent, depth=0.06)
    # bệ cửa sổ + hộp hoa
    box(name + 'Sill', x0 - 0.15, y - 0.28, z0 - 0.16, x1 + 0.15, y, z0 - 0.06, P['cream'], parent, bevel=.02)
    box(name + 'FBox', x0, y - 0.3, z0 - 0.36, x1, y - 0.06, z0 - 0.16, mat('FlowerBox', '#8a5a3a'), parent, bevel=.02)
    for i in range(int((x1 - x0) / 0.22)):
        sph(name + 'Fl', x0 + 0.12 + i * 0.22, y - 0.2, z0 - 0.08, 0.1, 0.09, 0.08,
            mat(f'Bloom{i % 3}', ['#e85d9a', '#f2d43b', '#e2412f'][i % 3]), parent, seg=8, rings=5)
    box(name + 'Frame', x0 - 0.08, y - 0.06, z0 - 0.08, x1 + 0.08, y + 0.02, z1 + 0.08, P['cream'], parent, bevel=.02)
    box(name + 'Glass', x0, y - 0.07, z0, x1, y - 0.03, z1, mat('WindowGlow', '#ffd88a', emit=.8, rough=.2), parent, bevel=0)
    box(name + 'Mull', (x0 + x1) / 2 - 0.03, y - 0.09, z0, (x0 + x1) / 2 + 0.03, y - 0.05, z1, P['cream'], parent, bevel=0)
    w = (x1 - x0) / 2
    for sx, xx in ((-1, x0 - w * 0.55 - 0.08), (1, x1 + 0.08)):
        box(name + 'Shut', xx, y - 0.08, z0, xx + w * 0.55, y - 0.03, z1, shutter, parent, bevel=.01)


def balcony(name, x0, x1, z, y, P, parent):
    box(name + 'Slab', x0, y - 0.7, z - 0.12, x1, y, z, P['concrete'], parent, bevel=.02)
    rail = mat('Rail', '#2e3a33', metal=.4)
    box(name + 'Top', x0, y - 0.72, z + 0.9, x1, y - 0.66, z + 0.95, rail, parent, bevel=.01)
    n = int((x1 - x0) / 0.18)
    for i in range(n + 1):
        x = x0 + i * (x1 - x0) / n
        box(name + 'Bar', x - 0.015, y - 0.71, z, x + 0.015, y - 0.67, z + 0.9, rail, parent, bevel=0)
    for i, c in enumerate(['#e85d9a', '#f2b84b', '#e2412f']):
        cyl(name + 'Pot', x0 + 0.4 + i * 0.5, y - 0.45, z, 0.12, 0.2, mat('PotBalc', '#b5653a'), parent, verts=10)
        sph(name + 'Flower', x0 + 0.4 + i * 0.5, y - 0.45, z + 0.3, 0.16, 0.16, 0.13, mat(f'Flower{i}', c), parent, seg=10, rings=6)


def build_buildings():
    # ---- nhà ống nhiều tầng (không vào được): rộng w, sâu 9 m, mặt tiền ở y = 0
    def tube_house(name, w, floors, roof_tiles):
        reset()
        P = palette()
        R = root(name)
        fac = mat('Facade', '#f0c96b')
        trim = mat('Trim', '#fff3dc')
        shutter = mat('Shutter', '#2f8f6a')
        fh = 3.2
        d = 9
        top = fh * floors
        box('Shell', 0, 0.0, 0, w, d, top, fac, R, bevel=.04)
        # tầng trệt: cửa cuốn kéo lên một nửa, lộ ánh đèn trong nhà
        box('Shutter', 0.35, -0.05, 1.5, w - 0.35, 0.02, 2.9, mat('RollShutter', '#9aa3ad', metal=.4), R, bevel=.01)
        box('Inside', 0.35, -0.03, 0.0, w - 0.35, 0.02, 1.5, mat('InteriorWarm', '#ffcf7a', emit=1.2), R, bevel=0)
        box('Step', 0, -0.4, 0, w, 0.0, 0.12, P['concrete'], R, bevel=.02)
        granite = mat('Granite', '#8c8077')
        box('Plinth', -0.05, -0.08, 0, w + 0.05, 0.02, 0.35, granite, R, bevel=.03)
        for px in (-0.06, w - 0.3):
            box(f'Pil{px}', px, -0.16, 0.35, px + 0.36, 0.02, top - 0.1, trim, R, bevel=.04)
            box(f'PilCap{px}', px - 0.04, -0.2, top - 0.3, px + 0.4, 0.02, top - 0.1, trim, R, bevel=.03)
        box('Cornice', -0.12, -0.3, top - 0.12, w + 0.12, 0.02, top + 0.06, trim, R, bevel=.04)
        box('Cornice2', -0.06, -0.22, top - 0.3, w + 0.06, 0.02, top - 0.12, trim, R, bevel=.03)
        box('LampBox', 0.42, -0.26, 2.15, 0.62, -0.06, 2.45, mat('WallLamp', '#ffe08a', emit=3), R, bevel=.03)
        for f in range(1, floors):
            z = f * fh
            box(f'Band{f}', -0.03, -0.08, z - 0.15, w + 0.03, 0.02, z + 0.05, trim, R, bevel=.02)
            facade_window(f'W{f}', 0.7, w - 0.7, z + 0.6, z + 2.2, 0, P, R, shutter)
            if f % 2 == 1:
                balcony(f'B{f}', 0.2, w - 0.2, z + 0.05, 0, P, R)
        if roof_tiles:
            tile = mat('RoofTile', '#9a3d2c')
            # mái ngói dốc về phía trước
            bm = bmesh.new()
            v = [bm.verts.new(p) for p in [(-.1, -.4, top), (w + .1, -.4, top), (w + .1, d * .5, top + 1.6), (-.1, d * .5, top + 1.6),
                                            (w + .1, d + .1, top), (-.1, d + .1, top)]]
            bm.faces.new((v[0], v[1], v[2], v[3]))
            bm.faces.new((v[3], v[2], v[4], v[5]))
            bm.faces.new((v[0], v[3], v[5]))
            bm.faces.new((v[1], v[4], v[2]))
            me = bpy.data.meshes.new('Roof')
            bm.to_mesh(me)
            bm.free()
            o = bpy.data.objects.new('Roof', me)
            bpy.context.scene.collection.objects.link(o)
            o.data.materials.append(tile)
            sol = o.modifiers.new('S', 'SOLIDIFY')
            sol.thickness = 0.12
            o.parent = R
            for i in range(int(w / 0.3)):
                box(f'Ridge{i}', -0.1 + i * 0.3, d * .5 - 0.1, top + 1.55, 0.15 + i * 0.3, d * .5 + 0.1, top + 1.72, mat('Ridge', '#7a2e22'), R, bevel=.03)
            # hàng ngói trên mái dốc phía trước
            L = d * .5 + 0.4
            ang = math.atan2(1.6, L)
            n = 9
            for i in range(n):
                t = (i + 0.5) / n
                yy, zz = -0.4 + t * L, top + t * 1.6 + 0.09
                tb = box(f'Tiles{i}', -0.14, yy - 0.07, zz - 0.04, w + 0.14, yy + 0.07, zz + 0.04, mat('TileRow', '#b5482f'), R, bevel=.03)
                tb.rotation_euler.x = ang
        else:
            box('Parapet', -0.05, -0.1, top, w + 0.05, 0.25, top + 0.6, trim, R, bevel=.03)
            box('ParapetS', -0.05, 0, top, 0.2, d, top + 0.6, trim, R, bevel=.02)
            box('ParapetS2', w - 0.2, 0, top, w + 0.05, d, top + 0.6, trim, R, bevel=.02)
        export(name)

    tube_house('house_3f', 4.0, 3, False)
    tube_house('house_4f', 4.5, 4, False)
    tube_house('house_2f_roof', 4.0, 2, True)
    tube_house('house_3f_roof', 3.6, 3, True)

    # ---- quán mở mặt tiền (vào được): w × 8 m. Nhóm 'Upper' (tầng trên) sẽ ẩn khi người chơi ở trong quán
    def open_shop(name, w):
        reset()
        P = palette()
        R = root(name)
        wall = mat('ShopWall', '#f3d27a')
        fac = mat('Facade', '#f0c96b')
        d, fh = 8, 3.2
        box('Floor', 0, 0, -0.06, w, d, 0.02, mat('ShopFloor', '#d99c5a', rough=.6), R, bevel=0)
        box('WallBack', 0, d - 0.2, 0, w, d, fh, wall, R, bevel=.02)
        box('WallL', 0, 0, 0, 0.2, d, fh, wall, R, bevel=.02)
        box('WallR', w - 0.2, 0, 0, w, d, fh, wall, R, bevel=.02)
        box('Wainscot', 0.2, d - 0.24, 0, w - 0.2, d - 0.2, 1.0, mat('Wainscot', '#b9773f'), R, bevel=0)
        box('Pillar1', 0, -0.1, 0, 0.35, 0.25, fh, P['wood_d'], R, bevel=.03)
        box('Pillar2', w - 0.35, -0.1, 0, w, 0.25, fh, P['wood_d'], R, bevel=.03)
        # mái hiên sọc
        aw = mat('Awning', '#c0392b')
        n = int(w / 0.5)
        for i in range(n):
            x0 = i * w / n
            box(f'Awn{i}', x0, -1.2, fh - 0.45, x0 + w / n, 0.1, fh - 0.25, aw if i % 2 == 0 else P['cream'], R, bevel=.01)
            box(f'AwnFlap{i}', x0, -1.25, fh - 0.75, x0 + w / n, -1.18, fh - 0.25, aw if i % 2 == 0 else P['cream'], R, bevel=.01)
        # biển hiệu (Godot ghi chữ lên)
        box('SignBoard', 0.6, -0.2, fh + 0.05, w - 0.6, 0.0, fh + 0.85, mat('Sign', '#c0392b'), R, bevel=.03)
        # tầng trên
        up = root('Upper')
        up.parent = R
        box('UpShell', 0, 0, fh + 0.0, w, d, fh * 2, fac, up, bevel=.04)
        facade_window('UW', 0.9, w - 0.9, fh + 1.1, fh + 2.6, 0, P, up, mat('Shutter', '#2f8f6a'))
        balcony('UB', 0.3, w - 0.3, fh + 0.9, 0, P, up)
        box('UpPar', -0.05, -0.1, fh * 2, w + 0.05, 0.3, fh * 2 + 0.5, mat('Trim', '#fff3dc'), up, bevel=.03)
        for px in (-0.06, w - 0.3):
            box(f'UPil{px}', px, -0.16, fh, px + 0.36, 0.02, fh * 2 - 0.1, mat('Trim', '#fff3dc'), up, bevel=.04)
        box('UCornice', -0.12, -0.3, fh * 2 - 0.15, w + 0.12, 0.02, fh * 2 + 0.05, mat('Trim', '#fff3dc'), up, bevel=.04)
        for lx in (0.5, w - 0.5):
            box(f'Lamp{lx}', lx - 0.1, -0.3, 2.2, lx + 0.1, -0.1, 2.5, mat('WallLamp', '#ffe08a', emit=3), R, bevel=.03)
        export(name)

    open_shop('shop_open_6', 6.0)
    open_shop('shop_open_7', 7.0)

    # ---- phòng cắt ngang (phía gần camera): tường thấp 1 m, chừa cửa ở mặt y = 0
    def cut_room(name, w, d, door_w=1.6):
        reset()
        P = palette()
        R = root(name)
        wall = mat('CutWall', '#f6e3c3')
        cap = mat('WallCap', '#3a2417')
        h = 1.0
        box('Floor', 0, 0, -0.06, w, d, 0.02, mat('RoomFloor', '#c98a4b', rough=.6), R, bevel=0)
        segs = [((0, 0), ((w - door_w) / 2, 0.2)), (((w + door_w) / 2, 0), (w, 0.2)),
                ((0, d - 0.2), (w, d)), ((0, 0), (0.2, d)), ((w - 0.2, 0), (w, d))]
        for i, ((x0, y0), (x1, y1)) in enumerate(segs):
            box(f'Wall{i}', x0, y0, 0, x1, y1, h, wall, R, bevel=.02)
            box(f'Cap{i}', x0 - 0.01, y0 - 0.01, h, x1 + 0.01, y1 + 0.01, h + 0.08, cap, R, bevel=.01)
        export(name)

    cut_room('room_cut_7x8', 7.0, 8.0)
    cut_room('room_cut_55x8', 5.5, 8.0)
    cut_room('room_cut_6x8', 6.0, 8.0)

    # ---- đồn công an phường: 2 tầng, sân trước có hàng rào và cổng
    reset()
    P = palette()
    R = root('PoliceStation')
    yel = mat('PoliceWall', '#f2d27a')
    w, d = 8.0, 9.0
    box('Shell', 0, 2.5, 0, w, d + 2.5, 6.6, yel, R, bevel=.05)
    box('Base', -0.05, 2.45, 0, w + 0.05, d + 2.5, 0.5, mat('Granite', '#8c8077'), R, bevel=.03)
    box('Steps', 2.6, 1.7, 0, 5.4, 2.5, 0.25, P['concrete'], R, bevel=.02)
    box('Door', 3.0, 2.42, 0.5, 5.0, 2.5, 2.9, mat('PoliceDoor', '#5b3a26'), R, bevel=.02)
    box('DoorGlass', 3.2, 2.40, 1.4, 4.8, 2.43, 2.7, mat('WindowGlow', '#ffd88a', emit=.8), R, bevel=0)
    box('Canopy', 2.4, 1.2, 3.0, 5.6, 2.5, 3.2, P['concrete'], R, bevel=.03)
    for x in (2.6, 5.4):
        cyl('Col', x, 1.4, 0, 0.12, 3.0, P['cream'], R, verts=12)
    for x0 in (0.6, 5.9):
        facade_window(f'PW{x0}', x0, x0 + 1.5, 1.0, 2.5, 2.5, P, R, mat('PoliceShutter', '#2f6b8f'))
    for x0 in (0.6, 3.25, 5.9):
        facade_window(f'PU{x0}', x0, x0 + 1.5, 4.1, 5.6, 2.5, P, R, mat('PoliceShutter', '#2f6b8f'))
    box('SignBand', 0.4, 2.3, 6.0, w - 0.4, 2.45, 6.9, mat('PoliceSign', '#c0392b'), R, bevel=.03)
    sph('Emblem', w / 2, 2.25, 7.35, 0.42, 0.06, 0.42, mat('Emblem', '#f2b84b', emit=.3, metal=.4), R)
    box('Roof', -0.1, 2.4, 6.6, w + 0.1, d + 2.6, 6.75, mat('Trim', '#fff3dc'), R, bevel=.03)
    # sân và hàng rào
    box('Yard', 0, 0, -0.04, w, 2.5, 0.03, mat('YardTile', '#d8cfc0'), R, bevel=0)
    fence = mat('Fence', '#3a4a40', metal=.3)
    for x0, x1 in ((0, 2.6), (5.4, w)):
        box('FenceBase', x0, -0.05, 0, x1, 0.15, 0.45, mat('Granite', '#8c8077'), R, bevel=.02)
        n = int((x1 - x0) / 0.2)
        for i in range(n + 1):
            x = x0 + i * (x1 - x0) / n
            box('Bar', x - 0.02, 0.03, 0.45, x + 0.02, 0.07, 1.6, fence, R, bevel=0)
        box('FenceTop', x0, 0.0, 1.55, x1, 0.1, 1.62, fence, R, bevel=.01)
    for x in (2.5, 5.4):
        box('GatePost', x - 0.15, -0.1, 0, x + 0.15, 0.2, 2.1, mat('Granite', '#8c8077'), R, bevel=.03)
        sph('PostLamp', x, 0.05, 2.25, 0.14, 0.14, 0.14, mat('LampBulb', '#fff1b8', emit=5), R)
    # chốt gác
    box('Booth', 6.3, 0.5, 0, 7.5, 1.7, 2.3, mat('BoothWall', '#e9e2d4'), R, bevel=.04)
    box('BoothRoof', 6.2, 0.4, 2.3, 7.6, 1.8, 2.45, mat('PoliceSign', '#c0392b'), R, bevel=.03)
    box('BoothWin', 6.5, 0.47, 1.1, 7.3, 0.5, 1.9, mat('WindowGlow', '#ffd88a', emit=.8), R, bevel=0)
    export('police_station')

    # ---- cổng hẻm
    reset()
    P = palette()
    R = root('AlleyGate')
    for x in (0, 2.3):
        box('Post', x, -0.15, 0, x + 0.25, 0.15, 3.4, mat('GatePost', '#c0392b'), R, bevel=.04)
    box('Beam', -0.1, -0.2, 3.1, 2.65, 0.2, 3.7, mat('GateBeam', '#9b2d20'), R, bevel=.04)
    export('alley_gate')


# ================================================================= ĐỒ VỈA HÈ (phong cách phố Việt hoạt hình)
def build_extras():
    def one(name, fn):
        reset()
        P = palette()
        r = root(name)
        fn(r, P)
        export(name)

    def patio_umbrella(r, P):
        cloth = mat('UmbrellaCloth', '#e2412f')
        cyl('Base', 0, 0, 0, 0.28, 0.08, P['dark'], r, verts=16)
        cyl('Pole', 0, 0, 0.08, 0.035, 2.25, P['steel'], r, verts=8)
        cyl('Canopy', 0, 0, 2.05, 1.35, 0.42, cloth, r, verts=8, r2=0.05)
        cyl('Valance', 0, 0, 1.95, 1.36, 0.12, P['cream'], r, verts=8)
        sph('Tip', 0, 0, 2.5, 0.06, 0.06, 0.06, P['cream'], r)
    one('patio_umbrella', patio_umbrella)

    def aframe_sign(r, P):
        board = mat('SignFace', '#c0392b')
        for sy, ang in ((-1, 0.18), (1, -0.18)):
            b = box('Board', -0.32, -0.02, 0.0, 0.32, 0.02, 0.95, board, r, bevel=.02)
            b.rotation_euler.x = ang
            b.location.y += sy * 0.15
        box('Frame', -0.34, -0.2, 0.92, 0.34, 0.2, 0.98, P['wood_d'], r, bevel=.01)
    one('aframe_sign', aframe_sign)

    def hedge_planter(r, P):
        box('Box', -0.6, -0.25, 0, 0.6, 0.25, 0.45, mat('Planter', '#8a8f96'), r, bevel=.04)
        for i in range(4):
            sph('Bush', -0.45 + i * 0.3, 0, 0.6, 0.24, 0.24, 0.24, P['leaf'] if i % 2 else P['leaf2'], r, seg=12, rings=8)
    one('hedge_planter', hedge_planter)

    def topiary(r, P):
        cyl('Pot', 0, 0, 0, 0.22, 0.4, P['terracotta'], r, verts=14, r2=0.28)
        sph('Ball', 0, 0, 0.95, 0.38, 0.38, 0.55, P['leaf'], r, seg=16, rings=10)
        sph('Ball2', 0, 0, 1.45, 0.25, 0.25, 0.3, P['leaf2'], r, seg=14, rings=8)
    one('topiary', topiary)

    def carton(r, P):
        cb = mat('Cardboard', '#c99a5a')
        box('B1', -0.3, -0.25, 0, 0.3, 0.25, 0.4, cb, r, bevel=.015)
        box('B2', 0.32, -0.2, 0, 0.75, 0.2, 0.32, cb, r, bevel=.015)
        b3 = box('B3', -0.2, -0.2, 0.4, 0.2, 0.2, 0.7, cb, r, bevel=.015)
        b3.rotation_euler.z = 0.3
        box('Tape', -0.3, -0.03, 0.4, 0.3, 0.03, 0.405, mat('Tape', '#e9dcc0'), r, bevel=0)
    one('carton', carton)

    def basin_stack(r, P):
        cols = ['#3f8fd2', '#e85d9a', '#f2d43b', '#2fae8f', '#e2412f']
        for i in range(5):
            cyl(f'Basin{i}', 0, 0, i * 0.08, 0.22, 0.12, mat(f'Basin{i}', cols[i], rough=.4), r, verts=20, r2=0.32)
    one('basin_stack', basin_stack)

    def crate(r, P):
        box('Crate', -0.3, -0.22, 0, 0.3, 0.22, 0.35, P['wood_l'], r, bevel=.02)
        for i in range(4):
            sph('Veg', -0.2 + i * 0.13, 0, 0.38, 0.07, 0.07, 0.06, mat('Cabbage', '#7cc46a'), r, seg=10, rings=6)
    one('crate', crate)

    def loud_pole(r, P):
        cyl('Pole', 0, 0, 0, 0.11, 6.5, P['concrete'], r, verts=10, r2=0.08)
        for sx in (-1, 1):
            h = cyl('Horn', sx * 0.25, 0, 5.9, 0.07, 0.4, mat('Horn', '#d6dde4', metal=.3), r, verts=14, r2=0.2, axis='X')
            h.rotation_euler.z = 0.0 if sx > 0 else math.pi
        box('Cam', -0.12, -0.35, 5.2, 0.12, -0.05, 5.38, P['white'], r, bevel=.03)
        sph('Lens', 0, -0.37, 5.29, 0.04, 0.02, 0.04, P['dark'], r)
    one('loud_pole', loud_pole)

    def bus_stop(r, P):
        cyl('Pole', 0, 0, 0, 0.04, 2.6, P['steel'], r, verts=8)
        box('Sign', -0.35, -0.03, 2.1, 0.35, 0.03, 2.6, mat('BusSign', '#2f7fd2'), r, bevel=.02)
        box('Bench', 0.5, -0.2, 0.4, 2.0, 0.2, 0.46, P['steel'], r, bevel=.02)
        for x in (0.6, 1.9):
            box('BLeg', x - 0.03, -0.15, 0, x + 0.03, 0.15, 0.4, P['dark'], r, bevel=0)
        box('Roof', 0.3, -0.5, 2.3, 2.2, 0.4, 2.36, mat('BusRoof', '#2f7fd2'), r, bevel=.02)
        for x in (0.35, 2.15):
            box('RPole', x - 0.03, 0.3, 0, x + 0.03, 0.36, 2.3, P['steel'], r, bevel=0)
        box('Back', 0.35, 0.33, 0.9, 2.15, 0.36, 2.2, P['glass'], r, bevel=0)
    one('bus_stop', bus_stop)

    def delivery_box(r, P):
        box('Box', -0.25, -0.22, 0, 0.25, 0.22, 0.42, mat('DeliveryRed', '#e2412f', rough=.4), r, bevel=.05)
        box('Lid', -0.26, -0.23, 0.42, 0.26, 0.23, 0.46, mat('DeliveryLid', '#c0392b'), r, bevel=.02)
    one('delivery_box', delivery_box)

    def glass_shopfront(r, P):
        # mặt tiền kính có khung nhôm, dán vào tầng trệt nhà ống (rộng 3 m)
        frame = mat('Alu', '#d6dde4', metal=.4, rough=.3)
        box('Glass', 0.0, -0.02, 0.0, 3.0, 0.02, 2.6, mat('ShopGlass', '#cfe8ef', rough=.05, alpha=.55), r, bevel=0)
        for x in (0.0, 1.5, 2.95):
            box('Mul', x, -0.05, 0.0, x + 0.05, 0.03, 2.6, frame, r, bevel=0)
        box('Top', 0.0, -0.05, 2.55, 3.0, 0.03, 2.6, frame, r, bevel=0)
    one('glass_shopfront', glass_shopfront)


# ================================================================= NHÀ THẤP, CHỢ, CAO ỐC NỀN (cho bản 2.5D)
def build_town():
    def kiosk(name, w=5.0, d=6.0):
        reset()
        P = palette()
        R = root(name)
        wall = mat('ShopWall', '#f3d27a')
        fh = 3.2
        box('Floor', 0, 0, -0.06, w, d, 0.05, mat('ShopFloor', '#d9c3a0'), R, bevel=0)
        box('WallBack', 0, d - 0.2, 0, w, d, fh, wall, R, bevel=.03)
        box('WallL', 0, 0.6, 0, 0.25, d, fh, wall, R, bevel=.03)
        box('WallR', w - 0.25, 0.6, 0, w, d, fh, wall, R, bevel=.03)
        for px in (0.0, w - 0.4):
            box(f'Pillar{px}', px, 0.0, 0, px + 0.4, 0.6, fh, mat('Trim', '#fff3dc'), R, bevel=.05)
        box('Plinth', -0.05, -0.05, 0, w + 0.05, 0.6, 0.25, mat('Granite', '#8c8077'), R, bevel=.03)
        # kệ hàng bên trong, nhìn qua mặt tiền mở
        cols = ['#e2412f', '#3f8fd2', '#f2b84b', '#2fae8f', '#e85d9a', '#f5f0e6']
        box('ShelfBack', 0.4, d - 0.75, 0, w - 0.4, d - 0.25, 2.4, mat('WoodDark', '#7a4a2a'), R, bevel=.02)
        for row in range(3):
            for i in range(int((w - 1.0) / 0.38)):
                box(f'Goods{row}_{i}', 0.55 + i * 0.38, d - 0.85, 0.15 + row * 0.75, 0.85 + i * 0.38, d - 0.5, 0.55 + row * 0.75,
                    mat(f'GoodsC{(i + row) % 6}', cols[(i + row) % 6]), R, bevel=.02)
        box('Counter', 0.6, 1.3, 0, w - 0.6, 1.9, 0.95, mat('Wood', '#b8763f'), R, bevel=.04)
        # mái hiên sọc
        aw = mat('Awning', '#c0392b')
        n = int(w / 0.5)
        for i in range(n):
            x0 = i * w / n
            c = aw if i % 2 == 0 else P['cream']
            box(f'Awn{i}', x0, -1.1, fh - 0.5, x0 + w / n, 0.1, fh - 0.3, c, R, bevel=.01)
            box(f'AwnFlap{i}', x0, -1.15, fh - 0.8, x0 + w / n, -1.08, fh - 0.3, c, R, bevel=.01)
        box('SignBoard', 0.3, -0.25, fh, w - 0.3, 0.05, fh + 0.9, mat('Sign', '#c0392b'), R, bevel=.04)
        # mái ngói bốn mái, chỉ thấy mái trước
        tile = mat('RoofTile', '#b5482f')
        L = d * 0.5
        ang = math.atan2(1.4, L)
        for i in range(8):
            t = (i + 0.5) / 8
            yy, zz = 0.1 + t * L, fh + 0.9 + t * 1.4
            tb = box(f'Tiles{i}', -0.2, yy - 0.25, zz - 0.06, w + 0.2, yy + 0.25, zz + 0.06, tile, R, bevel=.04)
            tb.rotation_euler.x = ang
        box('RoofBack', -0.1, L, fh + 0.9, w + 0.1, d + 0.1, fh + 2.3, tile, R, bevel=.05)
        box('Ridge', -0.2, L - 0.15, fh + 2.25, w + 0.2, L + 0.15, fh + 2.45, mat('Ridge', '#7a2e22'), R, bevel=.06)
        box('WallTop', -0.05, 0.0, fh, w + 0.05, d, fh + 0.9, wall, R, bevel=.03)
        export(name)

    kiosk('kiosk_5', 5.0)
    kiosk('kiosk_6', 6.0)

    # ---- nhà lồng chợ: mặt tiền đầu hồi, ba cửa vòm
    reset()
    P = palette()
    R = root('MarketHall')
    w, d, h = 14.0, 9.0, 5.2
    wall = mat('MarketWall', '#f2d27a')
    trim = mat('Trim', '#fff3dc')
    box('Body', 0, 0, 0, w, d, h, wall, R, bevel=.06)
    box('Plinth', -0.05, -0.05, 0, w + 0.05, d, 0.5, mat('Granite', '#8c8077'), R, bevel=.04)
    for i, cx in enumerate((2.6, 7.0, 11.4)):
        box(f'Door{i}', cx - 1.5, -0.06, 0.0, cx + 1.5, 0.05, 2.9, mat('Shadow', '#4a3426'), R, bevel=.02)
        arch(f'DoorArch{i}', cx, -0.08, 2.9, 1.5, mat('Shadow', '#4a3426'), R, depth=0.12)
        arch(f'DoorTrim{i}', cx, -0.03, 2.9, 1.75, trim, R, depth=0.08)
        for j in range(4):
            box(f'Stall{i}_{j}', cx - 1.3 + j * 0.68, -0.02, 0.0, cx - 0.75 + j * 0.68, 0.0, 0.9,
                mat(f'StallC{j}', ['#7cc46a', '#e2412f', '#f2a541', '#e98a8a'][j]), R, bevel=.02)
    for px in (-0.1, 4.6, 9.0, w - 0.5):
        box(f'Col{px}', px, -0.2, 0.5, px + 0.6, 0.05, h, trim, R, bevel=.05)
    box('Cornice', -0.2, -0.35, h - 0.1, w + 0.2, 0.05, h + 0.25, trim, R, bevel=.05)
    # đầu hồi tam giác + biển tên
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(-0.1, -0.1, h + 0.25), (w + 0.1, -0.1, h + 0.25), (w / 2, -0.1, h + 3.4),
                                    (-0.1, 0.3, h + 0.25), (w + 0.1, 0.3, h + 0.25), (w / 2, 0.3, h + 3.4)]]
    bm.faces.new((v[0], v[1], v[2]))
    bm.faces.new((v[5], v[4], v[3]))
    bm.faces.new((v[0], v[3], v[4], v[1]))
    bm.faces.new((v[1], v[4], v[5], v[2]))
    bm.faces.new((v[2], v[5], v[3], v[0]))
    me = bpy.data.meshes.new('Gable')
    bm.to_mesh(me)
    bm.free()
    g = bpy.data.objects.new('Gable', me)
    bpy.context.scene.collection.objects.link(g)
    g.data.materials.append(wall)
    g.parent = R
    box('SignBoard', w / 2 - 3.2, -0.25, h + 0.6, w / 2 + 3.2, -0.1, h + 1.8, mat('Sign', '#c0392b'), R, bevel=.05)
    roof = mat('RoofTile', '#6f8a86')
    for side in (-1, 1):
        r = box(f'Roof{side}', 0 if side < 0 else w / 2, 0.2, h + 0.2, w / 2 if side < 0 else w, d + 0.3, h + 0.35, roof, R, bevel=.03)
    export('market_hall')

    # ---- cao ốc phía xa (nền)
    def tower(name, w, d, floors, color):
        reset()
        R = root(name)
        body = mat('TowerWall', color)
        glass = mat('TowerGlass', '#9fc7d6', emit=0.0, rough=.15)
        lit = mat('TowerLit', '#ffd88a', emit=1.5)
        fh = 3.3
        box('Body', 0, 0, 0, w, d, floors * fh, body, R, bevel=.08)
        n = int(w / 1.6)
        for f in range(1, floors):
            for i in range(n):
                m = lit if (f * 7 + i * 3) % 5 == 0 else glass
                box(f'W{f}_{i}', 0.4 + i * 1.6, -0.06, f * fh + 0.6, 1.4 + i * 1.6, 0.02, f * fh + 2.4, m, R, bevel=0)
        box('Crown', -0.2, -0.2, floors * fh, w + 0.2, d + 0.2, floors * fh + 0.6, mat('Trim', '#fff3dc'), R, bevel=.05)
        export(name)

    tower('tower_a', 10.0, 10.0, 12, '#c9d6e3')
    tower('tower_b', 8.0, 8.0, 16, '#e6d3b8')
    tower('tower_c', 12.0, 10.0, 9, '#b8d6c8')


# ================================================================= ĐỒ PHỐ KIỂU CŨ (xích lô, ba gác, gạch, thuyền, búi dây)
def build_street_life():
    def one(name, fn):
        reset()
        P = palette()
        r = root(name)
        fn(r, P)
        export(name)

    def cyclo(r, P):
        red = mat('CycloRed', '#9b3b2e')
        dark = P['dark']
        for x, y, rad in ((-0.55, -0.45, 0.32), (-0.55, 0.45, 0.32), (0.95, 0.0, 0.34)):
            cyl('Wheel', x, y, rad, rad, 0.05, dark, r, verts=20, axis='Y')
            cyl('Hub', x, y, rad, 0.06, 0.07, P['steel'], r, verts=8, axis='Y')
        box('SeatBox', -0.85, -0.42, 0.35, -0.1, 0.42, 0.62, red, r, bevel=.06)
        box('Cushion', -0.8, -0.38, 0.62, -0.15, 0.38, 0.7, mat('Cushion', '#c96a4a'), r, bevel=.05)
        box('Back', -0.85, -0.42, 0.62, -0.7, 0.42, 1.15, red, r, bevel=.05)
        hood = cyl('Hood', -0.7, 0, 0.95, 0.42, 0.85, mat('Hood', '#3a3a32'), r, verts=16, axis='Y')
        bm = bmesh.new()
        bm.from_mesh(hood.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < 0 or v.co.x > 0.05], context='VERTS')
        bm.to_mesh(hood.data)
        bm.free()
        box('Frame', -0.1, -0.04, 0.4, 0.95, 0.04, 0.48, dark, r, bevel=.01)
        box('RiderSeat', 0.45, -0.1, 0.85, 0.7, 0.1, 0.92, mat('Seat', '#3b2a22'), r, bevel=.03)
        cyl('Post', 0.6, 0, 0.4, 0.03, 0.5, dark, r, verts=8)
        box('Bar', 0.85, -0.25, 1.0, 0.9, 0.25, 1.04, dark, r, bevel=.01)
    one('cyclo', cyclo)

    def ba_gac(r, P):
        for y in (-0.55, 0.55):
            cyl('Wheel', -0.3, y, 0.3, 0.3, 0.06, P['dark'], r, verts=18, axis='Y')
        box('Bed', -1.1, -0.6, 0.45, 0.8, 0.6, 0.55, P['wood'], r, bevel=.03)
        for y in (-0.6, 0.56):
            box('Rail', -1.1, y, 0.55, 0.8, y + 0.04, 0.75, P['wood_d'], r, bevel=.01)
        box('Handle', 0.8, -0.5, 0.5, 1.6, -0.44, 0.56, P['wood_d'], r, bevel=.01)
        box('Handle2', 0.8, 0.44, 0.5, 1.6, 0.5, 0.56, P['wood_d'], r, bevel=.01)
        sack = mat('Sack', '#e6d6b0')
        for i, (x, y) in enumerate([(-0.75, -0.28), (-0.75, 0.28), (-0.2, -0.28), (-0.2, 0.28), (0.35, 0.0), (-0.48, 0.0)]):
            z = 0.75 if i < 5 else 1.05
            sph('Sack', x, y, z, 0.3, 0.24, 0.17, sack, r, seg=14, rings=8)
        for i in range(3):
            cyl('Jar', 0.25 + i * 0.22, -0.4, 0.55, 0.1, 0.22, mat('JarClay', '#a0522d'), r, verts=12, r2=0.07)
    one('ba_gac', ba_gac)

    def bricks(r, P):
        brick = mat('BrickRed', '#b5553a')
        for layer in range(4):
            for i in range(5 - layer):
                for j in range(3 - (layer > 1)):
                    b = box('Brick', -0.5 + i * 0.23 + layer * 0.1, -0.25 + j * 0.13, layer * 0.08,
                            -0.3 + i * 0.23 + layer * 0.1, -0.13 + j * 0.13, layer * 0.08 + 0.075, brick, r, bevel=.008)
                    b.rotation_euler.z = ((i * 7 + j * 3 + layer) % 5 - 2) * 0.03
    one('bricks', bricks)

    def flower_bike(r, P):
        for x in (-0.55, 0.55):
            ell = cyl('Wheel', x, 0, 0.33, 0.33, 0.04, P['dark'], r, verts=20, axis='Y')
        box('Frame', -0.55, -0.03, 0.4, 0.55, 0.03, 0.46, mat('BikeGreen', '#2f6b4f'), r, bevel=.01)
        box('Rack', -0.85, -0.3, 0.6, -0.2, 0.3, 0.65, P['dark'], r, bevel=.01)
        cols = ['#e85d9a', '#f2d43b', '#e2412f', '#f5f0e6', '#9466d6']
        for i in range(12):
            a = i * 0.52
            sph('Bloom', -0.5 + math.cos(a) * 0.22, math.sin(a) * 0.22, 0.85 + (i % 3) * 0.08, 0.1, 0.1, 0.09,
                mat(f'FB{i % 5}', cols[i % 5]), r, seg=8, rings=5)
        for i in range(6):
            sph('Leaf', -0.5 + math.cos(i) * 0.3, math.sin(i) * 0.3, 0.75, 0.12, 0.07, 0.05, P['leaf'], r, seg=8, rings=5)
    one('flower_bike', flower_bike)

    def boat(r, P):
        hull = mat('Hull', '#6b4a2e')
        bm = bmesh.new()
        L, W, H = 2.6, 0.7, 0.45
        pts = [(-L, 0, H), (-L * 0.6, -W, H), (L * 0.6, -W, H), (L, 0, H), (L * 0.6, W, H), (-L * 0.6, W, H)]
        top = [bm.verts.new(p) for p in pts]
        bot = [bm.verts.new((x * 0.85, y * 0.5, 0)) for (x, y, _) in pts]
        bm.faces.new(list(reversed(bot)))
        for i in range(6):
            bm.faces.new((bot[i], bot[(i + 1) % 6], top[(i + 1) % 6], top[i]))
        me = bpy.data.meshes.new('Hull')
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new('Hull', me)
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.append(hull)
        o.modifiers.new('S', 'SOLIDIFY').thickness = 0.06
        o.parent = r
        box('Deck', -1.4, -0.55, 0.3, 1.4, 0.55, 0.36, P['wood_l'], r, bevel=.02)
        cab = cyl('Cabin', -0.3, 0, 0.36, 0.55, 1.4, mat('Thatch', '#8a7350'), r, verts=14, axis='X')
        bm = bmesh.new()
        bm.from_mesh(cab.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < 0], context='VERTS')
        bm.to_mesh(cab.data)
        bm.free()
        for i in range(4):
            cyl('Basket', 0.9 + (i % 2) * 0.35, -0.2 + (i // 2) * 0.4, 0.36, 0.15, 0.18, mat('Basket', '#c99a5a'), r, verts=12)
    one('boat', boat)

    def wire_pole(r, P):
        cyl('Pole', 0, 0, 0, 0.13, 7.4, mat('Concrete', '#7d7a76'), r, verts=10, r2=0.09)
        box('Arm', -0.9, -0.06, 6.7, 0.9, 0.06, 6.82, mat('Concrete', '#7d7a76'), r, bevel=.02)
        box('Trafo', -0.32, -0.42, 4.7, 0.32, -0.12, 5.5, mat('Trafo', '#6d7b7a', metal=.3), r, bevel=.04)
        wire = mat('Wire', '#1d1612')
        # búi dây điện, dây cáp quấn quanh cột
        for i in range(9):
            t = bpy.ops.mesh.primitive_torus_add(major_radius=0.32 + (i % 3) * 0.08, minor_radius=0.025,
                                                 location=((i % 3 - 1) * 0.05, 0, 5.6 + i * 0.09))
            o = bpy.context.active_object
            o.rotation_euler = ((i % 4 - 1.5) * 0.25, (i % 3 - 1) * 0.3, i * 0.4)
            _finish(o, 'Coil', wire, r)
        for k in range(6):
            c = cyl('Drop', -0.25 + k * 0.1, -0.15, 3.2 + k * 0.25, 0.012, 2.6 - k * 0.2, wire, r, verts=6)
            c.rotation_euler.y = (k - 2.5) * 0.04
        box('Meter', 0.14, -0.2, 3.0, 0.4, -0.02, 3.45, mat('MeterBox', '#d6d0c0'), r, bevel=.02)
        box('Meter2', -0.4, -0.2, 3.1, -0.15, -0.02, 3.5, mat('MeterBox', '#d6d0c0'), r, bevel=.02)
    one('wire_pole', wire_pole)

    def sidewalk_kitchen(r, P):
        box('Table', -0.6, -0.35, 0, 0.6, 0.35, 0.75, P['steel'], r, bevel=.02)
        cyl('Stove', 0.75, 0, 0, 0.22, 0.35, mat('ClayStove', '#8a4a2a'), r, verts=14)
        cyl('Coal', 0.75, 0, 0.33, 0.17, 0.03, mat('Coal', '#ff6a1a', emit=5), r, verts=14)
        cyl('Pot', 0.75, 0, 0.36, 0.2, 0.25, P['steel'], r, verts=16)
        for i in range(4):
            cyl('Bowl', -0.4 + i * 0.25, 0, 0.75, 0.05, 0.06, P['white'], r, verts=12, r2=0.09)
        box('Tray', -0.55, -0.3, 0.75, -0.1, -0.05, 0.8, mat('TrayGreen', '#6aa84f'), r, bevel=.01)
    one('sidewalk_kitchen', sidewalk_kitchen)


if __name__ != '__main__':
    pass
elif '--only=town' in sys.argv:
    build_town()
elif '--only=life' in sys.argv:
    build_street_life()
elif '--only=extras' in sys.argv:
    build_extras()
else:
    build_chibi()
    build_props()
    build_buildings()
    build_extras()
    build_town()
    build_street_life()
print('XONG')
