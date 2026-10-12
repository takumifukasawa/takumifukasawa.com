# Generates pod.glb. Run inside Blender (5.2+), not with plain python.
#
# The body is built as a parametric grid rather than modelled and then unwrapped, because the UV is what
# this sketch actually consumes: u runs around the pod, v along it, and the only seam is where u wraps.
# An unwrapped mesh would scatter the panels across UV islands and break them at every island edge.
#
# Shape work that is NOT in the formula (the bend) is applied as a modifier afterwards, so the mesh carries
# more than the parameterisation does while keeping the same UV.
#
#   blender --background --python pod.blender.py
# or paste into Blender's text editor and run.
import bpy
import bmesh
from math import pi, sin, cos, radians

NU, NV = 112, 72  # segments around / along
RIDGES = 12
RIDGE_AMP = 0.085
LENGTH = 5.2
BASE_R = 1.0
OUT = r"D:\Development\takumifukasawa.com\lab\carapace\pod.glb"


def profile(t: float) -> float:
    """Radius along the pod. Pointed at both ends, fatter toward one -- a symmetric pod reads as a rugby ball."""
    p = sin(pi * t) ** 0.55
    p *= 1.0 + 0.28 * cos(pi * t)
    return max(p, 0.05)  # never exactly 0, or the end rings become degenerate triangles


def point(u: float, v: float):
    r = BASE_R * profile(v)
    # Longitudinal ridges, faded at the tips so they do not pinch into the poles.
    r *= 1.0 + RIDGE_AMP * cos(RIDGES * 2.0 * pi * u) * (sin(pi * v) ** 0.5)
    return (r * cos(2.0 * pi * u), (v - 0.5) * LENGTH, r * sin(2.0 * pi * u))


if "Pod" in bpy.data.objects:
    bpy.data.objects.remove(bpy.data.objects["Pod"], do_unlink=True)

mesh = bpy.data.meshes.new("Pod")
bm = bmesh.new()
uv_layer = bm.loops.layers.uv.new("UVMap")

# NU + 1 columns: the last duplicates the first position but carries u = 1. That duplicate IS the seam.
grid = [[bm.verts.new(point((i / NU) % 1.0, j / NV)) for j in range(NV + 1)] for i in range(NU + 1)]
bm.verts.ensure_lookup_table()
index = {vert: (i / NU, j / NV) for i, col in enumerate(grid) for j, vert in enumerate(col)}

for i in range(NU):
    for j in range(NV):
        face = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
        for loop in face.loops:
            loop[uv_layer].uv = index[loop.vert]

bm.normal_update()
bm.to_mesh(mesh)
bm.free()

obj = bpy.data.objects.new("Pod", mesh)
bpy.context.collection.objects.link(obj)
for poly in mesh.polygons:
    poly.use_smooth = True

bpy.context.view_layer.objects.active = obj
obj.select_set(True)

# Not a surface of revolution any more. Modifiers keep the UV.
bend = obj.modifiers.new("Bend", "SIMPLE_DEFORM")
bend.deform_method = "BEND"
bend.deform_axis = "Z"
bend.angle = radians(26)
bpy.ops.object.modifier_apply(modifier="Bend")

obj.scale = (1.0, 1.0, 0.86)  # oval section rather than circular
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
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
print(f"exported {OUT}: {len(mesh.vertices)} verts, {len(mesh.polygons)} faces")
