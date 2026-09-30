"""Build editable Retro Desk hero assets in Blender and export a single GLB.

The GLB keeps each prop under a named root. Models use Blender Z-up and face
Blender -Y, which the glTF exporter converts to Three.js Y-up/+Z-front.
"""

import bpy
import math
from pathlib import Path
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "models"
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def mat(name, color, metallic=0.0, roughness=0.75, emission=None):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 1.4
    return material


ivory = mat("Aged ivory ABS", (.75, .72, .62), roughness=.63)
ivory_light = mat("Sun-worn ivory", (.86, .83, .72), roughness=.63)
ivory_dark = mat("Recessed beige", (.49, .49, .43), roughness=.78)
grey = mat("Pewter gray plastic", (.32, .37, .38), roughness=.6)
black = mat("Charcoal rubber", (.065, .083, .084), roughness=.85)
screen = mat("CRT smoked glass", (.018, .073, .077), metallic=.1, roughness=.2)
recess = mat("CRT inner recess", (.018, .025, .026), roughness=.94)
steel = mat("Brushed steel", (.43, .48, .48), metallic=.65, roughness=.4)
steel_dark = mat("Aged steel", (.18, .23, .24), metallic=.7, roughness=.52)
mint = mat("Oxidized mint", (.23, .38, .36), metallic=.24, roughness=.62)
red = mat("Vintage telephone red", (.5, .12, .105), roughness=.47)
red_dark = mat("Recessed oxblood", (.25, .06, .06), roughness=.64)
paper = mat("Warm writing paper", (.82, .78, .66), roughness=.93)
paper_dark = mat("Paper edges", (.65, .61, .52), roughness=.94)
ink = mat("Printed charcoal", (.09, .13, .14), roughness=1)
orange = mat("Warm amber indicator", (.94, .46, .16), emission=(.8, .25, .045))
green = mat("Green indicator", (.4, .85, .58), emission=(.12, .6, .2))
blue = mat("Weathered blue", (.16, .31, .4), roughness=.7)
bulb = mat("Warm lamp bulb", (.98, .79, .55), roughness=.4, emission=(1, .42, .13))
leather = mat("Worn headphone leather", (.075, .082, .075), roughness=.92)
leather_edge = mat("Leather seam", (.24, .22, .18), roughness=.98)
phone_key = mat("Ivory telephone keys", (.79, .75, .64), roughness=.68)
chrome = mat("Polished worn chrome", (.57, .61, .59), metallic=.82, roughness=.27)


def group(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj


def finish(obj, name, material, parent=None, bevel=0):
    obj.name = name
    obj.data.materials.append(material)
    if parent:
        obj.parent = parent
    if bevel:
        modifier = obj.modifiers.new("Soft manufactured edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        modifier.affect = "EDGES"
        obj.modifiers.new("Weighted face normals", "WEIGHTED_NORMAL")
    return obj


def cube(name, loc, size, material, parent=None, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, material, parent, bevel)


def cylinder(name, loc, radius, depth, material, parent=None, vertices=32, rotation=None, bevel=.008):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    if rotation:
        obj.rotation_euler = rotation
    return finish(obj, name, material, parent, bevel)


def sphere(name, loc, size, material, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=36, ring_count=24, location=loc)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, material, parent)


def rod(name, start, end, radius, material, parent=None, vertices=14):
    a, b = Vector(start), Vector(end)
    midpoint = (a + b) * .5
    obj = cylinder(name, midpoint, radius, (b-a).length, material, parent, vertices)
    obj.rotation_euler = (b-a).to_track_quat("Z", "Y").to_euler()
    return obj


def tube(name, coordinates, radius, material, parent=None):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 12
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(coordinates) - 1)
    for point, coordinate in zip(spline.points, coordinates):
        point.co = (*coordinate, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    obj.data.materials.append(material)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    return bpy.context.object


def torus(name, loc, major, minor, material, parent=None, rotation=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=48, minor_segments=8, location=loc, major_radius=major, minor_radius=minor)
    obj = bpy.context.object
    if rotation:
        obj.rotation_euler = rotation
    return finish(obj, name, material, parent)


def text(name, body, loc, size, material, parent=None, rotation=None, spacing=1.0):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = body
    curve.size = size
    curve.space_character = spacing
    curve.extrude = .0008
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    if rotation:
        obj.rotation_euler = rotation
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    return finish(obj, name, material, parent)


def screw(name, x, y, z, parent, front=False):
    rotation = (math.pi / 2, 0, 0) if front else None
    cylinder(name, (x, y, z), .025, .008, steel_dark, parent, 12, rotation, .002)
    if front:
        cube(name + " slot", (x, y - .008, z), (.024, .003, .004), black, parent, .001)
    else:
        cube(name + " slot", (x, y, z + .006), (.024, .004, .003), black, parent, .001)


def tapered_shell(name, parent):
    front_y, back_y = -.59, .77
    z0, z1 = .56, 2.68
    verts = [
        (-1.28, front_y, z0), (1.28, front_y, z0), (1.28, front_y, z1), (-1.28, front_y, z1),
        (-1.05, back_y, z0+.14), (1.05, back_y, z0+.14), (1.05, back_y, z1-.15), (-1.05, back_y, z1-.15),
    ]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, ivory, parent, .075)


