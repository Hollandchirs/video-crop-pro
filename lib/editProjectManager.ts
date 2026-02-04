import { EditProject, VideoClip } from "./types";

/**
 * Edit Project Manager
 * Handles saving, loading, and manipulating edit projects
 */

const PROJECT_STORAGE_KEY = "video-cropper-edit-projects";

/**
 * Save edit project to localStorage
 */
export function saveEditProject(project: EditProject, projectId: string): void {
  try {
    const projects = getAllProjects();
    projects[projectId] = {
      ...project,
      savedAt: Date.now(),
    };
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
    console.log("[EditProjectManager] Saved project:", projectId);
  } catch (error) {
    console.error("[EditProjectManager] Failed to save project:", error);
  }
}

/**
 * Load edit project from localStorage
 */
export function loadEditProject(projectId: string): EditProject | null {
  try {
    const projects = getAllProjects();
    const project = projects[projectId];
    if (project) {
      // Remove savedAt field as it's not part of EditProject type
      const { savedAt, ...projectData } = project as any;
      return projectData as EditProject;
    }
    return null;
  } catch (error) {
    console.error("[EditProjectManager] Failed to load project:", error);
    return null;
  }
}

/**
 * Get all saved projects
 */
export function getAllProjects(): Record<string, any> {
  try {
    const data = localStorage.getItem(PROJECT_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error("[EditProjectManager] Failed to get projects:", error);
    return {};
  }
}

/**
 * Delete edit project from localStorage
 */
export function deleteEditProject(projectId: string): void {
  try {
    const projects = getAllProjects();
    delete projects[projectId];
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
    console.log("[EditProjectManager] Deleted project:", projectId);
  } catch (error) {
    console.error("[EditProjectManager] Failed to delete project:", error);
  }
}

/**
 * Clear all saved projects
 */
export function clearAllProjects(): void {
  try {
    localStorage.removeItem(PROJECT_STORAGE_KEY);
    console.log("[EditProjectManager] Cleared all projects");
  } catch (error) {
    console.error("[EditProjectManager] Failed to clear projects:", error);
  }
}

/**
 * Get project statistics
 */
export function getProjectStats(project: EditProject): {
  totalClips: number;
  totalDuration: number;
  avgClipDuration: number;
  shortestClip: number;
  longestClip: number;
} {
  const totalClips = project.clips.length;
  const totalDuration = project.clips.reduce(
    (sum, clip) => sum + (clip.endTime - clip.startTime),
    0
  );
  const avgClipDuration = totalClips > 0 ? totalDuration / totalClips : 0;
  const clipDurations = project.clips.map(
    (clip) => clip.endTime - clip.startTime
  );
  const shortestClip =
    totalClips > 0 ? Math.min(...clipDurations) : 0;
  const longestClip =
    totalClips > 0 ? Math.max(...clipDurations) : 0;

  return {
    totalClips,
    totalDuration,
    avgClipDuration,
    shortestClip,
    longestClip,
  };
}

/**
 * Validate edit project
 */
export function validateProject(project: EditProject): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (project.clips.length === 0) {
    errors.push("Project has no clips");
  }

  // Check for overlapping clips
  for (let i = 0; i < project.clips.length - 1; i++) {
    const current = project.clips[i];
    const next = project.clips[i + 1];
    if (current.endTime > next.startTime) {
      errors.push(
        `Clips ${i} and ${i + 1} overlap: ${current.endTime} > ${next.startTime}`
      );
    }
  }

  // Check for gaps
  for (let i = 0; i < project.clips.length - 1; i++) {
    const current = project.clips[i];
    const next = project.clips[i + 1];
    const gap = next.startTime - current.endTime;
    if (gap > 0.1) {
      // More than 100ms gap
      errors.push(
        `Gap between clips ${i} and ${i + 1}: ${gap.toFixed(2)}s`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Optimize project by merging similar adjacent clips
 */
export function optimizeProject(
  project: EditProject,
  positionThreshold: number = 50
): EditProject {
  const optimizedClips: VideoClip[] = [];

  for (const clip of project.clips) {
    const lastClip = optimizedClips[optimizedClips.length - 1];

    if (!lastClip) {
      optimizedClips.push(clip);
      continue;
    }

    // Check if clips can be merged
    const positionDiff = Math.hypot(
      clip.cropPosition.x - lastClip.cropPosition.x,
      clip.cropPosition.y - lastClip.cropPosition.y
    );

    if (positionDiff < positionThreshold) {
      // Merge clips
      lastClip.endTime = clip.endTime;
    } else {
      optimizedClips.push(clip);
    }
  }

  return {
    ...project,
    clips: optimizedClips,
  };
}

/**
 * Export project as JSON (for backup/sharing)
 */
export function exportProjectAsJson(project: EditProject): string {
  return JSON.stringify(project, null, 2);
}

/**
 * Import project from JSON
 */
export function importProjectFromJson(json: string): EditProject | null {
  try {
    const project = JSON.parse(json) as EditProject;

    // Basic validation
    if (!project.clips || !Array.isArray(project.clips)) {
      throw new Error("Invalid project: missing or invalid clips array");
    }

    return project;
  } catch (error) {
    console.error("[EditProjectManager] Failed to import project:", error);
    return null;
  }
}
