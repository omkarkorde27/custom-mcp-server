# MCP Filesystem Server - Extended with Code Execution

This document outlines the modifications made to the original MCP Filesystem Server to add code execution capabilities.

## Overview

We extended the MCP (Model Context Protocol) Filesystem Server to include a new tool called `execute_file` that allows for safe execution of Python and Node.js scripts within the allowed directories. This enhancement enables the server to not only manage files but also run code and capture its output.

## What's New

### Execute File Tool

The `execute_file` tool provides the following capabilities:

- **Execute Python and Node.js scripts** with controlled execution environment
- **Automatic interpreter detection** based on file extensions (.py, .js, .mjs)
- **Capture output streams** (stdout and stderr) separately
- **Exit code reporting** for process status
- **Command-line argument support** for passing parameters to scripts
- **Custom working directory** option for execution context
- **Timeout protection** (default 30 seconds) to prevent runaway processes
- **Security validation** ensuring scripts are within allowed directories

## Implementation Details

### 1. Added Dependencies

We imported additional Node.js modules:
```typescript
import { spawn } from 'child_process';
import { promisify } from 'util';
import type { ChildProcessWithoutNullStreams } from 'child_process';
```

### 2. Created Schema for Execute File Arguments

```typescript
const ExecuteFileArgsSchema = z.object({
  file: z.string(),
  args: z.array(z.string()).optional().default([]),
  interpreter: z.enum(['python', 'node', 'auto']).optional().default('auto'),
  workingDirectory: z.string().optional(),
  timeout: z.number().optional().default(30000) // 30 seconds default timeout
});
```

### 3. Implemented Execute File Function

The `executeFile` function:
- Validates file paths against allowed directories
- Automatically detects the appropriate interpreter
- Spawns a child process with proper configuration
- Implements timeout handling with graceful shutdown
- Captures output streams and exit codes
- Returns structured execution results

### 4. Added Tool to Available Tools List

The new tool was registered with a comprehensive description:
```typescript
{
  name: "execute_file",
  description:
    "Execute a Python or Node.js script file and capture its output. " +
    "Automatically detects interpreter based on file extension (.py for Python, .js/.mjs for Node.js) " +
    "or you can explicitly specify the interpreter. Captures both stdout and stderr streams, " +
    "and provides the exit code. Supports passing command line arguments and setting a custom working directory. " +
    "Files must be within allowed directories. Includes timeout protection (default 30 seconds).",
  inputSchema: zodToJsonSchema(ExecuteFileArgsSchema) as ToolInput,
}
```

### 5. Added Case Handler

The tool request handler was extended to handle the `execute_file` case:
```typescript
case "execute_file": {
  const parsed = ExecuteFileArgsSchema.safeParse(args);
  if (!parsed.success) {
    throw new Error(`Invalid arguments for execute_file: ${parsed.error}`);
  }
  const result = await executeFile(
    parsed.data.file,
    parsed.data.args,
    parsed.data.interpreter,
    parsed.data.workingDirectory,
    parsed.data.timeout
  );
  
  let output = '';
  if (result.stdout) {
    output += 'STDOUT:\n' + result.stdout;
  }
  if (result.stderr) {
    output += (output ? '\n\n' : '') + 'STDERR:\n' + result.stderr;
  }
  output += `\n\nExit code: ${result.exitCode}`;
  
  return {
    content: [{ type: "text", text: output }],
  };
}
```

## TypeScript Error Resolution

During development, we encountered a TypeScript type mismatch error with the `edit_file` tool. We resolved this by:

1. Adding a proper `FileEdit` type definition:
```typescript
type FileEdit = {
  oldText: string;
  newText: string;
};
```

2. Updating the `applyFileEdits` function to use this type
3. Properly mapping parsed data to the FileEdit type in the case handler

## Security Considerations

The execute_file tool maintains the same security model as other filesystem operations:

- All file paths are validated against the allowed directories
- Working directories (if specified) must also be within allowed paths
- Timeout protection prevents runaway processes
- Process cleanup is handled properly with SIGTERM/SIGKILL signals

## Usage Examples

### Basic execution
```json
{
  "name": "execute_file",
  "arguments": {
    "file": "/path/to/script.py"
  }
}
```

### With arguments and custom timeout
```json
{
  "name": "execute_file",
  "arguments": {
    "file": "/path/to/script.js",
    "args": ["arg1", "arg2"],
    "timeout": 60000
  }
}
```

### With explicit interpreter and working directory
```json
{
  "name": "execute_file",
  "arguments": {
    "file": "/path/to/script.py",
    "interpreter": "python",
    "workingDirectory": "/path/to/work/dir"
  }
}
```

## Testing

Created test files to verify functionality:
- `test_execute.js` - Node.js test script
- `demo_script.py` - Python demonstration script
- `math.py` - Simple Python addition script

## Building and Running

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the TypeScript code:
   ```bash
   npm run build
   ```

3. Run the server with allowed directories:
   ```bash
   node dist/index.js /path/to/allowed/directory
   ```

## Conclusion

The execute_file tool significantly extends the capabilities of the MCP Filesystem Server, allowing it to not only manage files but also execute code in a controlled, secure environment. This makes it suitable for use cases requiring both file management and code execution, such as development tools, automated testing, or educational platforms.
