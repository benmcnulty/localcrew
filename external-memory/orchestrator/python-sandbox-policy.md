# Python Script Execution Sandbox Policy

This document defines the process by which agent identities may request execution of Python scripts they have authored. The sandbox exists to enable agents to perform data analysis, computation, file processing, and other structured operations that go beyond text generation — while maintaining strict safety boundaries.

## Overview

The sandbox is a **propose-review-approve-execute** pipeline:

1. An agent writes a Python script and proposes it for execution.
2. The orchestrator reviews the script using its strongest reasoning model.
3. If approved, the script runs in a restricted environment with defined inputs and outputs.
4. Results are captured and returned to the requesting agent's context.

## Script Submission Format

Agents propose scripts using a `SCRIPT_REQUEST` block in their task output:

```
SCRIPT_REQUEST[purpose-slug]
#!/usr/bin/env python3
"""
Purpose: <one-line description of what this script does>
Inputs: <what data it reads, if any>
Outputs: <what it produces — stdout, a file, a measurement>
Side effects: None
"""

# ... script body ...

print(result)
ENDSCRIPT
```

The `purpose-slug` is a kebab-case identifier (e.g., `latency-analysis`, `token-count-estimate`, `job-salary-parse`). It is used for audit logging and approval tracking.

## Script Requirements

Every proposed script MUST satisfy ALL of the following constraints:

### Allowed

- Pure computation: math, statistics, string processing, data transformation
- Reading from stdin or command-line arguments (data passed by the sandbox harness)
- Writing to stdout and stderr (captured by the sandbox harness)
- Using Python standard library modules only: `json`, `csv`, `math`, `statistics`, `re`, `datetime`, `collections`, `itertools`, `functools`, `textwrap`, `pathlib` (read-only), `urllib.parse`, `hashlib`, `base64`, `decimal`, `fractions`, `operator`, `string`, `difflib`, `pprint`, `dataclasses`, `typing`, `enum`, `abc`, `copy`, `io`, `argparse`
- Deterministic or pseudo-random behavior (using `random` with explicit seeds is allowed)

### Forbidden

- **No network access**: no `urllib.request`, `http.client`, `socket`, `requests`, `httpx`, or any network I/O
- **No file system writes**: no `open(..., 'w')`, no `os.makedirs`, no `shutil` operations that create or modify files
- **No file system reads outside sandbox**: scripts may only read files explicitly passed as arguments by the harness
- **No process execution**: no `subprocess`, `os.system`, `os.popen`, `os.exec*`, `pty`, `signal`
- **No imports of non-standard-library packages**: no pip packages, no compiled extensions
- **No `eval`, `exec`, `compile`, `__import__`**: no dynamic code execution
- **No infinite loops without bounded iteration**: all loops must have explicit upper bounds or operate on finite collections
- **No environment variable access**: no `os.environ`, `os.getenv`
- **No modification of sys.path, sys.modules, or interpreter state**

### Size Limits

- Maximum script length: 200 lines (excluding docstring and comments)
- Maximum execution time: 30 seconds
- Maximum stdout output: 64 KB
- Maximum memory: 256 MB (enforced by the sandbox harness)

## Orchestrator Review Process

When the orchestrator encounters a `SCRIPT_REQUEST` block, it performs a multi-step review before approval:

### Step 1: Static Analysis

The orchestrator reads the full script and checks:

- Does it contain any forbidden imports? (Check against the deny list above)
- Does it use any forbidden built-in functions (`eval`, `exec`, `compile`, `__import__`)?
- Does it open files for writing?
- Does it access network or subprocess APIs?
- Does it exceed the 200-line limit?
- Is the purpose docstring present and coherent?

If any check fails, the script is **rejected** with a specific reason logged to the audit trail.

### Step 2: Semantic Review

Using the strongest available reasoning model, the orchestrator evaluates:

- **Purpose validity**: Does the stated purpose align with a legitimate agent task? Is it something that text generation alone cannot accomplish?
- **Input/output coherence**: Are the declared inputs and outputs consistent with the script body?
- **Safety margin**: Even if no forbidden patterns are detected, does the script do anything unexpected or overly complex for its stated purpose?
- **Proportionality**: Is a script the right tool for this job, or could the same result be achieved with existing capabilities?

The orchestrator should approach this review with a "skeptical reviewer" mindset — the default disposition is to reject unless the script clearly passes all checks.

