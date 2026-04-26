import { z } from 'zod';

const databaseNameSchema = z.string().trim().min(1);

const allowedColumnsSchema = z.record(z.string(), z.array(z.string())).optional();

const allowedColumnsByViewSchema = z.record(z.string(), z.array(z.string())).optional();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(16),
});

export const dataQuerySchema = z.object({
  database: databaseNameSchema,
  view: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(500).default(50),
  search: z.string().optional(),
  dsn: z.string().optional(),
  marka: z.string().optional(),
  product: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const exportQuerySchema = z.object({
  database: databaseNameSchema,
  view: z.string().min(1),
  format: z.enum(['pdf', 'excel', 'png']).default('excel'),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'manager', 'user']).default('user'),
  databases: z.array(databaseNameSchema).default([]),
  views: z.array(z.string()).default([]),
  permissions: z.object({
    read: z.boolean().optional(),
    write: z.boolean().optional(),
    export: z.boolean().optional(),
    dashboard: z.boolean().optional(),
    viewOnly: z.boolean().optional(),
  }).optional(),
  quota: z.object({
    dailyWriteLimit: z.coerce.number().int().min(0).optional(),
    monthlyWriteLimit: z.coerce.number().int().min(0).optional(),
    totalWriteLimit: z.coerce.number().int().min(0).optional(),
    testWriteLimit: z.coerce.number().int().min(0).optional(),
    liveWriteLimit: z.coerce.number().int().min(0).optional(),
  }).optional(),
  allowedColumns: allowedColumnsSchema,
  allowedColumnsByView: allowedColumnsByViewSchema,
});

export const assignViewSchema = z.object({
  email: z.string().email(),
  databases: z.array(databaseNameSchema).optional(),
  views: z.array(z.string()).optional(),
  role: z.enum(['admin', 'manager', 'user']).optional(),
  permissions: z.object({
    read: z.boolean().optional(),
    write: z.boolean().optional(),
    export: z.boolean().optional(),
    dashboard: z.boolean().optional(),
    viewOnly: z.boolean().optional(),
  }).optional(),
  quota: z.object({
    dailyWriteLimit: z.coerce.number().int().min(0).optional(),
    monthlyWriteLimit: z.coerce.number().int().min(0).optional(),
    totalWriteLimit: z.coerce.number().int().min(0).optional(),
    testWriteLimit: z.coerce.number().int().min(0).optional(),
    liveWriteLimit: z.coerce.number().int().min(0).optional(),
  }).optional(),
  allowedColumns: allowedColumnsSchema,
  allowedColumnsByView: allowedColumnsByViewSchema,
});

export const updateUserSchema = z.object({
  role: z.enum(['admin', 'manager', 'user']).optional(),
  databases: z.array(databaseNameSchema).optional(),
  views: z.array(z.string()).optional(),
  permissions: z.object({
    read: z.boolean().optional(),
    write: z.boolean().optional(),
    export: z.boolean().optional(),
    dashboard: z.boolean().optional(),
    viewOnly: z.boolean().optional(),
  }).optional(),
  quota: z.object({
    dailyWriteLimit: z.coerce.number().int().min(0).optional(),
    monthlyWriteLimit: z.coerce.number().int().min(0).optional(),
    totalWriteLimit: z.coerce.number().int().min(0).optional(),
    testWriteLimit: z.coerce.number().int().min(0).optional(),
    liveWriteLimit: z.coerce.number().int().min(0).optional(),
  }).optional(),
  allowedColumns: allowedColumnsSchema,
  allowedColumnsByView: allowedColumnsByViewSchema,
});

export const dashboardQuerySchema = z.object({
  database: databaseNameSchema,
  view: z.string().min(1),
  sheet_key: z.string().optional(),
});

export const saveEntryQuerySchema = z.object({
  database: databaseNameSchema.optional(),
  view: z.string().optional(),
  sheet_key: z.string().optional(),
  dryRun: z.coerce.boolean().optional(),
  writeType: z.enum(['test', 'live']).optional(),
});

export const saveEntryBodySchema = z.object({
  PROCESS_DATE: z.string().min(1).optional(),
  PRODUCT_NAME: z.string().min(1).optional(),
  REMARKS: z.string().optional(),
  STAGE: z.string().optional(),
  ENTRY_ID: z.string().optional(),
}).passthrough();

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(6),
});

export const userStatusSchema = z.object({
  email: z.string().email(),
  enabled: z.boolean(),
});

export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

export const dailyAuditReportQuerySchema = z.object({
  day: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(90).default(7),
});

export const verifyViewAlignmentQuerySchema = z.object({
  database: databaseNameSchema,
  view: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(200),
});

export const gasViewsQuerySchema = z.object({
  database: databaseNameSchema,
});

export const adminColumnsQuerySchema = z.object({
  database: databaseNameSchema,
  view: z.string().min(1),
});

export const createDatabaseSchema = z.object({
  name: databaseNameSchema,
  displayName: z.string().optional(),
  sheetIdOrUrl: z.string().min(1),
  sheetName: z.string().min(1),
  dataRange: z.string().min(1),
  primaryKey: z.string().optional(),
  active: z.boolean().optional(),
  bridgeUrl: z.string().url(),
  apiToken: z.string().min(1),
});

export const updateDatabaseSchema = z.object({
  name: databaseNameSchema.optional(),
  displayName: z.string().optional(),
  sheetIdOrUrl: z.string().min(1).optional(),
  sheetName: z.string().min(1).optional(),
  dataRange: z.string().min(1).optional(),
  primaryKey: z.string().optional(),
  active: z.boolean().optional(),
  bridgeUrl: z.string().url().optional(),
  apiToken: z.string().min(1).optional(),
});

export const detectColumnsQuerySchema = z.object({
  name: databaseNameSchema,
});

const filterRuleSchema = z.object({
  column: z.string().min(1),
  operator: z.enum(['=', 'contains', '>', '<']).default('='),
  value: z.string().min(1),
});

export const createViewDefinitionSchema = z.object({
  viewName: z.string().min(1),
  database: databaseNameSchema,
  selectedColumns: z.array(z.string().min(1)).min(1),
  filterRules: z.array(filterRuleSchema).optional(),
  sort: z.object({
    column: z.string().optional(),
    direction: z.enum(['asc', 'desc']).optional(),
  }).optional(),
  active: z.boolean().optional(),
});

export const updateViewDefinitionSchema = z.object({
  viewName: z.string().min(1).optional(),
  selectedColumns: z.array(z.string().min(1)).min(1).optional(),
  filterRules: z.array(filterRuleSchema).optional(),
  sort: z.object({
    column: z.string().optional(),
    direction: z.enum(['asc', 'desc']).optional(),
  }).optional(),
  active: z.boolean().optional(),
});
