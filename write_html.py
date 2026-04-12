import subprocess
subprocess.run(['cp', 'templates/index.html', 'templates/index.html.bak'])

content = open('templates/index.html').read()
# Fix common paste corruption
content = content.replace('\u2019', "'").replace('\u2018', "'").replace('\u201c', '"').replace('\u201d', '"').replace('\u2013', '-').replace('\u2014', '-')
open('templates/index.html', 'w').write(content)
print("Fixed")

