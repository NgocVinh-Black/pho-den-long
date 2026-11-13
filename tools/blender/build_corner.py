"""Dựng một góc phố hoàn chỉnh rồi render thành tranh nền (kiểu Nobody: nền vẽ sẵn, nhân vật 3D đi trên).

Chạy:  blender -b -P tools/blender/build_corner.py -- godot/assets/models godot/assets/scenes/corner

Kết quả trong thư mục ra:
- plate_day.png, plate_night.png : tranh nền (nét mực, vết ố, màu trầm ấm)
- proxy.glb                      : khối hình của cả cảnh (Godot dùng để che nhân vật đúng chỗ)
- scene.json                     : camera, chỗ ngồi, khu đi bộ, làn xe, chân nhà (chặn đường)

Toạ độ Blender: phố dọc chạy theo +Y (xa dần khỏi camera), phố ngang theo X ở y ≈ 25.
"""
import bpy
import json
import math
import os
import sys
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_sprites as rs  # noqa: E402  (dùng lại vật liệu, biển hiệu, vết ố, hậu kỳ)

# --export3d: không render tranh, xuất cả cảnh 3D có màu (scene_full.glb) cho chế độ góc nhìn thứ ba.
# Vết ố dựng bằng nút thủ tục nên không xuất được sang glTF: bỏ qua ở chế độ này.
EXPORT3D = '--export3d' in sys.argv
if EXPORT3D:
    rs.weather = lambda objs: None

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[1] if len(argv) > 1 else 'godot/assets/scenes/corner')
os.makedirs(OUT, exist_ok=True)
RES = (1920, 1080)
SAMPLES = 40

AW = 4.5          # nửa bề rộng phố dọc (x ∈ [-4.5, 4.5])
WALK = 3.5        # vỉa hè (rộng cho bàn ghế quán)
BY0, BY1 = 12.0, 18.0   # phố ngang (y)
FAR = BY1 + WALK  # mép trước dãy nhà bên kia ngã tư
LX = -AW - WALK   # mép trước dãy nhà phía tây phố dọc

solids = []
seats = []
people = []
shops = []   # cửa từng quán: tên, mô hình, điểm đứng trước cửa (toạ độ Blender), hướng mặt tiền


# ---------------------------------------------------------------- tiện ích
def group(objs, loc, rot_deg):
    """Gom các vật vừa tạo (toạ độ cục bộ, mặt tiền quay -Y) rồi xoay/dời cả nhóm."""
    e = bpy.data.objects.new('Group', None)
    bpy.context.scene.collection.objects.link(e)
    for o in objs:
        if o.parent is None:
            o.parent = e
    e.location = loc
    e.rotation_euler = (0, 0, math.radians(rot_deg))
    bpy.context.view_layer.update()
    return e


def to_world(e, x, y):
    p = e.matrix_world @ Vector((x, y, 0))
    return p.x, p.y


def footprint(objs):
    ground = [o for o in objs if o.type == 'MESH' and rs.world_bbox([o])[0].z < 0.3 and not o.name.startswith('Lantern')]
    lo, hi = rs.world_bbox(ground or objs)
    return [lo.x, lo.y, hi.x, hi.y]


ROOF = {'shop_open_6': 6.9, 'shop_open_7': 6.9, 'house_3f': 10.2, 'house_4f': 13.4}


