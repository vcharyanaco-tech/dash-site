import re

support_files = [
    'support_125406.html',
    'support_125407.html',
    'support_126471.html',
    'support_126472.html',
    'support_122240.html',
    'support_121456.html'
]

for fname in support_files:
    try:
        with open(fname, 'r', encoding='utf-8') as f:
            html = f.read()
        print(f'\n=== {fname} ===')
        title_match = re.search(r'<title>([^<]+)</title>', html)
        if title_match:
            print(f'Title: {title_match.group(1)}')
        
        prices = re.findall(r'₹[\d,]+', html)
        if prices:
            print(f'Prices: {prices[:20]}')
        
        # Look for compatibility lists
        compat = re.findall(r'(iPad[^<\"]{0,50})', html)
        for c in compat[:30]:
            if 'pro' in c.lower() or 'air' in c.lower() or 'mini' in c.lower() or 'gen' in c.lower():
                print(f'  Compat: {c}')
                
    except Exception as e:
        print(f'{fname}: Error - {e}')