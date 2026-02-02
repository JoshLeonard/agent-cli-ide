import type { PendingFileChange, FileChangeType } from '../../../shared/types/fileReview';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  changeType?: FileChangeType;
  changeIndex?: number; // Index in original flat array
  children?: FileTreeNode[];
  fileCount?: number; // For folders: count of changed files in subtree
  reviewed?: boolean;
}

/**
 * Builds a pruned tree structure from a flat list of file changes.
 * Only folders containing changed files are included.
 */
export function buildFileTree(changes: PendingFileChange[]): FileTreeNode[] {
  const root: Map<string, FileTreeNode> = new Map();

  // Process each file change
  changes.forEach((change, index) => {
    const parts = change.filePath.split('/').filter(Boolean);
    let currentLevel = root;
    let currentPath = '';

    // Process each path segment
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (isFile) {
        // This is the file node
        const fileNode: FileTreeNode = {
          name: part,
          path: change.filePath,
          type: 'file',
          changeType: change.changeType,
          changeIndex: index,
          reviewed: change.reviewed,
        };
        currentLevel.set(part, fileNode);
      } else {
        // This is a folder node
        if (!currentLevel.has(part)) {
          const folderNode: FileTreeNode = {
            name: part,
            path: currentPath,
            type: 'folder',
            children: [],
            fileCount: 0,
          };
          currentLevel.set(part, folderNode);
        }

        const folderNode = currentLevel.get(part)!;
        if (!folderNode.children) {
          folderNode.children = [];
        }

        // Move to next level - convert children array to Map for processing
        const childMap = new Map<string, FileTreeNode>();
        folderNode.children.forEach(child => childMap.set(child.name, child));
        currentLevel = childMap;

        // Update the folder's children with the map
        folderNode.children = Array.from(childMap.values());
      }
    }
  });

  // Convert root map to array and sort
  const rootNodes = Array.from(root.values());

  // Recursively process and calculate file counts
  const processNode = (node: FileTreeNode): number => {
    if (node.type === 'file') {
      return 1;
    }

    if (node.children && node.children.length > 0) {
      let count = 0;
      node.children.forEach(child => {
        count += processNode(child);
      });
      node.fileCount = count;
      // Sort children: folders first, then files, alphabetically within each group
      node.children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      return count;
    }

    return 0;
  };

  // Rebuild tree properly with nested structure
  const rebuildTree = (changes: PendingFileChange[]): FileTreeNode[] => {
    const tree: FileTreeNode[] = [];
    const folderMap = new Map<string, FileTreeNode>();

    changes.forEach((change, index) => {
      const parts = change.filePath.split('/').filter(Boolean);

      // Handle root-level files
      if (parts.length === 1) {
        tree.push({
          name: parts[0],
          path: change.filePath,
          type: 'file',
          changeType: change.changeType,
          changeIndex: index,
          reviewed: change.reviewed,
        });
        return;
      }

      // Build folder structure
      let currentPath = '';
      let currentChildren = tree;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        let folder = folderMap.get(currentPath);
        if (!folder) {
          folder = {
            name: part,
            path: currentPath,
            type: 'folder',
            children: [],
            fileCount: 0,
          };
          folderMap.set(currentPath, folder);
          currentChildren.push(folder);
        }

        currentChildren = folder.children!;
      }

      // Add the file to the deepest folder
      const fileName = parts[parts.length - 1];
      currentChildren.push({
        name: fileName,
        path: change.filePath,
        type: 'file',
        changeType: change.changeType,
        changeIndex: index,
        reviewed: change.reviewed,
      });
    });

    return tree;
  };

  const treeNodes = rebuildTree(changes);

  // Process all nodes to calculate counts and sort
  treeNodes.forEach(processNode);

  // Sort root level: folders first, then files
  treeNodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return treeNodes;
}

/**
 * Get all folder paths that should be expanded by default.
 * Expands all folders for small trees, or top-level only for large trees.
 */
export function getDefaultExpandedPaths(tree: FileTreeNode[], threshold = 15): Set<string> {
  const expanded = new Set<string>();

  const collectAllFolders = (nodes: FileTreeNode[]) => {
    nodes.forEach(node => {
      if (node.type === 'folder') {
        expanded.add(node.path);
        if (node.children) {
          collectAllFolders(node.children);
        }
      }
    });
  };

  const collectTopLevelFolders = (nodes: FileTreeNode[]) => {
    nodes.forEach(node => {
      if (node.type === 'folder') {
        expanded.add(node.path);
      }
    });
  };

  // Count total nodes
  const countNodes = (nodes: FileTreeNode[]): number => {
    return nodes.reduce((count, node) => {
      return count + 1 + (node.children ? countNodes(node.children) : 0);
    }, 0);
  };

  const totalNodes = countNodes(tree);

  if (totalNodes <= threshold) {
    // Small tree: expand all
    collectAllFolders(tree);
  } else {
    // Large tree: expand only top level
    collectTopLevelFolders(tree);
  }

  return expanded;
}