# CRT monitor. Front faces Blender -Y, so they face the visitor after GLB export.
crt = group("CRT")
# The shell sits flush on the horizontal computer chassis: no pedestal or air gap.
cube("full-width contact plate", (0, .02, .555), (2.24, 1.18, .055), ivory_dark, crt, .014)
tapered_shell("tapered monitor housing", crt)
cube("recessed screen cavity", (0, -.602, 1.725), (2.23, .025, 1.65), recess, crt, .055)
# Four real frame sections leave an opening for the curved live screen. Their
# dark inner lips create the recessed CRT tunnel seen in the reference photo.
for side in [-1, 1]:
    cube("molded vertical bezel", (side*1.185, -.655, 1.73), (.16, .135, 1.94), ivory_light, crt, .025)
    cube("inner vertical shadow lip", (side*1.073, -.652, 1.725), (.05, .07, 1.62), recess, crt, .012)
cube("molded upper bezel", (0, -.655, 2.63), (2.52, .135, .15), ivory_light, crt, .025)
cube("molded lower bezel", (0, -.655, .82), (2.52, .135, .24), ivory_light, crt, .025)
cube("inner upper shadow lip", (0, -.652, 2.53), (2.16, .07, .055), recess, crt, .012)
cube("inner lower shadow lip", (0, -.652, .916), (2.16, .07, .058), recess, crt, .012)
cube("lower button rail", (0, -.735, .765), (2.41, .025, .16), ivory, crt, .01)
for x in [-1.11, -1.03, 1.03, 1.11]:
    screw("bezel screw", x, -.734, .74 if x < 0 else 2.63, crt, True)
for i in range(9):
    cube(f"right side breathing slot {i+1}", (1.17, -.09 + i*.068, 1.82), (.009, .025, .6), ivory_dark, crt, .003)
for i in range(8):
    cube(f"top vent {i+1}", (-.8 + i*.22, .31, 2.646), (.07, .43, .009), ivory_dark, crt, .004)
for i, x in enumerate([-.52, -.29, -.06, .17]):
    cylinder(f"CRT adjustment knob {i+1}", (x, -.766, .765), .043, .025, black, crt, rotation=(math.pi/2, 0, 0))
    cylinder("knob silver cap", (x, -.784, .765), .014, .007, steel_dark, crt, rotation=(math.pi/2, 0, 0))
