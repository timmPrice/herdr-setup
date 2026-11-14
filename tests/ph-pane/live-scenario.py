"""Build a ph-pane fake scenario on the REAL pane ids of the active tab, so `tools/fake.sh ph-pane <out> --install`
shows a different state in every visible header. Usage: herdr-app ls | python3 -I tests/ph-pane/live-scenario.py [calm] > out.json
States are dealt in order: focused RUN, WAIT, OK, IDLE, RUN with long names, SHELL, then repeat."""
import json, sys
ls = json.load(sys.stdin)
calm = "calm" in sys.argv[1:]
tab = next(t for s in ls["spaces"] if s.get("active") for t in s["tabs"] if t.get("active"))
H = "/home/timprice"
DEAL = [
    ("working", "claude", f"{H}/repos/herdr-neo-kyoto", "main"),
    ("blocked", "codex", f"{H}/repos/api-gateway", "feat/auth"),
    ("done", "claude", f"{H}/dotfiles", "main"),
    ("idle", "claude", f"{H}/repos/infra", "ops/k8s"),
    ("working", "opencode-experimental-build", f"{H}/repos/a/really/deeply/nested/monorepo/packages/web-portal-frontend", "feature/very-long-branch-name-for-elision-testing"),
    (None, "fish", f"{H}/repos/api-gateway", "feat/auth"),
]
agents, panes = [], []
for i, t in enumerate(tab["terminals"]):
    st, prog, cwd, br = DEAL[i % len(DEAL)]
    prog_o = {"key": prog, "name": prog, "agent": st is not None, "shell": st is None}
    panes.append({"pane": t["pane"], "terminal": t["terminal"], "tab": tab["id"], "cwd": cwd, "branch": br,
                  "status": st, "focused": i == 0, "program": prog_o})
    if st:
        agents.append({"address": t["terminal"], "pane": t["pane"], "status": st, "app": prog, "program": prog_o,
                       "title": f"fake {st}", "tab": tab["id"], "focused": i == 0})
mode = "calm" if calm else "full"
print(json.dumps({"agents": agents, "panes": panes, "props": {"intensity": mode}, "shared": {"ph.intensity": mode}}, indent=1))
