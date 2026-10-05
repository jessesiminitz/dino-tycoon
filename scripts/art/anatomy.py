"""Native-coordinate attachment helpers shared by the Blender model builders."""


def ellipse_edge(cx, cy, rx, ry, x, lower=False):
    offset = ry * math.sqrt(max(0, 1-((x-cx)/rx)**2))
    return cy + offset if lower else cy - offset


def profile_edge(points, x, lower=False):
    """Intersect the actual tail profile, rather than guessing a fixed back height."""
    ys = []
    for (ax, ay), (bx, by) in zip(points, points[1:]+points[:1]):
        if ax != bx and min(ax,bx) <= x <= max(ax,bx):
            ys.append(ay+(by-ay)*(x-ax)/(bx-ax))
    if not ys:
        raise ValueError(f'Attachment outside profile at {x}')
    return max(ys) if lower else min(ys)


def attach(scene, name, parent, x):
    """Keep each accessory rigid while its root follows the parent's animation."""
    prefix = scene.name+'_'+name
    for obj in scene.objects:
        if obj.type == 'MESH' and (obj.name == prefix or obj.name.startswith(prefix+'_')):
            obj['attachment'] = parent
            obj['anchor_x'] = x
