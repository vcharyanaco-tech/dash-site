import urllib.request
import os

# Create images directory
os.makedirs('E:/projects/dash-site/images', exist_ok=True)

# Official Apple product image URLs (these are typical patterns)
# We'll try to fetch some key images
image_urls = {
    'ipad_pro_11_silver.jpg': 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-pro-11-select-silver-202405?wid=440&hei=440&fmt=jpeg&qlt=95&.v=1716050000000',
    'ipad_pro_13_space_black.jpg': 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-pro-13-select-space-black-202405?wid=440&hei=440&fmt=jpeg&qlt=95&.v=1716050000000',
    'ipad_air_11_blue.jpg': 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-air-11-select-blue-202405?wid=440&hei=440&fmt=jpeg&qlt=95&.v=1716050000000',
    'ipad_air_13_purple.jpg': 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-air-13-select-purple-202405?wid=440&hei=440&fmt=jpeg&qlt=95&.v=1716050000000',
    'ipad_11_pink.jpg': 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-11-select-pink-202405?wid=440&hei=440&fmt=jpeg&qlt=95&.v=1716050000000',
    'ipad_mini_blue.jpg': 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-mini-select-blue-202405?wid=440&hei=440&fmt=jpeg&qlt=95&.v=1716050000000',
    'apple_pencil_pro.jpg': 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MQD83?wid=440&hei=440&fmt=jpeg&qlt=95&.v=1716050000000',
    'apple_pencil_usbc.jpg': 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MU8F2?wid=440&hei=440&fmt=jpeg&qlt=95&.v=1716050000000',
}

for fname, url in image_urls.items():
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        resp = urllib.request.urlopen(req, timeout=15)
        data = resp.read()
        with open(f'E:/projects/dash-site/images/{fname}', 'wb') as f:
            f.write(data)
        print(f'Downloaded: {fname} ({len(data)} bytes)')
    except Exception as e:
        print(f'Failed {fname}: {e}')