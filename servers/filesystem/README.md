# MCP Filesystem Server

A secure Model Context Protocol (MCP) server that provides filesystem access and code execution capabilities within allowed directories.

## Features

- **Secure File Operations**: Read, write, edit, and manage files with strict access controls
- **Directory Management**: Create, list, and navigate directories
- **File Search**: Search for files and directories with pattern matching
- **File Metadata**: Get detailed information about files and directories
- **Code Execution**: Execute Python and Node.js scripts with controlled output capture

## Security

All operations are restricted to explicitly allowed directories specified at startup. The server validates all paths to prevent directory traversal attacks.

## Available Tools

### File Operations
- `read_file`: Read the complete contents of a file
- `read_multiple_files`: Read multiple files simultaneously
- `write_file`: Create or overwrite a file
- `edit_file`: Make line-based edits to text files

### Directory Operations
- `create_directory`: Create new directories
- `list_directory`: List contents of a directory
- `directory_tree`: Get a recursive tree view of directories
- `move_file`: Move or rename files and directories

### Search and Information
- `search_files`: Search for files matching patterns
- `get_file_info`: Get detailed file metadata
- `list_allowed_directories`: List directories the server can access

### Code Execution (New!)
- `execute_file`: Execute Python or Node.js scripts with the following features:
  - Automatic interpreter detection based on file extension
  - Capture of stdout and stderr streams
  - Exit code reporting
  - Command line argument support
  - Custom working directory support
  - Timeout protection (default 30 seconds)

## Usage

Start the server with allowed directories:

```bash
node index.js /path/to/allowed/directory [additional-directories...]
```

## Execute File Tool

The `execute_file` tool allows you to run Python and Node.js scripts safely:

### Parameters:
- `file`: Path to the script file to execute
- `args`: Optional array of command line arguments
- `interpreter`: 'python', 'node', or 'auto' (default: 'auto')
- `workingDirectory`: Optional working directory for execution
- `timeout`: Execution timeout in milliseconds (default: 30000)

### Example:
```javascript
{
  "name": "execute_file",
  "arguments": {
    "file": "/path/to/script.py",
    "args": ["arg1", "arg2"],
    "interpreter": "auto",
    "timeout": 60000
  }
}
```

The tool will return:
- stdout: Standard output from the script
- stderr: Standard error output from the script
- exitCode: Process exit code

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the TypeScript code:
   ```bash
   npm run build
   ```

3. Run the server:
   ```bash
   npm start -- /path/to/allowed/directory
   ```

## Development

To run in development mode with TypeScript compilation:
```bash
npm run dev -- /path/to/allowed/directory
```
