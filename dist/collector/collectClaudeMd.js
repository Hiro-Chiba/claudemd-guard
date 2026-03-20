"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectClaudeMd = collectClaudeMd;
const fs_1 = require("fs");
const path_1 = require("path");
const EXCLUDED_DIRS = new Set([
    'node_modules',
    '.git',
    'target',
    '.venv',
    'vendor',
    '__pycache__',
    'dist',
    'build',
]);
const MAX_DEPTH = 3;
function collectClaudeMd(cwd) {
    const upward = collectUpward(cwd);
    const downward = collectDownward(cwd);
    // Deduplicate: upward already includes cwd/CLAUDE.md
    const upwardPaths = new Set(upward.map((f) => f.path));
    const combined = [
        ...upward,
        ...downward.filter((f) => !upwardPaths.has(f.path)),
    ];
    return combined;
}
function collectUpward(cwd) {
    const files = [];
    let dir = cwd;
    while (true) {
        const claudeMdPath = (0, path_1.join)(dir, 'CLAUDE.md');
        const content = readFileSafe(claudeMdPath);
        if (content !== null) {
            files.push({ path: claudeMdPath, content });
        }
        const parent = (0, path_1.dirname)(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return files;
}
function collectDownward(cwd) {
    const files = [];
    walkDir(cwd, 0, files);
    return files;
}
function walkDir(dir, depth, files) {
    if (depth > MAX_DEPTH)
        return;
    let entries;
    try {
        entries = (0, fs_1.readdirSync)(dir);
    }
    catch {
        return;
    }
    for (const entry of entries) {
        if (EXCLUDED_DIRS.has(entry))
            continue;
        const fullPath = (0, path_1.join)(dir, entry);
        if (entry === 'CLAUDE.md') {
            const content = readFileSafe(fullPath);
            if (content !== null) {
                files.push({ path: fullPath, content });
            }
            continue;
        }
        try {
            if ((0, fs_1.statSync)(fullPath).isDirectory()) {
                walkDir(fullPath, depth + 1, files);
            }
        }
        catch {
            // Skip inaccessible entries
        }
    }
}
function readFileSafe(filePath) {
    try {
        return (0, fs_1.readFileSync)(filePath, 'utf-8');
    }
    catch {
        return null;
    }
}
