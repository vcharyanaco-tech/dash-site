import re

support_files = [
    'support_125406.html',
    'support_125407.html',
    'support_126471.html',
    'support_126472.html',
    'support_122240.html',
    'support_121456.html'
]

with open('support_extracted.txt', 'w', encoding='utf-8') as out:
    for fname in support_files:
        try:
            with open(fname, 'r', encoding='utf-8') as f:
                html = f.read()
            out.write(f'\n=== {fname} ===\n')
            title_match = re.search(r'<title>([^<]+)</title>', html)
            if title_match:
                out.write(f'Title: {title_match.group(1)}\n')
            
            prices = re.findall(r'₹[\d,]+', html)
            if prices:
                out.write(f'Prices: {prices[:20]}\n')
            
            # Extract more content - look for main content
            # Remove scripts and styles
            html_clean = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
            html_clean = re.sub(r'<style[^>]*>.*?</style>', '', html_clean, flags=re.DOTALL)
            
            # Get text content
            text = re.sub(r'<[^>]+>', ' ', html_clean)
            text = re.sub(r'\s+', ' ', text)
            
            # Look for compatibility sections
            if 'compatible' in text.lower() or 'compatibility' in text.lower():
                # Find sentences with compatible
                sentences = re.findall(r'[^.]*compatible[^.]*\.', text, re.IGNORECASE)
                for s in sentences[:10]:
                    out.write(f'  Compat: {s.strip()}\n')
                    
            # Look for iPad model mentions
            ipads = re.findall(r'iPad[^<\.]{0,80}', text)
            for ipad in ipads[:20]:
                if any(kw in ipad.lower() for kw in ['pro', 'air', 'mini', 'gen', 'inch', 'm4', 'm5', 'a16', 'a17']):
                    out.write(f'  iPad: {ipad.strip()}\n')
                    
        except Exception as e:
            out.write(f'{fname}: Error - {e}\n')