def building(glb, loc, rot, title, sub=None, neon=False, colors=None, kind='house', props=(), lanterns=(), sign_col='#c0392b',
             glass=True, staff=()):
    """Một căn nhà/quán: mô hình + biển hiệu + đồ bên trong + đồ trên mái, rồi đặt vào phố."""
    colors = dict(colors or {})
    objs = rs.import_glb(glb, colors=colors)
    lo, hi = rs.world_bbox(objs)
    w = hi.x - lo.x
    if glb in ROOF:
        ww = {'shop_open_6': 6.0, 'shop_open_7': 7.0}.get(glb, w)
        for (g, x, y) in (('water_tank', ww * 0.3, 5.5), ('plant_pot', ww * 0.75, 1.0), ('plant_pot', ww * 0.85, 1.6),
                          ('clothes_line', ww * 0.55, 3.2)):
            objs += rs.import_glb(g, x, y, 0, ROOF[glb] - 0.5)
    for (g, x, y, r, z, cols) in props:
        objs += rs.import_glb(g, x, y, r, z, cols)
    if kind == 'house':
        objs += rs.panel(0.15, w - 0.15, -0.38, 1.85, 2.62, sign_col, title, sub, neon)
        if glass:
            objs += rs.import_glb('glass_shopfront', (w - 3.0) / 2, -0.05)
    elif kind == 'shop':
        objs += rs.panel(0.4, w - 0.4, -1.34, 2.25, 3.05, sign_col, title, sub, neon)
    elif kind == 'plain':
        pass
    else:
        sb = next(o for o in objs if o.name.split('.')[0] == 'SignBoard')
        slo, shi = rs.world_bbox([sb])
        objs += rs.panel(slo.x, shi.x, slo.y - 0.02, slo.z, shi.z, sign_col, title, sub, neon)
    for (lx, col) in lanterns:
        objs += rs.import_glb('lantern', lx, -0.9, 0, 1.75, {'LanternSilk': col})
    rs.weather(objs)
    e = group(objs, loc, rot)
    solids.append(footprint(objs))
    if title:
        # đứng trước mặt tiền, ngoài mái hiên (quán mở) hoặc sát bậc cửa (nhà ống)
        dx, dy = to_world(e, w / 2, -1.9 if kind in ('shop', 'kiosk') else -1.2)
        shops.append(dict(title=title, sub=sub or '', glb=glb, kind=kind, door=[dx, dy], rot=rot))
    for (x, y, face, sit, role) in staff:
        wx, wy = to_world(e, x, y)
        people.append([wx, wy, face + rot, sit, role])
    return e, w


def eat_set(x, y, rot=0.0, stool='stool_red', diners=3):
    objs = rs.import_glb('table_low')
    offs = [(-0.22, 0.62, 0), (0.22, -0.62, 180), (-0.75, 0, 90), (0.75, 0, -90)]
    for (sx, sy, _) in offs:
        objs += rs.import_glb(stool, sx, sy)
    objs += rs.import_glb('bowl', -0.2, 0, 0, 0.46) + rs.import_glb('bowl', 0.2, 0, 60, 0.46)
    rs.weather(objs)
    e = group(objs, (x, y, 0), rot)
    for i, (sx, sy, face) in enumerate(offs[:diners]):
        wx, wy = to_world(e, sx, sy)
        seats.append([wx, wy, face + rot, 0.32])


def prop(glb, x, y, rot=0.0, z=0.0, colors=None, solid=True):
    objs = rs.import_glb(glb, x, y, rot, z, colors)
    rs.weather(objs)
    if solid:
        solids.append(footprint(objs))
    return objs


