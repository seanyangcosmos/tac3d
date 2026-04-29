#!/bin/bash
DECISION="$1"
L1_NAME="$2"
L1_CONTENT="$3"
L2_NAME="$4"
L2_CONTENT="$5"
L3_NAME="$6"
L3_CONTENT="$7"

python3 - "$DECISION" "$L1_NAME" "$L1_CONTENT" "$L2_NAME" "$L2_CONTENT" "$L3_NAME" "$L3_CONTENT" << 'PYEOF'
import sys, json, urllib.request

decision = sys.argv[1]
layers = []
i = 2
while i+1 < len(sys.argv) and sys.argv[i]:
    layers.append({"name": sys.argv[i], "content": sys.argv[i+1]})
    i += 2

layer_text = ""
for idx, l in enumerate(layers):
    layer_text += f"LAYER {idx+1} - {l['name'].upper()}\n{l['content']}\n\n---\n\n"

user_msg = f"DECISION: {decision}\n\n---\n\nEVIDENCE LAYERS:\n\n{layer_text}"

SYSTEM = "You are TAC-3D, a Decision Eligibility Screener. Evaluate decisions by analyzing structural compatibility across evidence layers using three dimensions: Tension, Alignment, Convergence.\n\nSCORING RULES:\nTENSION (starts at 100): Core assumptions contradict: -25. Incompatible timelines: -15. Unconfirmed premises: -12. Conflicting data: -10. Minor inconsistency: -5. Min 0.\nALIGNMENT (starts at 100): Different outcome pathways: -30. Inconsistent resources: -20. Success condition negates another: -18. Critical dependency missing: -15. Different priorities: -8. Min 0.\nCONVERGENCE (starts at 100): Holds in one scenario only: -28. Assumptions not stress-tested: -18. Sensitive to one external change: -15. Cross-time stability not evaluated: -12. Incomplete coverage: -6. Min 0.\nELIGIBILITY INDEX: (Tension x 0.35) + (Alignment x 0.40) + (Convergence x 0.25), rounded.\nVERDICTS: ELIGIBLE>=72, ELIGIBLE_WITH_CONDITIONS 48-71, DEFER 28-47, RESTRUCTURE<28.\n\nAlways return ONLY valid JSON: {\"scores\":{\"tension\":int,\"alignment\":int,\"convergence\":int,\"eligibility_index\":int},\"verdict\":string,\"verdict_summary\":string,\"tension_map\":[],\"alignment_gaps\":[],\"convergence_risks\":[],\"gap_inventory\":[],\"conditions\":[],\"structural_summary\":string,\"followup_question\":string}"

payload = json.dumps({
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 4000,
    "system": SYSTEM,
    "messages": [{"role": "user", "content": user_msg}],
    "qsw_input": {
        "decision": decision,
        "evidence_layers": layers
    }
}).encode()

req = urllib.request.Request(
    "https://tac3d.sycds.com/api/chat",
    data=payload,
    headers={
        "Content-Type": "application/json",
        "x-access-key": "TAC-TRIAL-927C-0471-41DE"
    }
)

with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read())

text = data["content"][0]["text"]
import re
match = re.search(r'\{[\s\S]*\}', text)
if match:
    result = json.loads(match.group(0))
    print(json.dumps(result, indent=2))
else:
    print(text)
PYEOF