### Step 3: Approval Decision

The orchestrator emits one of:

- `SCRIPT_APPROVED[purpose-slug]` — the script may be executed
- `SCRIPT_REJECTED[purpose-slug]: <reason>` — the script is denied with explanation

Approved scripts are logged to the audit trail with scope `script.approved`. Rejected scripts are logged with scope `script.rejected`.

### Step 4: Re-submission

If rejected, the requesting agent may revise the script and re-submit in a subsequent task. The revision should address the specific rejection reason. An agent may re-submit a maximum of 2 times per purpose-slug per auto session. After 2 rejections, the purpose-slug is blocked for the remainder of the session.

## Execution Environment

Approved scripts are executed by the orchestrator node (or a designated execution resource) in a restricted environment:

### Sandbox Harness

```
python3 -c "
import sys, json, resource

# Set memory limit (256 MB)
resource.setrlimit(resource.RLIMIT_AS, (268435456, 268435456))

# Set CPU time limit (30 seconds)
resource.setrlimit(resource.RLIMIT_CPU, (30, 30))

# Execute the script file passed as argument
with open(sys.argv[1], 'r') as f:
    code = f.read()

# Additional safety: verify no forbidden imports at runtime
forbidden = ['subprocess', 'socket', 'http.client', 'urllib.request', 'shutil', 'os.system']
for mod in forbidden:
    if mod in code:
        print(f'BLOCKED: forbidden module reference: {mod}', file=sys.stderr)
        sys.exit(1)

exec(compile(code, sys.argv[1], 'exec'), {'__builtins__': __builtins__, '__name__': '__main__'})
"
```

Note: The harness above is illustrative. The actual implementation will be a dedicated sandbox module in the application layer, written as a feature request.

### Data Flow

1. The orchestrator writes the approved script to a temporary file in `.localcrew/system/sandbox/`
2. Input data (if any) is passed via stdin or as a JSON file argument
3. The script executes with the resource limits above
4. stdout is captured (up to 64 KB) as the script result
5. stderr is captured separately for diagnostics
6. The temporary script file is deleted after execution
7. Results are logged to the audit trail and returned to the requesting agent's context

## Approval Scope

- **One-time approval**: The default. The script runs once and the approval expires.
- **Session approval**: For scripts that need to run multiple times in the same auto session (e.g., a measurement script run after each task), the orchestrator may grant `SCRIPT_APPROVED_SESSION[purpose-slug]`. This allows re-execution without re-review for the duration of the current `/auto` session.
- **Persistent approval**: Reserved for future implementation. Would require user confirmation via `/approve-script <purpose-slug>` command.

## Audit Trail

All script-related events are logged:

- `script.proposed` — agent submitted a SCRIPT_REQUEST
- `script.approved` — orchestrator approved after review
- `script.rejected` — orchestrator rejected with reason
- `script.executed` — script ran successfully with output summary
- `script.failed` — script execution failed (timeout, error, resource limit)
- `script.blocked` — purpose-slug blocked after max re-submissions

## Integration with the Autonomous Loop

Script requests fit into **Phase 3: Implement**. An agent working on a task may propose a script when the task requires computation that cannot be accomplished through text generation alone.

Examples of legitimate script use cases:

- **Data analysis**: Parse telemetry JSON, compute statistics, identify trends
- **Token estimation**: Count tokens in a prompt using a simple tokenizer approximation
- **Format conversion**: Transform data between formats (CSV to JSON, markdown table extraction)
- **Measurement**: Calculate metrics from audit log data (average latency, error rates, throughput)
- **Text processing**: Extract structured data from unstructured text using regex patterns

Examples of illegitimate requests (should be rejected):

- Scripts that duplicate existing application capabilities
- Scripts that attempt to modify application state or configuration
- Scripts where the computation is trivial enough to express in natural language
- Scripts that serve no clear purpose for the current task

## Implementation Status

This policy document defines the sandbox design. The actual sandbox execution harness is **not yet implemented** in the application layer. Until implementation:

1. Agents should still propose scripts using `SCRIPT_REQUEST` blocks
2. The orchestrator should still perform the review process
3. Approved scripts should be logged but noted as "pending harness implementation"
4. Results should be approximated through text-based reasoning when possible
5. A feature request ticket should be filed for the sandbox harness implementation

This allows the review discipline and proposal format to mature before the execution capability goes live.