cylinder("power button", (.95, -.766, .765), .064, .026, black, crt, rotation=(math.pi/2, 0, 0))
cylinder("power switch inset", (.95, -.784, .765), .03, .01, ivory_dark, crt, rotation=(math.pi/2, 0, 0))
cylinder("power indicator", (.73, -.766, .765), .016, .013, green, crt, rotation=(math.pi/2, 0, 0))
text("monitor brand", "FAZLEY", (-1.04, -.755, .745), .06, grey, crt, (math.pi/2, 0, 0))
text("control markings", "H  V  B  C", (-.565, -.75, .835), .033, grey, crt, (math.pi/2, 0, 0))
cube("monitor shell side seam", (1.234, .19, 1.59), (.008, .83, 1.79), ivory_dark, crt, .002)
cube("monitor service decal", (1.237, .45, 1.14), (.008, .22, .29), paper_dark, crt, .002)
for i in range(3):
    cube("service decal type", (1.245, .365+i*.045, 1.10), (.003, .09, .006), ink, crt, .001)
cube("rear label", (0, .77, 1.32), (.59, .012, .18), ivory_dark, crt, .008)
for x in [-.98, .98]:
    for z in [.72, 2.44]: screw("rear shell screw", x, .785, z, crt, True)


# Horizontal desktop computer case under the monitor, matching the references.
tower = group("TOWER")
cube("horizontal PC chassis", (0, 0, .29), (2.8, 1.52, .58), ivory, tower, .043)
cube("face plate", (0, -.775, .3), (2.73, .05, .49), ivory_light, tower, .025)
for side in [-1, 1]:
    for i in range(6):
        cube("case vent", (side*(.97+i*.05), -.809, .36), (.022, .009, .26), ivory_dark, tower, .003)
cube("floppy bay bezel", (.24, -.81, .34), (1.01, .025, .2), ivory_dark, tower, .008)
cube("floppy bay face", (.24, -.831, .34), (.88, .017, .13), grey, tower, .007)
cube("floppy slot", (.24, -.844, .375), (.72, .008, .015), black, tower, .002)
cube("drive eject button", (.65, -.85, .302), (.055, .015, .03), ivory_light, tower, .003)
cube("CD drive outline", (-.47, -.814, .34), (.39, .017, .2), ivory_dark, tower, .006)
cube("CD drive seam", (-.47, -.83, .375), (.32, .006, .012), black, tower, .002)
cylinder("power switch", (-.4, -.83, .16), .048, .025, grey, tower, rotation=(math.pi/2, 0, 0))
cylinder("disk LED", (.7, -.834, .16), .015, .012, orange, tower, rotation=(math.pi/2, 0, 0))
text("computer model line", "F / 99   PERSONAL COMPUTER", (-.96, -.811, .12), .038, grey, tower, (math.pi/2, 0, 0))
cube("drive safety label", (.9, -.813, .48), (.25, .012, .045), paper_dark, tower, .002)
for x in [-1.27, 1.27]: screw("case face screw", x, -.813, .13, tower, True)
for x in [-1.1, 1.1]:
    for y in [-.55, .55]: cube("rubber case foot", (x, y, -.02), (.18, .2, .05), black, tower, .014)


# Keyboard. Individual keycaps have beveled tops, a varied sun-worn palette,
# and a raised housing rather than a single textured slab.
keyboard = group("KEYBOARD")
cube("keyboard lower shell", (0, 0, .065), (3.04, 1.01, .13), ivory_dark, keyboard, .055)
cube("keyboard top deck", (0, 0, .13), (2.94, .91, .063), ivory, keyboard, .03)
key_mats = [ivory_light, paper, ivory]
key_legends = ["1234567890-=+*..", "QWERTYUIOP[]789.", "ASDFGHJKL;'456..", "ZXCVBNM,./<>123.", "CTRL........... "]
for row in range(5):
    for col in range(16):
        if row == 4 and 5 <= col <= 9:
            continue
        x = -1.35 + col * .178
        y = .34 - row * .173
        material = key_mats[(row + col * 5) % 3]
        cube(f"keycap {row:02}-{col:02}", (x, y, .191), (.155, .12, .064), material, keyboard, .013)
        legend = key_legends[row][col] if col < len(key_legends[row]) else ""
        if legend and legend not in ". ":
            text("individual key legend", legend, (x-.042, y-.023, .226), .048, grey, keyboard)
