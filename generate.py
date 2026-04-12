html = open('/root/tac3d/templates/index.html.bak').read()
open('/root/tac3d/templates/index.html','w').write(html)
print("restored from backup")
