from PIL import Image, ImageDraw, ImageFont

W, H = 1440, 900
img = Image.new('RGB', (W, H), '#0b1220')
d = ImageDraw.Draw(img)

for y in range(0, H, 30):
    shade = 15 + (y * 10 // H)
    d.rectangle((0, y, W, y + 25), fill=(10 + shade, 18 + shade, 30 + shade))

panel_color = '#121d2d'
d.rounded_rectangle((60, 40, 1380, 190), radius=24, fill=panel_color)

try:
    title_font = ImageFont.truetype('arial.ttf', 60)
    sub_font = ImageFont.truetype('arial.ttf', 28)
    small_font = ImageFont.truetype('arial.ttf', 22)
    bold_font = ImageFont.truetype('arial.ttf', 42)
    fleet_font = ImageFont.truetype('arial.ttf', 38)
except Exception:
    title_font = ImageFont.load_default()
    sub_font = ImageFont.load_default()
    small_font = ImageFont.load_default()
    bold_font = ImageFont.load_default()
    fleet_font = ImageFont.load_default()

# Header
text_color = '#eaf3ff'
d.text((120, 70), 'AEGIS', font=title_font, fill=text_color)
d.text((120, 144), 'RESPONSE', font=title_font, fill=text_color)
d.text((120, 225), 'Collaborative Multi-Agent', font=sub_font, fill='#b7c9de')
d.text((120, 260), 'Disaster Operations Room', font=sub_font, fill='#b7c9de')

# Speed label
speed_box = (1160, 95, 1310, 155)
d.rounded_rectangle(speed_box, radius=10, fill='#1f2c3f')
d.text((1188, 102), 'SIM', font=small_font, fill='#dfe9ff')
d.text((1190, 135), 'SPEED:', font=small_font, fill='#dfe9ff')

# Stats cards
cards = [
    (90, 330, 570, 520, '1', 'Active\nDisasters', '#ff6b57', '#ff9a6b'),
    (620, 330, 1110, 520, '✅', 'Resolved\nDisasters', '#2dd4bf', '#1cc7a5'),
    (1120, 330, 1330, 520, '🚒', 'Fleet\nUnits', '#7c8cff', '#a0a8ff'),
]

for x1, y1, x2, y2, label, text, c1, c2 in cards:
    d.rounded_rectangle((x1, y1, x2, y2), radius=22, fill='#111d2d')
    d.rounded_rectangle((x1 + 30, y1 + 30, x1 + 120, y1 + 120), radius=18, fill=c1)
    d.text((x1 + 52, y1 + 42), label, font=bold_font, fill='white')
    d.multiline_text((x1 + 170, y1 + 40), text, font=bold_font, fill='#edf5ff', spacing=8)
    if label == '✅':
        d.text((x1 + 55, y1 + 38), '✓', font=bold_font, fill='white')

# Fleet panel
fleet_panel = (80, 570, 1360, 830)
d.rounded_rectangle(fleet_panel, radius=24, fill='#121d2d')
d.text((120, 600), 'EMERGENCY FLEET STATUS', font=fleet_font, fill='#eef8ff')

# Tabs
for idx, tab in enumerate(['Fire (FD)', 'Medical (EMS)', 'Police (PD)']):
    x = 120 + idx * 290
    d.rounded_rectangle((x, 670, x + 230, 725), radius=12, fill=(26, 39, 54) if idx else (30, 50, 72))
    d.text((x + 25, 680), tab, font=small_font, fill='#eaf3ff' if idx == 0 else '#b7c9de')

# Fleet rows
for i in range(3):
    y = 760 + i * 90
    d.rounded_rectangle((120, y, 1240, y + 70), radius=14, fill='#0d1828')
    d.text((150, y + 18), f'Fire Engine {i + 1}', font=ImageFont.truetype('arial.ttf', 26), fill='#edf5ff')
    d.text((150, y + 48), '28.6943, 77.2090', font=ImageFont.truetype('arial.ttf', 20), fill='#8ea9c9')

img.save('screenshot.png')
print('Created screenshot.png')