cube("long space bar", (-.08, -.345, .192), (.84, .12, .064), ivory_light, keyboard, .014)
cube("keyboard status window", (1.23, -.35, .162), (.35, .07, .006), ivory_dark, keyboard, .003)
for i in range(3): cylinder("keyboard status LED", (1.12+i*.09, -.35, .168), .012, .004, green if i == 0 else grey, keyboard, 12, bevel=.001)
cube("keyboard brand inset", (1.1, .452, .165), (.49, .028, .004), ivory_dark, keyboard, .002)
text("keyboard brand", "FAZLEY", (.89, .439, .168), .046, ink, keyboard)
for x in [-1.38, 1.38]: cube("keyboard foot", (x, .4, -.016), (.17, .13, .045), black, keyboard, .01)


# One detailed project floppy. Three.js can clone and recolor it later.
floppy = group("FLOPPY")
cube("3.5 inch shell", (0, 0, .035), (.86, .86, .07), grey, floppy, .028)
cube("shell lip", (0, -.422, .035), (.84, .024, .063), black, floppy, .006)
cube("metal shutter", (0, .25, .074), (.48, .22, .012), steel, floppy, .006)
for i in range(6): cube("shutter ridge", (-.2 + i*.08, .25, .082), (.012, .16, .002), steel_dark, floppy, .001)
cube("paper label", (0, -.14, .074), (.64, .36, .006), paper, floppy, .003)
cube("label color strip", (0, -.013, .079), (.62, .055, .002), mint, floppy, .001)
text("disk archive title", "WORK / 01", (-.27, -.225, .081), .085, ink, floppy)
text("disk brand", "FAZLEY SYSTEMS", (-.28, -.074, .081), .041, grey, floppy)
text("disk handwritten index", "VOL. 01  /  1999", (-.27, -.29, .081), .032, blue, floppy)
for x in [-.36, .36]:
    for y in [-.36, .36]: screw("floppy shell screw", x, y, .077, floppy)
cube("write protect notch", (.32, .38, .07), (.1, .09, .016), black, floppy, .004)


notebook = group("NOTEBOOK")
cube("cloth hard cover", (0, 0, .045), (1.2, 1.52, .09), red_dark, notebook, .025)
for i in range(6): cube("stacked page edge", (.03, -.007, .09+i*.005), (1.1, 1.42, .004), paper_dark if i%2 else paper, notebook, .01)
cube("book top cover", (0, 0, .135), (1.17, 1.5, .025), red, notebook, .017)
cube("label plaque", (0, .24, .15), (.79, .36, .006), paper, notebook, .004)
text("notebook title", "FIELD NOTES", (-.33, .205, .155), .08, ink, notebook)
text("notebook subtitle", "FAZLEY  /  2026", (-.31, .07, .155), .04, grey, notebook)
for i in range(9):
    torus("metal binding ring", (-.58, -.59+i*.148, .13), .046, .009, steel, notebook, (math.pi/2, 0, 0))
cube("book ribbon", (.36, -.57, .154), (.065, .36, .009), red_dark, notebook, .002)
cube("notebook elastic closure", (.49, 0, .165), (.07, 1.48, .012), red_dark, notebook, .004)
for x in [-.5, .5]:
    cube("worn notebook corner", (x, -.67, .153), (.12, .11, .003), paper_dark, notebook, .002)