def mat_tex(name, kind, color, color2, scale):
    """Vật liệu mặt đất có hoa văn (gạch lát hoặc nhựa đường loang)."""
    m = bpy.data.materials.new(name)
    p = rs.principled(m)
    N, L = m.node_tree.nodes, m.node_tree.links
    tc = N.new('ShaderNodeTexCoord')
    if kind == 'brick':
        t = N.new('ShaderNodeTexBrick')
        t.inputs['Scale'].default_value = scale
        t.inputs['Color1'].default_value = (*rs.hexlin(color), 1)
        t.inputs['Color2'].default_value = (*rs.hexlin(color2), 1)
        t.inputs['Mortar'].default_value = (*rs.hexlin('#5d574e'), 1)
        t.inputs['Mortar Size'].default_value = 0.015
        t.offset = 0.5
        L.new(tc.outputs['Object'], t.inputs['Vector'])
        L.new(t.outputs['Color'], p.inputs['Base Color'])
    else:
        n = N.new('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = 10
        L.new(tc.outputs['Object'], n.inputs['Vector'])
        r = N.new('ShaderNodeValToRGB')
        r.color_ramp.elements[0].color = (*rs.hexlin(color2), 1)
        r.color_ramp.elements[1].color = (*rs.hexlin(color), 1)
        r.color_ramp.elements[0].position = 0.35
        r.color_ramp.elements[1].position = 0.6
        L.new(n.outputs['Fac'], r.inputs['Fac'])
        L.new(r.outputs['Color'], p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = 0.9
    return m


def plane(name, x0, y0, x1, y1, z, m):
    bpy.ops.mesh.primitive_plane_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, z))
    o = bpy.context.active_object
    o.name = name
    o.scale = (x1 - x0, y1 - y0, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(m)
    return o


def cube(name, x0, y0, z0, x1, y1, z1, m):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.active_object
    o.name = name
    o.scale = (x1 - x0, y1 - y0, z1 - z0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(m)
    return o


def wire(p0, p1, sag, r=0.014, m=None):
    cu = bpy.data.curves.new('Wire', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    sp = cu.splines.new('POLY')
    n = 16
    sp.points.add(n)
    for i in range(n + 1):
        t = i / n
        p = Vector(p0).lerp(Vector(p1), t)
        p.z -= sag * 4 * t * (1 - t)
        sp.points[i].co = (p.x, p.y, p.z, 1)
    o = bpy.data.objects.new('Wire', cu)
    bpy.data.collections['NoLine'].objects.link(o)  # dây mảnh, không viền mực
    o.data.materials.append(m or rs.flat('WireInk', '#1d1612'))
    return o


LANT = ['#e2412f', '#f2b84b', '#e85d9a', '#e2412f', '#2fae8f', '#ff8a3a', '#9466d6']


def lantern_line(p0, p1, sag, n):
    wire(p0, p1, sag, 0.012)
    for i in range(n):
        t = (i + 1) / (n + 1)
        p = Vector(p0).lerp(Vector(p1), t)
        p.z -= sag * 4 * t * (1 - t)
        rs.import_glb('lantern', p.x, p.y, 0, p.z - 0.76, {'LanternSilk': LANT[i % len(LANT)]})


# ================================================================ dựng cảnh
sc = rs.new_scene()
sc.render.film_transparent = False
for o in list(sc.objects):
    if o.name == 'ShadowCatcher':
        bpy.data.objects.remove(o, do_unlink=True)
sc.cycles.samples = SAMPLES
sc.render.resolution_x, sc.render.resolution_y = RES

# ---- mặt đất: vỉa hè lát gạch, đường nhựa, bó vỉa, vạch kẻ, vạch qua đường
walk_m = mat_tex('Sidewalk', 'brick', '#9a948a', '#8a847a', 3.0)
asphalt = mat_tex('Asphalt', 'noise', '#5f5f60', '#4e4e50', 1.2)
curb_m = rs.flat('Curb', '#b9b2a6')
paint = rs.flat('Paint', '#ddd6c2')
plane('Ground', -25.0, -40, 70, 90, 0.0, walk_m)
plane('RoadA', -AW, -30, AW, 90, 0.01, asphalt)
plane('RoadB', -25.0, BY0, 70, BY1, 0.012, asphalt)
for x in (-AW, AW):
    cube('CurbA', x - 0.1, -30, 0, x + 0.1, BY0, 0.12, curb_m)
    cube('CurbA2', x - 0.1, BY1, 0, x + 0.1, 90, 0.12, curb_m)
for y in (BY0, BY1):
    cube('CurbB', -25.0, y - 0.1, 0, -AW, y + 0.1, 0.12, curb_m)
    cube('CurbB2', AW, y - 0.1, 0, 70, y + 0.1, 0.12, curb_m)
for y in range(-28, 88, 3):
    if not (BY0 - 1 < y < BY1 + 1):
        cube('Dash', -0.08, y, 0.012, 0.08, y + 1.4, 0.016, paint)
for x in range(-24, 68, 3):
    if not (-AW - 1 < x < AW + 1):
        cube('DashB', x, (BY0 + BY1) / 2 - 0.08, 0.013, x + 1.4, (BY0 + BY1) / 2 + 0.08, 0.017, paint)
for i in range(7):  # vạch qua đường ở đầu ngã tư
    x = -3.3 + i * 1.1
    cube('Zebra', x, BY0 - 2.6, 0.013, x + 0.55, BY0 - 0.4, 0.017, paint)

# ---- sông phía tây xa (góc trên trái khung hình) + bờ kè + thuyền
RIVER_X = -25.0
water = bpy.data.materials.new('River')
pw = rs.principled(water)
pw.inputs['Base Color'].default_value = (*rs.hexlin('#4f8a8b'), 1)
pw.inputs['Roughness'].default_value = 0.12
plane('River', -90, -40, RIVER_X, 90, -0.6, water)
cube('Embank', RIVER_X, -40, -0.7, RIVER_X + 0.4, 90, 0.15, rs.flat('Embank', '#8c8077'))
for (bx, by, r) in ((-32, 30, 80), (-40, 44, 100), (-30, 52, 70), (-38, 18, 95)):
    rs.import_glb('boat', bx, by, r, -0.55)
solids.append([-90, -40, RIVER_X + 0.4, 90])
cube('Deck', RIVER_X - 0.2, 24.0, 0, RIVER_X + 5.5, 30.0, 0.35, rs.flat('DeckWood', '#8a6442'))
eat_set(RIVER_X + 2.0, 26.0, 0, 'stool_blue', 3)
eat_set(RIVER_X + 4.0, 28.2, 20, 'stool_blue', 2)


def row(items, start, axis, rot, front, sign=1):
    """Xếp một dãy nhà. axis='y': dãy chạy dọc trục y (mặt tiền ở x = front); 'x': chạy dọc trục x."""
    pos = start
    for it in items:
        glb, title, sub, neon, kind, sc_col, cols, w = it[:8]
        props_ = it[8] if len(it) > 8 else []
        lant = it[9] if len(it) > 9 else []
        staff = it[10] if len(it) > 10 else []
        cols = {k: rs.faded(v, 0.05) for k, v in cols.items()}
        if 'Facade' in cols:
            cols.update(Trim=rs.darker(cols['Facade'], 0.86), ArchTrim=rs.darker(cols['Facade'], 0.9), Shutter='#4f7a62')
        if axis == 'y':
            loc = (front, pos, 0) if rot == 90 else (front, pos + w, 0)
        else:
            loc = (pos, front, 0) if sign > 0 else (pos - w, front, 0)
        building(glb, loc, rot, title, sub, neon, cols, kind, props_, lant, sc_col, staff=staff)
        pos += w * sign


LANT3 = [(1.5, '#e2412f'), (3.5, '#f2b84b'), (5.5, '#e2412f')]

# ---- dãy tây phố dọc (nửa gần): mặt tiền quay +X về phía camera
row([
    ('shop_open_7', 'QUÁN BIA HƠI', 'Một thế giới mới', False, 'shop', '#2d6a8f',
     {'Awning': '#556b78', 'Facade': '#d8b87a', 'ShopWall': '#e6cfa0', 'ShopFloor': '#9a7b5a'}, 7.0,
     [('long_table', 3.5, 2.6, 0, 0, {}), ('long_table', 3.5, 5.0, 0, 0, {}), ('counter', 3.5, 7.0, 0, 0, {})], LANT3,
     [(3.5, 7.6, 0, -1, 'seller')] + [(2.7 + i * 0.8, ty + sd * 0.75, 0 if sd > 0 else 180, 0.44, '') for ty in (2.6, 5.0) for i in range(3) for sd in (1, -1)]),
    ('shop_open_6', 'BÚN ĐẬU MẮM TÔM', '& Bún chả', False, 'shop', '#9b2d20',
     {'Awning': '#7f8d91', 'Facade': '#c9a77a', 'ShopWall': '#e9d6b0'}, 6.0,
     [('table_low', 1.6, 2.8, 0, 0, {}), ('table_low', 4.3, 3.2, 0, 0, {}), ('counter', 3.0, 6.9, 0, 0, {})],
     [(1.5, '#f2b84b'), (4.5, '#e2412f')], [(3.0, 7.5, 0, -1, 'cook'), (1.4, 3.4, 0, 0.32, ''), (4.5, 2.6, 180, 0.32, '')]),
    ('house_2f_roof', 'PHỞ GÁNH', 'Đầu ngõ · Phở bò tái', False, 'house', '#c0392b', {'Facade': '#cdbb8e'}, 4.0),
    ('house_3f_roof', 'HỚT TÓC NAM', None, True, 'house', '#ff4fa3', {'Facade': '#b7c4b0'}, 3.6),
    ('house_2f_roof', 'TẠP HÓA', 'Bia · Gạo · Nước ngọt', False, 'house', '#2f6fa8', {'Facade': '#d9b8a0'}, 4.0),
], -16.0, 'y', 90, LX)

# ---- dãy tây phố dọc (nửa xa, sau ngã tư)
row([
    ('house_3f_roof', 'NHÀ NGHỈ', None, True, 'house', '#ffd84f', {'Facade': '#c8b8d0'}, 3.6),
    ('house_2f_roof', 'BÁNH MÌ', 'Pate · Chả lụa', False, 'house', '#c0392b', {'Facade': '#e6cfa0'}, 4.0),
    ('house_3f', 'SỬA XE', None, False, 'house', '#2f6fa8', {'Facade': '#cbb59a'}, 4.0),
    ('house_2f_roof', 'GẠO NGON', None, False, 'house', '#6aa84f', {'Facade': '#bfcfc0'}, 4.0),
], FAR + 7.2, 'y', 90, LX)

# ---- nhà góc tây bắc ngã tư: quán cà phê quay về camera
row([
    ('shop_open_7', 'HIỆU CAFE ĐƯỜNG PHỐ', 'Cà phê trứng · Kem', False, 'shop', '#6b3a1a',
     {'Awning': '#4f6b5a', 'Facade': '#d9c49a', 'ShopWall': '#efe0c0', 'ShopFloor': '#8a5a3a'}, 7.0,
     [('round_table', 2.0, 2.5, 0, 0, {}), ('round_table', 5.0, 2.5, 0, 0, {}), ('coffee_bar', 3.5, 7.0, 0, 0, {})],
     [(1.5, '#f2b84b'), (3.5, '#e2412f'), (5.5, '#f2b84b')], [(3.5, 7.6, 0, -1, 'seller'), (1.2, 2.5, 90, 0.42, ''), (5.8, 2.5, -90, 0.42, '')]),
    ('house_2f_roof', 'ĂN VẶT HÈ', None, False, 'house', '#c0392b', {'Facade': '#e3c68f'}, 4.0),
    ('house_3f_roof', 'HOA TƯƠI', None, False, 'house', '#e85d9a', {'Facade': '#e0c0c8'}, 3.6),
], LX, 'x', 0, FAR, -1)

# ---- dãy bắc phố ngang, phía đông phố dọc: quay về camera
row([
    ('kiosk_6', 'TIỆM ĂN ĐÊM', 'Phở trộn & Miến lươn', False, 'kiosk', '#2f8f5a',
     {'Awning': '#6f7f86', 'Cream': '#9aa7ab', 'ShopWall': '#d6e0d0'}, 6.0, [], [], [(3.0, 2.2, 0, -1, 'cook')]),
    ('house_3f', 'HIỆU THUỐC ĐÔNG Y', 'Nam dược', False, 'house', '#2f6b3a', {'Facade': '#d6d0b8'}, 4.0),
    ('house_2f_roof', 'TRÀ ĐÁ & ĂN VẶT VỈA HÈ', None, False, 'house', '#7a4a1a', {'Facade': '#e0c98a'}, 4.0),
    ('house_3f_roof', 'TIỆM SỬA CHỮA ĐIỆN THOẠI', None, True, 'house', '#4fd8ff', {'Facade': '#c9c2b0'}, 3.6),
    ('shop_open_6', 'CHÈ BA MIỀN', 'Chè · Sinh tố', False, 'shop', '#b83b78',
     {'Awning': '#b8607f', 'Facade': '#e6c6c6', 'ShopWall': '#fff3dc', 'ShopFloor': '#d8b8b8'}, 6.0,
     [('jar_counter', 3.0, 6.9, 0, 0, {}), ('table_low', 1.5, 2.9, 0, 0, {}), ('table_low', 4.3, 3.6, 0, 0, {})], [(1.0, '#e85d9a'), (5.0, '#f2b84b')],
     [(3.0, 7.55, 0, -1, 'seller'), (1.28, 3.52, 0, 0.32, ''), (4.52, 2.98, 180, 0.32, '')]),
    ('house_2f_roof', 'TẠP HÓA ÚT HIỀN', None, False, 'house', '#c0392b', {'Facade': '#d8c0a0'}, 4.0),
], AW + WALK, 'x', 0, FAR, 1)

# ---- nhà phía sau và dọc phố xa (lấp nền, chủ yếu thấy mái và tầng trên)
BACK = [('house_4f', '#d9b98a', 4.5), ('house_3f_roof', '#c9b6a4', 3.6), ('house_3f', '#e0c9a0', 4.0), ('house_2f_roof', '#d6c0b0', 4.0),
        ('house_4f', '#c8c0a8', 4.5), ('house_3f', '#e6cfa0', 4.0)]
x = AW + WALK
k = 0
while x < 46:
    g, c, w = BACK[k % len(BACK)]
    building(g, (x, FAR + 9.5, 0), 0, '', None, False, {'Facade': c}, 'plain', [], [], '#000000', glass=False)
    x += w
    k += 1
x = LX
while x > -24:
    g, c, w = BACK[(k + 3) % len(BACK)]
    building(g, (x - w, FAR + 9.5, 0), 0, '', None, False, {'Facade': c}, 'plain', [], [], '#000000', glass=False)
    x -= w
    k += 1
y = FAR + 0.5
while y < 50:
    g, c, w = BACK[k % len(BACK)]
    building(g, (AW + WALK, y + w, 0), -90, '', None, False, {'Facade': c}, 'plain', [], [], '#000000', glass=False)
    y += w
    k += 1
for (tx, ty) in ((-14, 62), (4, 70), (22, 64), (40, 58)):
    rs.import_glb('tower_' + 'abc'[int(abs(tx)) % 3], tx, ty)

# ---- đồ phố
poles = [(LX + 0.7, -10.0), (LX + 0.7, -1.0), (LX + 0.7, 8.0), (AW + 0.7, -6.0), (AW + 0.7, 6.0),
         (LX + 0.7, FAR - 0.7), (AW + 0.7, FAR - 0.7), (14.0, FAR - 0.7), (-14.0, FAR - 0.7), (LX + 0.7, FAR + 9.0)]
for (px, py) in poles:
    prop('wire_pole', px, py)
ink = rs.flat('WireInk', '#1d1612')
for i, (ax, ay) in enumerate(poles):
    for j, (bx, by) in enumerate(poles):
        if j <= i or Vector((ax - bx, ay - by)).length > 14:
            continue
        for k in range(2):
            wire((ax, ay, 6.4 + k * 0.2), (bx, by, 6.3 + k * 0.25), 0.5 + k * 0.25, 0.01, ink)
for py in (-13.0, -7.0, -3.0, 2.5, 6.5):
    wire((LX + 0.7, -10.0 if py < -5 else (-1.0 if py < 4 else 8.0), 5.8), (LX - 0.1, py, 5.0), 0.3, 0.008, ink)
for (y0, y1) in ((-9.0, -7.5), (-3.0, -2.0), (3.0, 4.0)):
    lantern_line((LX + 0.5, y0, 5.6), (AW + 0.5, y1, 5.4), 0.7, 7)
lantern_line((LX + 0.7, FAR - 0.7, 5.5), (AW + 0.7, FAR - 0.7, 5.5), 0.5, 6)
lantern_line((AW + 0.7, FAR - 0.7, 5.4), (14.0, FAR - 0.7, 5.4), 0.5, 7)

# bàn ghế bia hơi tràn vỉa hè
for (ex, ey, r) in ((LX + 1.6, -14.5, 80), (LX + 1.7, -11.6, 95), (LX + 1.6, -8.6, 85), (LX + 1.8, -5.0, 90), (LX + 1.6, -1.8, 92)):
    eat_set(ex, ey, r, 'stool_red', 4)
prop('basin_stack', LX + 0.6, 2.2)
prop('crate', LX + 0.6, 3.1)
prop('aframe_sign', LX + 1.2, 5.6, 80, 0, {'SignFace': '#9b2d20'})
prop('plant_pot', LX + 0.5, 7.0)
# vỉa hè bắc phố ngang: bếp ăn đêm, xe bánh mì, dù, ghế
prop('sidewalk_kitchen', 10.5, BY1 + 1.4)
people.append([10.5 + 0.75, BY1 + 1.4 + 0.55, 180, 0.2, 'cook'])
eat_set(13.6, BY1 + 1.6, 0, 'stool_blue', 3)
prop('banh_mi_cart', 6.6, BY1 + 1.2)
people.append([6.6, BY1 + 1.9, 0, -1, 'seller'])
prop('patio_umbrella', 17.0, BY1 + 1.8, 0, 0, {'UmbrellaCloth': '#c96a4a'})
eat_set(-11.0, BY1 + 1.5, 0, 'stool_red', 3)
prop('fruit_cart', 24.0, BY1 + 1.3)
# góc gần camera (đông nam): xích lô, đống gạch, ba gác, xe hoa
prop('cyclo', 7.5, 1.5, 200)
prop('bricks', 9.5, -5.0, 10)
prop('ba_gac', 7.0, 7.5, 160)
prop('flower_bike', -2.6, 4.5, 95, solid=False)
prop('carton', 6.0, -2.0)
prop('hedge_planter', 12.0, 9.5)
# chợ vỉa hè ở góc gần camera
for i, (sx, sy, col) in enumerate(((9.0, 4.0, '#6aa84f'), (12.5, 4.2, '#c0392b'), (9.2, 0.2, '#3f8fd2'), (12.7, 0.0, '#c99a4b'))):
    prop('market_stall', sx, sy, 0, 0, {'Canvas': col})
    people.append([sx, sy + 0.8, 180, -1, 'seller'])
for (bx, by) in ((6.3, 2.0), (6.6, 9.8), (14.8, 2.0), (11.0, -2.0)):
    prop('basin_stack', bx, by)
    prop('crate', bx + 0.7, by + 0.2)
prop('fruit_cart', 15.0, 7.5, 30)
# mái tôn nhà kho sát mép dưới khung hình
cube('Shed', 6.0, -24.0, 0, 26.0, -6.0, 3.0, rs.flat('ShedWall', '#b8a888'))
for i in range(40):
    cube('TinRib', 5.6 + i * 0.52, -24.5, 3.0, 5.85 + i * 0.52, -5.5, 3.22, rs.flat('Tin', '#8a9599' if i % 2 else '#9aa5a8'))

# ---- camera: đặt cao giữa phố, nhìn dọc phố vào ngã tư
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.type = 'PERSP'
cam.data.sensor_fit = 'VERTICAL'
FOV = 44.0
cam.data.angle_y = math.radians(FOV)
cam.data.clip_end = 400
cam.location = Vector((11.0, -9.5, 13.0))
look = Vector((-3.5, 9.5, 0.0))
cam.rotation_euler = (look - cam.location).to_track_quat('-Z', 'Y').to_euler()
bpy.context.view_layer.update()

if EXPORT3D:
    # chữ và dây (đường cong) đổi sang lưới để glTF xuất được
    bpy.ops.object.select_all(action='DESELECT')
    curves = [o for o in sc.objects if o.type in ('FONT', 'CURVE')]
    for o in curves:
        o.select_set(True)
    if curves:
        bpy.context.view_layer.objects.active = curves[0]
        bpy.ops.object.convert(target='MESH')
    bpy.ops.object.select_all(action='DESELECT')
    for o in sc.objects:
        if o.type == 'MESH':
            o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'scene_full.glb'), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True)
    json.dump(dict(solids=solids, seats=seats, people=people, shops=shops), open(os.path.join(OUT, 'scene3d.json'), 'w'), ensure_ascii=False)
    print('XONG')
    sys.exit(0)

# ---- render ngày/đêm
spots = []
for (px, py) in ((LX + 1.5, -12), (LX + 1.5, -4), (LX + 1.5, 4), (-11, FAR - 1.5), (8, FAR - 1.5), (16, FAR - 1.5), (24, FAR - 1.5)):
    spots.append((px, py, 2.8, 500))
for night in (False, True):
    rs.lighting(sc, night, spots)
    path = os.path.join(OUT, 'plate_night.png' if night else 'plate_day.png')
    sc.render.filepath = path
    for o in sc.objects:
        o.hide_render = False
    bpy.ops.render.render(write_still=True)
    rs.grade(path, night)
    print('đã render', path, flush=True)

# ---- khối che cho Godot (bỏ chữ, dây, đèn lồng nhỏ; không cần vật liệu)
bpy.ops.object.select_all(action='DESELECT')
for o in sc.objects:
    if o.type == 'MESH' and not o.name.startswith(('Lantern', 'Dash', 'Zebra', 'SignText')) and o.name != 'River':
        o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'proxy.glb'), export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_materials='NONE')

# ---- dữ liệu cảnh
M = cam.matrix_world
data = dict(
    camera=dict(matrix=[list(r) for r in M], fov=FOV, res=list(RES)),
    seats=seats, people=people, solids=solids,
    walk=[[LX, -16, -AW, BY0], [LX - 14, BY0 - 3.5, -AW, BY0], [-22, BY1, -AW, FAR], [AW, BY1, 30, FAR], [AW, -5, 8, BY0],
          [LX, FAR, -AW, FAR + 20]],
    lanes=[[[1.8, -40], [1.8, 70]], [[-1.8, 70], [-1.8, -40]], [[-25, BY0 + 1.5], [40, BY0 + 1.5]], [[40, BY1 - 1.5], [-25, BY1 - 1.5]],
           [[1.8, -40], [1.8, BY0 + 1.5], [40, BY0 + 1.5]], [[40, BY1 - 1.5], [-1.8, BY1 - 1.5], [-1.8, -40]]],
    bounds=[-24, -6, 30, FAR + 9],
    sun=[48, -28],
)
json.dump(data, open(os.path.join(OUT, 'scene.json'), 'w'), ensure_ascii=False, indent=1)
print('XONG')
