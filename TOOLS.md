# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

## TAC-3D Decision Screener
API endpoint: https://tac3d.sycds.com/api/chat
Header: x-access-key: TAC-TRIAL-927C-0471-41DE
Method: POST
Body: {"messages":[{"role":"user","content":"<decision + evidence>"}]}

## TAC-3D Run Screening (IMPORTANT: Use this, don't simulate)
Always call the real API. Never simulate TAC-3D results.
Script: bash ~/.openclaw/workspace/tac3d/run_screening.sh "decision" "layer1_name" "layer1_content" "layer2_name" "layer2_content" ["layer3_name" "layer3_content"]
Response contains real verdict, tension, alignment, convergence, eligibility_index.
Use these real scores in posts. Do NOT generate scores yourself.
