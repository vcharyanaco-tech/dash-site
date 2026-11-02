with open('apple_pencil_page.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re
prices = re.findall(r'₹[\d,]+', html)
print('Prices found:', prices[:50])

products = re.findall(r'Apple Pencil[^<\"]*', html)
print('Products:', products[:30])

# Look for more context around prices
for m in re.finditer(r'(Apple Pencil[^<\"]{0,100})', html):
    print(m.group(1)[:200])