# Adjustable articulated lamp with joints, shade, inner reflector and bulb.
lamp = group("LAMP")
cylinder("heavy lamp foot", (0, 0, .035), .39, .07, steel_dark, lamp)
cylinder("lamp base plate", (0, 0, .085), .27, .04, grey, lamp)
cylinder("lamp pivot", (0, 0, .18), .085, .15, steel, lamp)
rod("lower arm", (0, 0, .18), (.22, .03, 1.18), .034, steel, lamp)
rod("parallel lower arm", (.08, .025, .18), (.3, .055, 1.18), .019, grey, lamp)
cylinder("elbow hinge", (.26, .04, 1.19), .09, .09, steel_dark, lamp, rotation=(math.pi/2, 0, 0))
rod("upper arm", (.26, .04, 1.19), (.75, .03, 2.03), .034, steel, lamp)
rod("parallel upper arm", (.33, .07, 1.18), (.81, .07, 2.01), .019, grey, lamp)
cylinder("shade hinge", (.78, .035, 2.02), .075, .11, steel_dark, lamp, rotation=(math.pi/2, 0, 0))
bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=.42, radius2=.16, depth=.45, location=(.95, -.04, 1.91))
shade = finish(bpy.context.object, "tapered shade", mint, lamp, .012)
shade.rotation_euler[1] = -.3
cylinder("shade rim", (1.01, -.04, 1.7), .4, .018, steel_dark, lamp, bevel=.004)
sphere("lamp bulb", (1.02, -.04, 1.72), (.12, .12, .12), bulb, lamp)
cylinder("amber push switch", (.15, -.23, .085), .045, .02, orange, lamp)
for x in [.24, .30]:
    rod("lamp tension spring wire", (x, -.03, .45), (x+.13, -.03, .95), .008, chrome, lamp, 8)
text("lamp maker stamp", "F / 99", (-.16, -.33, .083), .04, paper, lamp)


# Fan and telephone add the distinctive dense, asymmetrical silhouette in refs.
fan = group("FAN")
cylinder("fan stand foot", (0, 0, .05), .38, .1, steel_dark, fan)
rod("fan stem", (0, 0, .08), (0, 0, .65), .09, steel_dark, fan)
sphere("fan motor housing", (0, .13, 1.02), (.21, .22, .21), grey, fan)
for i in range(4):
    angle = i * math.pi / 2
    # Blade tips stay within the 0.48-radius grille, including their width.
    blade = sphere("curved fan blade", (math.cos(angle)*.23, -.08, 1.02+math.sin(angle)*.23), (.20, .028, .09), steel, fan)
    blade.rotation_euler[1] = -angle+.2
    blade.rotation_euler[0] = .1
for radius in [.48, .38, .27, .16]:
    torus("concentric wire grille", (0, -.22, 1.02), radius, .009, steel_dark, fan, (math.pi/2, 0, 0))
for i in range(24):
    a = i * math.tau / 24
    rod("fan grille radial wire", (0, -.233, 1.02), (math.cos(a)*.48, -.233, 1.02+math.sin(a)*.48), .005, steel_dark, fan, 8)
cylinder("fan center badge", (0, -.25, 1.02), .095, .035, grey, fan, rotation=(math.pi/2, 0, 0))
torus("fan center chrome ring", (0, -.274, 1.02), .074, .008, chrome, fan, (math.pi/2, 0, 0))
cylinder("fan speed selector", (.22, -.13, .075), .045, .034, black, fan, bevel=.004)
text("fan model stamp", "AIR / 99", (-.18, -.33, .105), .044, paper, fan, (math.pi/2, 0, 0))

phone = group("PHONE")
cube("telephone rubber underside", (0, 0, .028), (1.05, .83, .056), black, phone, .035)
cube("telephone sculpted red body", (0, 0, .155), (1.09, .86, .27), red, phone, .07)
deck = cube("sloped dial deck", (0, -.075, .29), (.97, .66, .095), red, phone, .035)
deck.rotation_euler[0] = .15
cube("raised dial surround", (0, -.16, .344), (.69, .46, .023), red_dark, phone, .022).rotation_euler[0] = .15
for row, legends in enumerate(["*0#", "789", "456", "123"]):
    for col, legend in enumerate(legends):
        x, y = -.215 + col*.215, -.325 + row*.105
        z = .35 + (y+.16)*.15
        button = cube("recessed telephone key", (x, y, z), (.151, .076, .037), phone_key, phone, .016)
        button.rotation_euler[0] = .15
        text("key legend", legend, (x-.022, y-.024, z+.022), .045, ink, phone)
