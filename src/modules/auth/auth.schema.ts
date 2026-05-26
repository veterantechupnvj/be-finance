import { z } from "@hono/zod-openapi";
import { createSuccessSchema, dateTimeSchema } from "../../lib/openapi";

export const loginRequestSchema = z
  .object({
    nim: z.string().min(1),
    password: z.string().min(1),
  })
  .openapi("AuthLoginRequest");

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  })
  .openapi("AuthChangePasswordRequest");

export const authMemberSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    nim: z.string(),
    roles: z.array(z.string()),
  })
  .openapi("AuthMember");

export const authProfileSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    nim: z.string(),
    cohortYear: z.number().int(),
    memberType: z.string(),
    status: z.string(),
    roles: z.array(z.string()),
  })
  .openapi("AuthProfile");

export const loginResponseSchema = createSuccessSchema(
  z.object({
    token: z.string(),
    mustChangePassword: z.boolean(),
    member: authMemberSchema,
  }),
);

export const meResponseSchema = createSuccessSchema(authProfileSchema);

export const messageResponseSchema = createSuccessSchema(
  z.object({
    message: z.string(),
  }),
);

export const authTokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  memberId: z.string().uuid(),
  nim: z.string(),
  roles: z.array(z.string()),
  mustChangePassword: z.boolean(),
  exp: dateTimeSchema.or(z.number().int()),
});
