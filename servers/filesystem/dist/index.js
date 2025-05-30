#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ToolSchema, } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import os from 'os';
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createTwoFilesPatch } from 'diff';
import { minimatch } from 'minimatch';
import { spawn } from 'child_process';
// Command line argument parsing
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error("Usage: mcp-server-filesystem <allowed-directory> [additional-directories...]");
    process.exit(1);
}
// Normalize all paths consistently
function normalizePath(p) {
    return path.normalize(p);
}
function expandHome(filepath) {
    if (filepath.startsWith('~/') || filepath === '~') {
        return path.join(os.homedir(), filepath.slice(1));
    }
    return filepath;
}
// Store allowed directories in normalized form
const allowedDirectories = args.map(dir => normalizePath(path.resolve(expandHome(dir))));
// Validate that all directories exist and are accessible
await Promise.all(args.map(async (dir) => {
    try {
        const stats = await fs.stat(expandHome(dir));
        if (!stats.isDirectory()) {
            console.error(`Error: ${dir} is not a directory`);
            process.exit(1);
        }
    }
    catch (error) {
        console.error(`Error accessing directory ${dir}:`, error);
        process.exit(1);
    }
}));
// Security utilities
async function validatePath(requestedPath) {
    const expandedPath = expandHome(requestedPath);
    const absolute = path.isAbsolute(expandedPath)
        ? path.resolve(expandedPath)
        : path.resolve(process.cwd(), expandedPath);
    const normalizedRequested = normalizePath(absolute);
    // Check if path is within allowed directories
    const isAllowed = allowedDirectories.some(dir => normalizedRequested.startsWith(dir));
    if (!isAllowed) {
        throw new Error(`Access denied - path outside allowed directories: ${absolute} not in ${allowedDirectories.join(', ')}`);
    }
    // Handle symlinks by checking their real path
    try {
        const realPath = await fs.realpath(absolute);
        const normalizedReal = normalizePath(realPath);
        const isRealPathAllowed = allowedDirectories.some(dir => normalizedReal.startsWith(dir));
        if (!isRealPathAllowed) {
            throw new Error("Access denied - symlink target outside allowed directories");
        }
        return realPath;
    }
    catch (error) {
        // For new files that don't exist yet, verify parent directory
        const parentDir = path.dirname(absolute);
        try {
            const realParentPath = await fs.realpath(parentDir);
            const normalizedParent = normalizePath(realParentPath);
            const isParentAllowed = allowedDirectories.some(dir => normalizedParent.startsWith(dir));
            if (!isParentAllowed) {
                throw new Error("Access denied - parent directory outside allowed directories");
            }
            return absolute;
        }
        catch {
            throw new Error(`Parent directory does not exist: ${parentDir}`);
        }
    }
}
// Schema definitions
const ReadFileArgsSchema = z.object({
    path: z.string(),
});
const ReadMultipleFilesArgsSchema = z.object({
    paths: z.array(z.string()),
});
const WriteFileArgsSchema = z.object({
    path: z.string(),
    content: z.string(),
});
const EditFileArgsSchema = z.object({
    path: z.string(),
    edits: z.array(z.object({
        oldText: z.string().describe('Text to search for - must match exactly'),
        newText: z.string().describe('Text to replace with')
    })),
    dryRun: z.boolean().default(false).describe('Preview changes using git-style diff format')
});
const CreateDirectoryArgsSchema = z.object({
    path: z.string(),
});
const ListDirectoryArgsSchema = z.object({
    path: z.string(),
});
const DirectoryTreeArgsSchema = z.object({
    path: z.string(),
});
const MoveFileArgsSchema = z.object({
    source: z.string(),
    destination: z.string(),
});
const SearchFilesArgsSchema = z.object({
    path: z.string(),
    pattern: z.string(),
    excludePatterns: z.array(z.string()).optional().default([])
});
const GetFileInfoArgsSchema = z.object({
    path: z.string(),
});
const ExecuteFileArgsSchema = z.object({
    file: z.string(),
    args: z.array(z.string()).optional().default([]),
    interpreter: z.enum(['python', 'node', 'auto']).optional().default('auto'),
    workingDirectory: z.string().optional(),
    timeout: z.number().optional().default(30000) // 30 seconds default timeout
});
const ExecutePackageManagerArgsSchema = z.object({
    command: z.enum(['npm', 'pip', 'pip3']),
    args: z.array(z.string()),
    workingDirectory: z.string().optional(),
    timeout: z.number().optional().default(60000) // 60 seconds default timeout for package operations
});
const ToolInputSchema = ToolSchema.shape.inputSchema;
// Server setup
const server = new Server({
    name: "secure-filesystem-server",
    version: "0.2.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Tool implementations
async function getFileStats(filePath) {
    const stats = await fs.stat(filePath);
    return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        permissions: stats.mode.toString(8).slice(-3),
    };
}
async function searchFiles(rootPath, pattern, excludePatterns = []) {
    const results = [];
    async function search(currentPath) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            try {
                // Validate each path before processing
                await validatePath(fullPath);
                // Check if path matches any exclude pattern
                const relativePath = path.relative(rootPath, fullPath);
                const shouldExclude = excludePatterns.some(pattern => {
                    const globPattern = pattern.includes('*') ? pattern : `**/${pattern}/**`;
                    return minimatch(relativePath, globPattern, { dot: true });
                });
                if (shouldExclude) {
                    continue;
                }
                if (entry.name.toLowerCase().includes(pattern.toLowerCase())) {
                    results.push(fullPath);
                }
                if (entry.isDirectory()) {
                    await search(fullPath);
                }
            }
            catch (error) {
                // Skip invalid paths during search
                continue;
            }
        }
    }
    await search(rootPath);
    return results;
}
// file editing and diffing utilities
function normalizeLineEndings(text) {
    return text.replace(/\r\n/g, '\n');
}
function createUnifiedDiff(originalContent, newContent, filepath = 'file') {
    // Ensure consistent line endings for diff
    const normalizedOriginal = normalizeLineEndings(originalContent);
    const normalizedNew = normalizeLineEndings(newContent);
    return createTwoFilesPatch(filepath, filepath, normalizedOriginal, normalizedNew, 'original', 'modified');
}
async function applyFileEdits(filePath, edits, dryRun = false) {
    // Read file content and normalize line endings
    const content = normalizeLineEndings(await fs.readFile(filePath, 'utf-8'));
    // Apply edits sequentially
    let modifiedContent = content;
    for (const edit of edits) {
        const normalizedOld = normalizeLineEndings(edit.oldText);
        const normalizedNew = normalizeLineEndings(edit.newText);
        // If exact match exists, use it
        if (modifiedContent.includes(normalizedOld)) {
            modifiedContent = modifiedContent.replace(normalizedOld, normalizedNew);
            continue;
        }
        // Otherwise, try line-by-line matching with flexibility for whitespace
        const oldLines = normalizedOld.split('\n');
        const contentLines = modifiedContent.split('\n');
        let matchFound = false;
        for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
            const potentialMatch = contentLines.slice(i, i + oldLines.length);
            // Compare lines with normalized whitespace
            const isMatch = oldLines.every((oldLine, j) => {
                const contentLine = potentialMatch[j];
                return oldLine.trim() === contentLine.trim();
            });
            if (isMatch) {
                // Preserve original indentation of first line
                const originalIndent = contentLines[i].match(/^\s*/)?.[0] || '';
                const newLines = normalizedNew.split('\n').map((line, j) => {
                    if (j === 0)
                        return originalIndent + line.trimStart();
                    // For subsequent lines, try to preserve relative indentation
                    const oldIndent = oldLines[j]?.match(/^\s*/)?.[0] || '';
                    const newIndent = line.match(/^\s*/)?.[0] || '';
                    if (oldIndent && newIndent) {
                        const relativeIndent = newIndent.length - oldIndent.length;
                        return originalIndent + ' '.repeat(Math.max(0, relativeIndent)) + line.trimStart();
                    }
                    return line;
                });
                contentLines.splice(i, oldLines.length, ...newLines);
                modifiedContent = contentLines.join('\n');
                matchFound = true;
                break;
            }
        }
        if (!matchFound) {
            throw new Error(`Could not find exact match for edit:\n${edit.oldText}`);
        }
    }
    // Create unified diff
    const diff = createUnifiedDiff(content, modifiedContent, filePath);
    // Format diff with appropriate number of backticks
    let numBackticks = 3;
    while (diff.includes('`'.repeat(numBackticks))) {
        numBackticks++;
    }
    const formattedDiff = `${'`'.repeat(numBackticks)}diff\n${diff}${'`'.repeat(numBackticks)}\n\n`;
    if (!dryRun) {
        await fs.writeFile(filePath, modifiedContent, 'utf-8');
    }
    return formattedDiff;
}
// Execute file utility
async function executeFile(filePath, args = [], interpreter = 'auto', workingDirectory, timeout = 30000) {
    // Validate the file path
    const validPath = await validatePath(filePath);
    // Determine interpreter based on file extension if auto
    let command;
    if (interpreter === 'auto') {
        const ext = path.extname(validPath).toLowerCase();
        switch (ext) {
            case '.py':
                command = 'python3';
                break;
            case '.js':
            case '.mjs':
                command = 'node';
                break;
            default:
                throw new Error(`Cannot auto-detect interpreter for file extension ${ext}. Please specify interpreter explicitly.`);
        }
    }
    else {
        command = interpreter === 'python' ? 'python3' : 'node';
    }
    // Validate working directory if provided
    let cwd = process.cwd();
    if (workingDirectory) {
        cwd = await validatePath(workingDirectory);
        const stats = await fs.stat(cwd);
        if (!stats.isDirectory()) {
            throw new Error('Working directory must be a directory');
        }
    }
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        let processKilled = false;
        const child = spawn(command, [validPath, ...args], {
            cwd,
            shell: false
        });
        // Set up timeout
        const timeoutId = setTimeout(() => {
            processKilled = true;
            child.kill('SIGTERM');
            setTimeout(() => {
                if (!child.killed) {
                    child.kill('SIGKILL');
                }
            }, 1000);
        }, timeout);
        // Handle stdout
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        // Handle stderr
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        // Handle completion
        child.on('close', (code) => {
            clearTimeout(timeoutId);
            if (processKilled) {
                reject(new Error(`Process timed out after ${timeout}ms`));
            }
            else {
                resolve({
                    stdout,
                    stderr,
                    exitCode: code
                });
            }
        });
        // Handle errors
        child.on('error', (error) => {
            clearTimeout(timeoutId);
            reject(error);
        });
    });
}
// Execute package manager utility
async function executePackageManager(command, args = [], workingDirectory, timeout = 60000) {
    // Validate working directory if provided
    let cwd = process.cwd();
    if (workingDirectory) {
        cwd = await validatePath(workingDirectory);
        const stats = await fs.stat(cwd);
        if (!stats.isDirectory()) {
            throw new Error('Working directory must be a directory');
        }
    }
    // Allow only safe npm and pip commands
    const allowedNpmCommands = ['install', 'uninstall', 'list', 'ls', 'outdated', 'view', 'search', 'update', 'audit', 'init', 'run', 'test', 'start', 'build'];
    const allowedPipCommands = ['install', 'uninstall', 'list', 'show', 'search', 'freeze', 'check'];
    if (args.length === 0) {
        throw new Error('No command arguments provided');
    }
    const subCommand = args[0];
    if (command === 'npm' && !allowedNpmCommands.includes(subCommand)) {
        throw new Error(`npm command '${subCommand}' is not allowed. Allowed commands: ${allowedNpmCommands.join(', ')}`);
    }
    if ((command === 'pip' || command === 'pip3') && !allowedPipCommands.includes(subCommand)) {
        throw new Error(`pip command '${subCommand}' is not allowed. Allowed commands: ${allowedPipCommands.join(', ')}`);
    }
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        let processKilled = false;
        const child = spawn(command, args, {
            cwd,
            shell: false,
            env: { ...process.env, NODE_ENV: 'production' }
        });
        // Set up timeout
        const timeoutId = setTimeout(() => {
            processKilled = true;
            child.kill('SIGTERM');
            setTimeout(() => {
                if (!child.killed) {
                    child.kill('SIGKILL');
                }
            }, 1000);
        }, timeout);
        // Handle stdout
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        // Handle stderr
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        // Handle completion
        child.on('close', (code) => {
            clearTimeout(timeoutId);
            if (processKilled) {
                reject(new Error(`Process timed out after ${timeout}ms`));
            }
            else {
                resolve({
                    stdout,
                    stderr,
                    exitCode: code
                });
            }
        });
        // Handle errors
        child.on('error', (error) => {
            clearTimeout(timeoutId);
            reject(error);
        });
    });
}
// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "read_file",
                description: "Read the complete contents of a file from the file system. " +
                    "Handles various text encodings and provides detailed error messages " +
                    "if the file cannot be read. Use this tool when you need to examine " +
                    "the contents of a single file. Only works within allowed directories.",
                inputSchema: zodToJsonSchema(ReadFileArgsSchema),
            },
            {
                name: "read_multiple_files",
                description: "Read the contents of multiple files simultaneously. This is more " +
                    "efficient than reading files one by one when you need to analyze " +
                    "or compare multiple files. Each file's content is returned with its " +
                    "path as a reference. Failed reads for individual files won't stop " +
                    "the entire operation. Only works within allowed directories.",
                inputSchema: zodToJsonSchema(ReadMultipleFilesArgsSchema),
            },
            {
                name: "write_file",
                description: "Create a new file or completely overwrite an existing file with new content. " +
                    "Use with caution as it will overwrite existing files without warning. " +
                    "Handles text content with proper encoding. Only works within allowed directories.",
                inputSchema: zodToJsonSchema(WriteFileArgsSchema),
            },
            {
                name: "edit_file",
                description: "Make line-based edits to a text file. Each edit replaces exact line sequences " +
                    "with new content. Returns a git-style diff showing the changes made. " +
                    "Only works within allowed directories.",
                inputSchema: zodToJsonSchema(EditFileArgsSchema),
            },
            {
                name: "create_directory",
                description: "Create a new directory or ensure a directory exists. Can create multiple " +
                    "nested directories in one operation. If the directory already exists, " +
                    "this operation will succeed silently. Perfect for setting up directory " +
                    "structures for projects or ensuring required paths exist. Only works within allowed directories.",
                inputSchema: zodToJsonSchema(CreateDirectoryArgsSchema),
            },
            {
                name: "list_directory",
                description: "Get a detailed listing of all files and directories in a specified path. " +
                    "Results clearly distinguish between files and directories with [FILE] and [DIR] " +
                    "prefixes. This tool is essential for understanding directory structure and " +
                    "finding specific files within a directory. Only works within allowed directories.",
                inputSchema: zodToJsonSchema(ListDirectoryArgsSchema),
            },
            {
                name: "directory_tree",
                description: "Get a recursive tree view of files and directories as a JSON structure. " +
                    "Each entry includes 'name', 'type' (file/directory), and 'children' for directories. " +
                    "Files have no children array, while directories always have a children array (which may be empty). " +
                    "The output is formatted with 2-space indentation for readability. Only works within allowed directories.",
                inputSchema: zodToJsonSchema(DirectoryTreeArgsSchema),
            },
            {
                name: "move_file",
                description: "Move or rename files and directories. Can move files between directories " +
                    "and rename them in a single operation. If the destination exists, the " +
                    "operation will fail. Works across different directories and can be used " +
                    "for simple renaming within the same directory. Both source and destination must be within allowed directories.",
                inputSchema: zodToJsonSchema(MoveFileArgsSchema),
            },
            {
                name: "search_files",
                description: "Recursively search for files and directories matching a pattern. " +
                    "Searches through all subdirectories from the starting path. The search " +
                    "is case-insensitive and matches partial names. Returns full paths to all " +
                    "matching items. Great for finding files when you don't know their exact location. " +
                    "Only searches within allowed directories.",
                inputSchema: zodToJsonSchema(SearchFilesArgsSchema),
            },
            {
                name: "get_file_info",
                description: "Retrieve detailed metadata about a file or directory. Returns comprehensive " +
                    "information including size, creation time, last modified time, permissions, " +
                    "and type. This tool is perfect for understanding file characteristics " +
                    "without reading the actual content. Only works within allowed directories.",
                inputSchema: zodToJsonSchema(GetFileInfoArgsSchema),
            },
            {
                name: "list_allowed_directories",
                description: "Returns the list of directories that this server is allowed to access. " +
                    "Use this to understand which directories are available before trying to access files.",
                inputSchema: {
                    type: "object",
                    properties: {},
                    required: [],
                },
            },
            {
                name: "execute_file",
                description: "Execute a Python or Node.js script file and capture its output. " +
                    "Automatically detects interpreter based on file extension (.py for Python, .js/.mjs for Node.js) " +
                    "or you can explicitly specify the interpreter. Captures both stdout and stderr streams, " +
                    "and provides the exit code. Supports passing command line arguments and setting a custom working directory. " +
                    "Files must be within allowed directories. Includes timeout protection (default 30 seconds).",
                inputSchema: zodToJsonSchema(ExecuteFileArgsSchema),
            },
            {
                name: "execute_package_manager",
                description: "Execute npm or pip package manager commands safely. " +
                    "Supports common package operations like install, uninstall, list, etc. " +
                    "Captures both stdout and stderr streams and provides the exit code. " +
                    "Allows setting a custom working directory for the operation. " +
                    "Package installations are performed in the specified directory. " +
                    "Includes timeout protection (default 60 seconds).",
                inputSchema: zodToJsonSchema(ExecutePackageManagerArgsSchema),
            },
        ],
    };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const { name, arguments: args } = request.params;
        switch (name) {
            case "read_file": {
                const parsed = ReadFileArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for read_file: ${parsed.error}`);
                }
                const validPath = await validatePath(parsed.data.path);
                const content = await fs.readFile(validPath, "utf-8");
                return {
                    content: [{ type: "text", text: content }],
                };
            }
            case "read_multiple_files": {
                const parsed = ReadMultipleFilesArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for read_multiple_files: ${parsed.error}`);
                }
                const results = await Promise.all(parsed.data.paths.map(async (filePath) => {
                    try {
                        const validPath = await validatePath(filePath);
                        const content = await fs.readFile(validPath, "utf-8");
                        return `${filePath}:\n${content}\n`;
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        return `${filePath}: Error - ${errorMessage}`;
                    }
                }));
                return {
                    content: [{ type: "text", text: results.join("\n---\n") }],
                };
            }
            case "write_file": {
                const parsed = WriteFileArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for write_file: ${parsed.error}`);
                }
                const validPath = await validatePath(parsed.data.path);
                await fs.writeFile(validPath, parsed.data.content, "utf-8");
                return {
                    content: [{ type: "text", text: `Successfully wrote to ${parsed.data.path}` }],
                };
            }
            case "edit_file": {
                const parsed = EditFileArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for edit_file: ${parsed.error}`);
                }
                const validPath = await validatePath(parsed.data.path);
                // Extract the edits as properly typed array
                const edits = parsed.data.edits.map(edit => ({
                    oldText: edit.oldText,
                    newText: edit.newText
                }));
                const result = await applyFileEdits(validPath, edits, parsed.data.dryRun);
                return {
                    content: [{ type: "text", text: result }],
                };
            }
            case "create_directory": {
                const parsed = CreateDirectoryArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for create_directory: ${parsed.error}`);
                }
                const validPath = await validatePath(parsed.data.path);
                await fs.mkdir(validPath, { recursive: true });
                return {
                    content: [{ type: "text", text: `Successfully created directory ${parsed.data.path}` }],
                };
            }
            case "list_directory": {
                const parsed = ListDirectoryArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for list_directory: ${parsed.error}`);
                }
                const validPath = await validatePath(parsed.data.path);
                const entries = await fs.readdir(validPath, { withFileTypes: true });
                const formatted = entries
                    .map((entry) => `${entry.isDirectory() ? "[DIR]" : "[FILE]"} ${entry.name}`)
                    .join("\n");
                return {
                    content: [{ type: "text", text: formatted }],
                };
            }
            case "directory_tree": {
                const parsed = DirectoryTreeArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for directory_tree: ${parsed.error}`);
                }
                async function buildTree(currentPath) {
                    const validPath = await validatePath(currentPath);
                    const entries = await fs.readdir(validPath, { withFileTypes: true });
                    const result = [];
                    for (const entry of entries) {
                        const entryData = {
                            name: entry.name,
                            type: entry.isDirectory() ? 'directory' : 'file'
                        };
                        if (entry.isDirectory()) {
                            const subPath = path.join(currentPath, entry.name);
                            entryData.children = await buildTree(subPath);
                        }
                        result.push(entryData);
                    }
                    return result;
                }
                const treeData = await buildTree(parsed.data.path);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify(treeData, null, 2)
                        }],
                };
            }
            case "move_file": {
                const parsed = MoveFileArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for move_file: ${parsed.error}`);
                }
                const validSourcePath = await validatePath(parsed.data.source);
                const validDestPath = await validatePath(parsed.data.destination);
                await fs.rename(validSourcePath, validDestPath);
                return {
                    content: [{ type: "text", text: `Successfully moved ${parsed.data.source} to ${parsed.data.destination}` }],
                };
            }
            case "search_files": {
                const parsed = SearchFilesArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for search_files: ${parsed.error}`);
                }
                const validPath = await validatePath(parsed.data.path);
                const results = await searchFiles(validPath, parsed.data.pattern, parsed.data.excludePatterns);
                return {
                    content: [{ type: "text", text: results.length > 0 ? results.join("\n") : "No matches found" }],
                };
            }
            case "get_file_info": {
                const parsed = GetFileInfoArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for get_file_info: ${parsed.error}`);
                }
                const validPath = await validatePath(parsed.data.path);
                const info = await getFileStats(validPath);
                return {
                    content: [{ type: "text", text: Object.entries(info)
                                .map(([key, value]) => `${key}: ${value}`)
                                .join("\n") }],
                };
            }
            case "list_allowed_directories": {
                return {
                    content: [{
                            type: "text",
                            text: `Allowed directories:\n${allowedDirectories.join('\n')}`
                        }],
                };
            }
            case "execute_file": {
                const parsed = ExecuteFileArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for execute_file: ${parsed.error}`);
                }
                const result = await executeFile(parsed.data.file, parsed.data.args, parsed.data.interpreter, parsed.data.workingDirectory, parsed.data.timeout);
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
            case "execute_package_manager": {
                const parsed = ExecutePackageManagerArgsSchema.safeParse(args);
                if (!parsed.success) {
                    throw new Error(`Invalid arguments for execute_package_manager: ${parsed.error}`);
                }
                const result = await executePackageManager(parsed.data.command, parsed.data.args, parsed.data.workingDirectory, parsed.data.timeout);
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
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${errorMessage}` }],
            isError: true,
        };
    }
});
// Start server
async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Secure MCP Filesystem Server running on stdio");
    console.error("Allowed directories:", allowedDirectories);
}
runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});