text("telephone brand", "FAZLEY / 99", (-.29, .075, .389), .05, paper, phone)
for x in [-.41, .41]:
    cube("handset cradle recess", (x, .295, .353), (.18, .18, .055), red_dark, phone, .025)
    cube("handset cradle fork", (x, .30, .415), (.10, .18, .13), red, phone, .03)
    cube("soft handset rest", (x, .30, .489), (.095, .115, .016), black, phone, .006)
cube("curved telephone receiver grip", (0, .30, .535), (.79, .12, .105), red, phone, .052)
for side in [-1, 1]:
    x = side*.405
    sphere("receiver shoulder", (x, .30, .516), (.14, .115, .105), red, phone)
    cylinder("receiver end cap", (side*.505, .30, .516), .107, .048, red_dark, phone,
             rotation=(0, math.pi/2, 0), bevel=.008)
    torus("receiver chrome trim", (side*.52, .30, .516), .09, .009, chrome, phone,
          rotation=(0, math.pi/2, 0))
    for j in range(7):
        a = j * math.tau / 7
        sphere("receiver acoustic perforation", (side*.532, .30+math.cos(a)*.046,
                .516+math.sin(a)*.046), (.006, .006, .006), black, phone)
for x in [-.45, .45]:
    for y in [-.33, .33]: cube("telephone grip foot", (x, y, -.005), (.14, .13, .028), black, phone, .009)
phone_cord = [(-.53, .19, .46), (-.64, .14, .34), (-.67, .04, .18)]
for i in range(97):
    t = i / 96
    phone_cord.append((-.67-.29*t, -.04+.055*math.cos(t*math.tau*13),
                       .15+.055*math.sin(t*math.tau*13)))
phone_cord.extend([(-.9, -.16, .10), (-.53, -.24, .12)])
tube("continuous coiled telephone cord", phone_cord, .012, black, phone)


# Headphones rest on their ear cushions; the arch is assembled from actual
# curved rails instead of a rotated torus, which had broken the silhouette.
headphones = group("HEADPHONES")
headband = [(.36*math.cos(a), 0, .17+.36*math.sin(a))
            for a in [math.pi-i*math.pi/32 for i in range(33)]]
tube("padded headband arch", headband, .034, leather, headphones)
for y in [-.037, .037]:
    rail = [(.345*math.cos(a), y, .17+.345*math.sin(a))
            for a in [math.pi-i*math.pi/32 for i in range(33)]]
    tube("headband metal rail", rail, .009, chrome, headphones)
for i in range(13):
    a = .83 + i*(math.pi-1.66)/12
    x, z = .366*math.cos(a), .17+.366*math.sin(a)
    rod("headband stitching", (x, -.036, z), (x, .036, z), .0025, leather_edge, headphones, 6)
for side in [-1, 1]:
    x = side*.355
    rod("adjustable headphone slider", (x, 0, .19), (x, 0, .335), .018, chrome, headphones)
    cylinder("earcup outer housing", (x, 0, .17), .164, .115, black, headphones,
             rotation=(0, math.pi/2, 0), bevel=.018)
    cylinder("earcup metal badge", (x+side*.068, 0, .17), .117, .014, steel_dark, headphones,
             rotation=(0, math.pi/2, 0), bevel=.005)
    cylinder("earcup inset badge", (x+side*.077, 0, .17), .068, .009, chrome, headphones,
             rotation=(0, math.pi/2, 0), bevel=.004)
    torus("soft ear cushion", (x-side*.063, 0, .17), .135, .039, leather, headphones,
          rotation=(0, math.pi/2, 0))
    torus("cushion stitch seam", (x-side*.07, 0, .17), .126, .003, leather_edge, headphones,
          rotation=(0, math.pi/2, 0))
