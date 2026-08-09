import * as z from 'zod/v4';
import { DOCS } from '../longhorn/docs.js';
import { defineTool, destructive, jsonResult, textResult, withDocs, type ToolDef } from './tool-def.js';

const extraField = z
  .record(z.string(), z.unknown())
  .optional()
  .describe('Additional Longhorn fields, merged verbatim into the request body.');

export const tools: ToolDef[] = [
  defineTool(
    'backingimage_list',
    false,
    { title: 'List backing images', description: withDocs('List Longhorn backing images.', DOCS.backingImage), inputSchema: z.object({}) },
    async (_args, client) => jsonResult(await client.list('backingimages')),
  ),
  defineTool(
    'backingimage_get',
    false,
    {
      title: 'Get backing image',
      description: withDocs('Get a single backing image by name.', DOCS.backingImage),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.get('backingimages', name)),
  ),
  defineTool(
    'backingimage_create',
    true,
    {
      title: 'Create backing image',
      description: withDocs(
        destructive(
          'Create a new backing image. With sourceType "download", Longhorn fetches `parameters.url` server-side from its own network position — only use with a URL the user has explicitly provided and trusts.',
        ),
        DOCS.backingImage,
      ),
      inputSchema: z.object({
        name: z.string(),
        sourceType: z.string().describe('e.g. "download", "upload", "export-from-volume", "restore", "clone".'),
        parameters: z.record(z.string(), z.string()).describe('Source-type-specific parameters (e.g. { url } for "download").'),
        extra: extraField,
      }),
    },
    async ({ extra, ...body }, client) => jsonResult(await client.create('backingimages', { ...extra, ...body })),
  ),
  defineTool(
    'backingimage_delete',
    true,
    {
      title: 'Delete backing image',
      description: withDocs(destructive('Delete a backing image.'), DOCS.backingImage),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => textResult(JSON.stringify(await client.delete('backingimages', name))),
  ),
  defineTool(
    'backingimage_cleanup',
    true,
    {
      title: 'Clean up backing image copies',
      description: withDocs(destructive('Clean up backing image file copies on the given disks.'), DOCS.backingImage),
      inputSchema: z.object({ name: z.string(), disks: z.array(z.string()) }),
    },
    async ({ name, disks }, client) => jsonResult(await client.action('backingimages', name, 'backingImageCleanup', { disks })),
  ),
  defineTool(
    'backingimage_update_min_copies',
    true,
    {
      title: 'Update backing image min copies',
      description: withDocs('Update the minimum number of ready copies required for a backing image.', DOCS.backingImage),
      inputSchema: z.object({ name: z.string(), minNumberOfCopies: z.number().int().min(1) }),
    },
    async ({ name, minNumberOfCopies }, client) =>
      jsonResult(await client.action('backingimages', name, 'updateMinNumberOfCopies', { minNumberOfCopies })),
  ),
  defineTool(
    'backingimage_upload',
    true,
    {
      title: 'Upload backing image',
      description: withDocs(
        "Trigger backing image upload. Longhorn does not publish a dedicated input schema for this action in /v1/schemas — use longhorn_describe_resource_type('backingImage') to check the deployed version's exact body shape, or pass fields via extra.",
        DOCS.backingImage,
      ),
      inputSchema: z.object({ name: z.string(), extra: extraField }),
    },
    async ({ name, extra }, client) => jsonResult(await client.action('backingimages', name, 'upload', extra)),
  ),
  defineTool(
    'backingimage_backup_create',
    true,
    {
      title: 'Back up a backing image',
      description: withDocs(
        "Create a backup of a backing image. Longhorn does not publish a dedicated input schema for this action in /v1/schemas — use longhorn_describe_resource_type('backingImage') to check the deployed version's exact body shape, or pass fields via extra.",
        DOCS.backingImage,
      ),
      inputSchema: z.object({ name: z.string(), extra: extraField }),
    },
    async ({ name, extra }, client) => jsonResult(await client.action('backingimages', name, 'backupBackingImageCreate', extra)),
  ),

  defineTool(
    'backupbackingimage_list',
    false,
    {
      title: 'List backup backing images',
      description: withDocs('List backed-up backing images on the backup target.', DOCS.backingImage),
      inputSchema: z.object({}),
    },
    async (_args, client) => jsonResult(await client.list('backupbackingimages')),
  ),
  defineTool(
    'backupbackingimage_get',
    false,
    {
      title: 'Get backup backing image',
      description: withDocs('Get a single backup backing image by name.', DOCS.backingImage),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.get('backupbackingimages', name)),
  ),
  defineTool(
    'backupbackingimage_delete',
    true,
    {
      title: 'Delete backup backing image',
      description: withDocs(destructive('Delete a backup backing image from the backup target.'), DOCS.backingImage),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => textResult(JSON.stringify(await client.delete('backupbackingimages', name))),
  ),
  defineTool(
    'backupbackingimage_restore',
    true,
    {
      title: 'Restore backup backing image',
      description: withDocs('Restore a backing image from the backup target.', DOCS.backingImage),
      inputSchema: z.object({
        name: z.string(),
        dataEngine: z.string().optional(),
        secret: z.string().optional(),
        secretNamespace: z.string().optional(),
      }),
    },
    async ({ name, ...body }, client) => jsonResult(await client.action('backupbackingimages', name, 'backupBackingImageRestore', body)),
  ),
];
