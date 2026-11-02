import urllib.request

urls = [
    'https://support.apple.com/en-in/125406',
    'https://support.apple.com/en-in/125407',
    'https://support.apple.com/en-in/126471',
    'https://support.apple.com/en-in/126472',
    'https://support.apple.com/en-in/122240',
    'https://support.apple.com/en-in/121456'
]

for url in urls:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        resp = urllib.request.urlopen(req, timeout=10)
        html = resp.read().decode('utf-8')
        print(f'{url}: {len(html)} chars')
        fname = 'support_' + url.split('/')[-1] + '.html'
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(html[:50000])
    except Exception as e:
        print(f'{url}: Error - {e}')