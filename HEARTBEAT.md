Read /root/.openclaw/workspace/omega_infinity/api_map.md first.

Omega Infinity primary entrypoint:
http://127.0.0.1:8009

This is the central reasoning interface.

Supporting services:

Decision layer:
http://127.0.0.1:5056

Overlay layer:
http://127.0.0.1:5055

Agents should inspect port 8009 first before calling other services.

---

## Daily TAC-3D Content Pipeline

Run ONCE per day (skip if today's files already exist in tac3d/posts/).

### Step 1: Search for news
Search for today's most relevant biotech or investment decision (real, current, specific).

### Step 2: Run REAL TAC-3D screening
MANDATORY: Use run_screening.sh — never simulate or fabricate scores.

```bash
bash ~/.openclaw/workspace/tac3d/run_screening.sh \
  "decision text here" \
  "layer1_name" "layer1 evidence content" \
  "layer2_name" "layer2 evidence content" \
  "layer3_name" "layer3 evidence content"
```

Save the JSON output. Extract: verdict, eligibility_index, tension, alignment, convergence.

### Step 3: Write posts using REAL scores only

X (max 300 chars):
Save to tac3d/posts/{{date}}_tac3d_x.md

Bluesky (max 300 chars, technical tone):
Save to tac3d/posts/{{date}}_tac3d_bluesky.md

LinkedIn (150-300 words, lead with structural verdict and scores):
Save to tac3d/posts/{{date}}_tac3d_linkedin.md

### Step 4: Sync
```bash
bash ~/.openclaw/workspace/tac3d/sync_posts.sh
```

### Weekly (Monday only)
Also produce:
- tac3d/posts/{{date}}_tac3d_substack.md (800-1200 words, TAC-QSW framework, reference tac3d.sycds.com/TAC-QSW-Whitepaper.pdf)
- tac3d/posts/{{date}}_tac3d_reddit.md (200-400 words, conversational, question-led, for r/investing or r/biotech)

