# Generates hull.glb. Run inside Blender (5.2+), not with plain python.
#
# A kitbash mass: boxes snapped to a coarse grid, unioned into one faceted shell. Faceted is the point.
#
# On a smooth body every greeble box faces a slightly different way, so the field never presents itself and
# the whole thing reads as a texture on a lump. On a flat facet the entire patch shares one normal and turns
# toward the camera together -- which is how greeble works on a spaceship hull, and why the flat-ground
# version of this sketch read so much more clearly than the smooth-body one.
#
# It also removes the curvature constraint: each UV island is planar, so a panel can be as large as it
# likes without becoming a chord that cuts through the body.
#
# The block list is written out rather than randomised. The primary form carries the silhouette, and noise
# does not carry anything -- greeble is tertiary detail that sits on a form, it never makes one.
#
#   blender --background --python hull.blender.py
# or paste into Blender's text editor and run.
import bpy
import os
from math import radians

OUT = r"D:\Development\takumifukasawa.com\lab\wip\hull.glb"

# Blender is Z-up: z is height, x is the long axis. (Getting this wrong once put the sponsons on top.)
# (x, y, z, size_x, size_y, size_z, yaw_degrees)
BLOCKS = [
    (0.0, 0.0, 0.0, 6.0, 2.4, 1.6, 0),  # main hull
    (-1.2, 0.0, 0.35, 3.2, 2.9, 1.0, 0),  # wider mid section
    (2.6, 0.0, 0.1, 2.6, 1.5, 1.1, 0),  # nose
    (4.0, 0.0, 0.0, 1.6, 0.9, 0.7, 0),  # nose tip
    (-2.6, 0.0, 0.5, 2.0, 1.8, 1.8, 0),  # stern block
    (-3.4, 0.0, 0.2, 1.2, 2.6, 1.2, 0),  # stern plate
    (-0.4, 0.0, 1.0, 2.4, 1.2, 0.9, 0),  # dorsal spine
    (0.8, 0.0, 1.35, 1.2, 0.8, 0.6, 0),  # dorsal tower
    (-1.0, 0.0, -0.75, 3.0, 1.6, 0.7, 0),  # ventral keel
    (0.2, 1.7, 0.1, 2.2, 1.0, 0.8, 0),  # port sponson
    (0.2, -1.7, 0.1, 2.2, 1.0, 0.8, 0),  # starboard sponson
    (-1.8, 2.0, 0.1, 1.4, 1.2, 0.5, 18),  # angled port fin
    (-1.8, -2.0, 0.1, 1.4, 1.2, 0.5, -18),  # angled starboard fin
]

for obj in list(bpy.data.objects):
    if obj.type == "MESH":
        bpy.data.objects.remove(obj, do_unlink=True)

meshes = []
for x, y, z, sx, sy, sz, yaw in BLOCKS:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, y, z))
    cube = bpy.context.active_object
    cube.scale = (sx, sy, sz)
    cube.rotation_euler = (0.0, 0.0, radians(yaw))
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    meshes.append(cube)

# Union into one closed shell. Without it the greeble would also be placed on interior faces and poke out
# through whichever block contains them.
base = meshes[0]
bpy.context.view_layer.objects.active = base
for other in meshes[1:]:
    mod = base.modifiers.new("Union", "BOOLEAN")
    mod.operation = "UNION"
    mod.solver = "EXACT"
    mod.object = other
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(other, do_unlink=True)

base.name = "Hull"
base.data.name = "Hull"

bpy.ops.object.select_all(action="DESELECT")
base.select_set(True)
bpy.context.view_layer.objects.active = base
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.0001)
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")

# Flat shading on purpose: the sketch reads the interpolated vertex normal, so flat shading gives every
# greeble box on one facet the same up direction. That is what makes them a field instead of confetti.
for poly in base.data.polygons:
    poly.use_smooth = False

if not base.data.uv_layers:
    base.data.uv_layers.new(name="UVMap")
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
# One island per planar facet group. scale_to_bounds=False keeps the islands at their relative scale, which
# is what keeps a greeble cell the same world size on every facet (measured: max/min world-per-UV = 1.03).
bpy.ops.uv.smart_project(
    angle_limit=radians(66), island_margin=0.02, area_weight=0.0, correct_aspect=True, scale_to_bounds=False
)
bpy.ops.object.mode_set(mode="OBJECT")

bpy.ops.object.select_all(action="DESELECT")
base.select_set(True)
bpy.context.view_layer.objects.active = base
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_materials="NONE",  # the sketch makes its own
    export_normals=True,
    export_texcoords=True,
    export_yup=True,
    export_cameras=False,
    export_lights=False,
    export_animations=False,
)
print(f"exported {OUT}: {len(base.data.polygons)} faces, {os.path.getsize(OUT)} bytes")
