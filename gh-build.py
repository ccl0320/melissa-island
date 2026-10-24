# Build the GitHub Pages site from the release source: same page, but music/icons/scenes are separate files
# usage: python3 gh-build.py <release-src dir> <out dir>
import glob, os, shutil, sys

src, out = sys.argv[1], sys.argv[2]
h = open(os.path.join(src, 'melissa-src.html'), encoding='utf-8').read()

def patch(old, new):
    global h
    assert h.count(old) == 1, 'patch target not found: ' + old[:60]
    h = h.replace(old, new)

# loaders accept <script data-src="file"> as well as embedded base64
patch("const id = el.dataset.icon, em = ICON_IDS[id]; if (el.textContent.length < 100) return;",
      "const id = el.dataset.icon, em = ICON_IDS[id]; if (el.dataset.src) { iconMap.key[id] = el.dataset.src; if (em) byEmoji[em] = byEmoji[em.replace(/\\uFE0F/g, '')] = el.dataset.src; return; } if (el.textContent.length < 100) return;")
patch("function bgmUrl(el) {\n", "function bgmUrl(el) {\n  if (el.dataset.src) return el.dataset.src;\n")
patch("if (el && el.textContent.length > 100) {", "if (el && el.dataset.src) u = el.dataset.src;\n  else if (el && el.textContent.length > 100) {")
# cloud sync shim (sync.js) must load before the game script
patch('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>',
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script src="sync.js"></script>')

# the source is a claude.ai artifact body (the artifact host adds the document skeleton); add doctype + charset for a standalone page
if not h.lstrip().lower().startswith('<!doctype'):
    h = '<!doctype html>\n<html lang="zh-Hant">\n<meta charset="utf-8">\n' + h.lstrip()

os.makedirs(out, exist_ok=True)
tags = ''
songs = [('Sunny Hillside Sprint', 'Sunny_Hillside_Sprint'), ('Button Mash Morning', 'Button_Mash_Morning'), ('Morning High Score', 'Morning_High_Score'), ('Pocket Kingdom Shuffle', 'Pocket_Kingdom_Shuffle')]
os.makedirs(os.path.join(out, 'music'), exist_ok=True)
for n, f in songs:
    shutil.copy(os.path.join(src, 'music/bgm/%s.mp3' % f), os.path.join(out, 'music', f + '.mp3'))
    tags += '<script type="application/octet-stream" data-bgm="%s" data-src="music/%s.mp3"></script>\n' % (n, f)
for kind, attr in (('scenes', 'scene'), ('icons', 'icon')):
    os.makedirs(os.path.join(out, kind), exist_ok=True)
    for p in sorted(glob.glob(os.path.join(src, kind, '*.webp'))):
        name = os.path.basename(p)
        shutil.copy(p, os.path.join(out, kind, name))
        tags += '<script type="application/octet-stream" data-%s="%s" data-src="%s/%s"></script>\n' % (attr, name[:-5], kind, name)
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(h.rstrip() + '\n' + tags)
print('ok', len(h) + len(tags), 'bytes')
