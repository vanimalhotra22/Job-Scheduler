import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

// Organizations
export async function createOrganization(req: AuthenticatedRequest, res: Response) {
  try {
    const { name } = req.body;
    const userId = req.user?.userId;

    if (!name) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    const db = await getDb();
    const orgId = uuidv4();
    await db.run(
      `INSERT INTO Organizations (id, name, owner_id) VALUES (?, ?, ?)`,
      orgId, name, userId
    );

    return res.status(201).json({ id: orgId, name, owner_id: userId });
  } catch (error) {
    console.error('Error creating organization:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getOrganizations(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const db = await getDb();
    const orgs = await db.all('SELECT * FROM Organizations WHERE owner_id = ?', userId);
    return res.status(200).json(orgs);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Projects
export async function createProject(req: AuthenticatedRequest, res: Response) {
  try {
    const { organization_id, name, description } = req.body;
    const userId = req.user?.userId;

    if (!organization_id || !name) {
      return res.status(400).json({ error: 'organization_id and name are required' });
    }

    const db = await getDb();

    // Verify user owns this organization
    const org = await db.get('SELECT * FROM Organizations WHERE id = ? AND owner_id = ?', organization_id, userId);
    if (!org) {
      return res.status(403).json({ error: 'Access denied. You do not own this organization.' });
    }

    const projectId = uuidv4();
    await db.run(
      `INSERT INTO Projects (id, organization_id, name, description) VALUES (?, ?, ?, ?)`,
      projectId, organization_id, name, description || ''
    );

    return res.status(201).json({ id: projectId, organization_id, name, description });
  } catch (error) {
    console.error('Error creating project:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getProjects(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { organization_id } = req.query;

    if (!organization_id) {
      return res.status(400).json({ error: 'organization_id query parameter is required' });
    }

    const db = await getDb();

    // Verify user owns the organization
    const org = await db.get('SELECT * FROM Organizations WHERE id = ? AND owner_id = ?', organization_id, userId);
    if (!org) {
      return res.status(403).json({ error: 'Access denied. You do not own this organization.' });
    }

    const projects = await db.all('SELECT * FROM Projects WHERE organization_id = ?', organization_id);
    return res.status(200).json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteProject(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const db = await getDb();

    // Verify project belongs to an organization owned by the user
    const project = await db.get(
      `SELECT p.* FROM Projects p 
       JOIN Organizations o ON p.organization_id = o.id 
       WHERE p.id = ? AND o.owner_id = ?`,
      id, userId
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    await db.run('DELETE FROM Projects WHERE id = ?', id);

    return res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
