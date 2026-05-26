import { z } from "@hono/zod-openapi";
import {
  createPaginatedSchema,
  createSuccessSchema,
  idParamSchema,
  listQuerySchema,
  uuidSchema,
} from "../../lib/openapi";

export const membersListQuerySchema = listQuerySchema
  .extend({
    search: z.string().optional(),
    status: z.enum(["active", "inactive"]).optional(),
    member_type: z.enum(["member", "staff", "alumni"]).optional(),
    cohort_year: z.coerce.number().int().optional(),
  })
  .openapi("MembersListQuery");

export const memberPathSchema = idParamSchema.openapi("MemberPathParams");

export const memberListItemSchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
    nim: z.string(),
    cohort_year: z.number().int(),
    member_type: z.string(),
    status: z.string(),
  })
  .openapi("MemberListItem");

export const memberDetailSchema = memberListItemSchema
  .extend({
    role: z.string(),
    roles: z.array(z.string()),
    division: z.string().nullable(),
    position: z.string().nullable(),
  })
  .openapi("MemberDetail");

export const membersListResponseSchema = createPaginatedSchema(memberListItemSchema);
export const memberDetailResponseSchema = createSuccessSchema(memberDetailSchema);
