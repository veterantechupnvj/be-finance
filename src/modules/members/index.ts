import { createRouter } from "../../factory";
import { getMemberHandler, listMembersHandler } from "./members.handlers";
import { getMemberRoute, listMembersRoute } from "./members.routes";

const router = createRouter();

router.openapi(listMembersRoute, listMembersHandler);
router.openapi(getMemberRoute, getMemberHandler);

export default router;
