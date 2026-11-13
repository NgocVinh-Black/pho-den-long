"""Render ảnh chân dung nhân vật chính (đầu chibi đội nón lá) cho khung avatar trên giao diện.

Chạy:  blender -b -P tools/blender/render_portrait.py -- godot/assets/models /tmp/pdl-sprites godot/assets/ui/portrait.png
"""
import bpy
import math
import os
import sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_sprites as rs  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
out = os.path.abspath(argv[2])  # argv[1] là thư mục tạm của render_sprites
sc = rs.new_scene()
for o in list(sc.objects):
    if o.name == 'ShadowCatcher':
        bpy.data.objects.remove(o, do_unlink=True)
rs.import_glb('chibi', colors={'Shirt': '#4f7fa8', 'Pants': '#3c4a5b', 'Skin': '#f1c9a5', 'Hair': '#2b1a12', 'Belt': '#2b3a4a'})
rs.import_glb('hat_nonla')
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 1.15
cam.location = Vector((0.55, -2.6, 1.15))
cam.rotation_euler = (Vector((0, 0, 0.98)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.render.resolution_x = sc.render.resolution_y = 256
sc.render.line_thickness = 2.2
rs.lighting(sc, False, [])
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('XONG', out)
