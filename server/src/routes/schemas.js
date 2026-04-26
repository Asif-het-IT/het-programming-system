import { z } from 'zod';

const allowedColumnsSchema = z.object({
  MEN_MATERIAL: z.array(z.string()).optional(),
  LACE_GAYLE: z.array(z.string()).optional(),
}).optional();

const allowedColumnsByViewSchema = z.record(z.string(), z.array(z.string())).optional();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(16),
});

export const dataQuerySchema = z.object({
  database: z.enum(['MEN_MATERIAL', 'LACE_GAYLE']),
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
  database: z.enum(['MEN_MATERIAL', 'LACE_GAYLE']),
  view: z.string().min(1),
  format: z.enum(['pdf', 'excel', 'png']).default('excel'),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'manager', 'user']).default('user'),
  databases: z.array(z.enum(['MEN_MATERIAL', 'LACE_GAYLE'])).default([]),
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
  databases: z.array(z.enum(['MEN_MATERIAL', 'LACE_GAYLE'])).optional(),
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
  databases: z.array(z.enum(['MEN_MATERIAL', 'LACE_GAYLE'])).optional(),
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
  database: z.enum(['MEN_MATERIAL', 'LACE_GAYLE']),
  view: z.string().min(1),
  sheet_key: z.string().optional(),
});

export const saveEntryQuerySchema = z.object({
  database: z.enum(['MEN_MATERIAL', 'LACE_GAYLE']).optional(),
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
  database: z.enum(['MEN_MATERIAL', 'LACE_GAYLE']),
  view: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(200),
});

export const gasViewsQuerySchema = z.object({
  database: z.enum(['MEN_MATERIAL', 'LACE_GAYLE']),
});

export const adminColumnsQuerySchema = z.object({
  database: z.enum(['MEN_MATERIAL', 'LACE_GAYLE']),
  view: z.string().min(1),
});
