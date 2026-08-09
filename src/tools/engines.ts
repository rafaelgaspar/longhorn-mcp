import * as z from 'zod/v4';
import { DOCS } from '../longhorn/docs.js';
import { defineTool, destructive, jsonResult, textResult, withDocs, type ToolDef } from './tool-def.js';

export const tools: ToolDef[] = [
  defineTool(
    'engineimage_list',
    false,
    { title: 'List engine images', description: withDocs('List Longhorn engine images.', DOCS.upgrade), inputSchema: z.object({}) },
    async (_args, client) => jsonResult(await client.list('engineimages')),
  ),
  defineTool(
    'engineimage_get',
    false,
    { title: 'Get engine image', description: withDocs('Get a single engine image by name.', DOCS.upgrade), inputSchema: z.object({ name: z.string() }) },
    async ({ name }, client) => jsonResult(await client.get('engineimages', name)),
  ),
  defineTool(
    'engineimage_create',
    true,
    {
      title: 'Deploy engine image',
      description: withDocs(
        destructive('Deploy a new Longhorn engine image. `image` is not validated against a known-good list.'),
        DOCS.upgrade,
      ),
      inputSchema: z.object({ image: z.string() }),
    },
    async ({ image }, client) => jsonResult(await client.create('engineimages', { image })),
  ),
  defineTool(
    'engineimage_delete',
    true,
    {
      title: 'Delete engine image',
      description: withDocs(destructive('Delete a Longhorn engine image.'), DOCS.upgrade),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => {
      await client.delete('engineimages', name);
      return textResult(`Deleted engine image "${name}".`);
    },
  ),

  defineTool(
    'instancemanager_list',
    false,
    { title: 'List instance managers', description: 'List Longhorn instance manager pods/records.', inputSchema: z.object({}) },
    async (_args, client) => jsonResult(await client.list('instancemanagers')),
  ),
  defineTool(
    'instancemanager_get',
    false,
    { title: 'Get instance manager', description: 'Get a single instance manager by name.', inputSchema: z.object({ name: z.string() }) },
    async ({ name }, client) => jsonResult(await client.get('instancemanagers', name)),
  ),
];