tube("headphone lead", [(-.41, -.03, .095), (-.53, -.17, .07), (-.61, -.27, .025),
                        (-.47, -.39, .022), (-.27, -.43, .025)], .011, black, headphones)


# Hollow glazed ceramic mug. The curved handle joins the body at both ends.
mug = group("MUG")
ceramic = mat("Sea-glass glazed ceramic", (.28, .49, .51), roughness=.34)
ceramic_dark = mat("Mug inner glaze", (.17, .32, .34), roughness=.48)
coffee = mat("Coffee", (.065, .036, .024), roughness=.25)
profile = [(0, .008), (.16, .008), (.196, .015), (.215, .055), (.23, .285),
           (.235, .355), (.226, .374), (.208, .365), (.192, .32), (.17, .075), (0, .075)]
segments = 48
vertices = [(r*math.cos(a*math.tau/segments), r*math.sin(a*math.tau/segments), z)
            for r, z in profile for a in range(segments)]
faces = [(j*segments+a, j*segments+(a+1)%segments,
          (j+1)*segments+(a+1)%segments, (j+1)*segments+a)
         for j in range(len(profile)-1) for a in range(segments)]
mesh = bpy.data.meshes.new("hollow mug wall mesh")
mesh.from_pydata(vertices, [], faces)
mesh.update()
body = bpy.data.objects.new("hollow mug body", mesh)
bpy.context.collection.objects.link(body)
finish(body, "hollow mug body", ceramic, mug)
for face in body.data.polygons:
    face.use_smooth = True
torus("rolled ceramic lip", (0, 0, .368), .218, .014, ceramic, mug)
cylinder("visible coffee surface", (0, 0, .235), .187, .004, coffee, mug, bevel=.001)
torus("coffee edge meniscus", (0, 0, .239), .185, .002, ceramic_dark, mug)
torus("ceramic foot ring", (0, 0, .018), .155, .009, ceramic_dark, mug)
torus("soft coffee reflection", (-.04, -.035, .239), .055, .003, ceramic_dark, mug)
curve = bpy.data.curves.new("attached C handle path", "CURVE")
curve.dimensions = "3D"
curve.resolution_u = 20
curve.bevel_depth = .044
curve.bevel_resolution = 5
spline = curve.splines.new("BEZIER")
spline.bezier_points.add(4)
for point, coordinate in zip(spline.bezier_points,
                             [( .21, 0, .30), (.42, 0, .35), (.5, 0, .215), (.42, 0, .075), (.2, 0, .105)]):
    point.co = coordinate
    point.handle_left_type = "AUTO"
    point.handle_right_type = "AUTO"
handle = bpy.data.objects.new("attached C handle", curve)
bpy.context.collection.objects.link(handle)
handle.parent = mug
handle.data.materials.append(ceramic)
bpy.ops.object.select_all(action="DESELECT")
handle.select_set(True)
bpy.context.view_layer.objects.active = handle
bpy.ops.object.convert(target="MESH")
text("mug monogram", "F.", (-.043, -.234, .17), .105, paper, mug, (math.pi/2, 0, 0))


bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "tools" / "retro-desk-assets.blend"))
# Keep the .blend fully editable, but merge pieces that share a material in the
# exported copy. The keycaps and fan grille otherwise cost hundreds of draws.
for root in (crt, tower, keyboard, floppy, notebook, fan, phone, headphones, mug):
    buckets = {}
    for child in list(root.children):
        if child.type == "MESH" and len(child.data.materials) == 1:
            buckets.setdefault(child.data.materials[0].name, []).append(child)
    for material_name, pieces in buckets.items():
        if len(pieces) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for piece in pieces:
            piece.select_set(True)
        bpy.context.view_layer.objects.active = pieces[0]
        bpy.ops.object.join()
        pieces[0].name = f"{root.name} / {material_name}"
bpy.ops.export_scene.gltf(filepath=str(OUT / "hero-props.glb"), export_format="GLB", export_apply=True, export_yup=True)
print(f"Exported {OUT / 'hero-props.glb'}")
