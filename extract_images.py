import urllib.request
import os
import re

# Try to extract image URLs from the iPad Pro page
with open('ipad_pro_page.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Look for image URLs
img_urls = re.findall(r'https://store\.storeimages\.cdn-apple\.com/[^"\']+\.(?:jpg|jpeg|png|webp)', html)
print(f'Found {len(img_urls)} image URLs')
for u in img_urls[:20]:
    print(u)

# Also look for product gallery images
gallery_urls = re.findall(r'https://[^"\']*apple\.com[^"\']*ipad[^"\']*\.(?:jpg|jpeg|png|webp)', html)
print(f'\nGallery URLs: {len(gallery_urls)}')
for u in gallery_urls[:20]:
    print(u)