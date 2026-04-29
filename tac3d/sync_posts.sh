#!/bin/bash
cd ~/.openclaw/workspace
git add tac3d/posts/
git commit -m "update tac3d posts $(date +%Y-%m-%d)"
git push
