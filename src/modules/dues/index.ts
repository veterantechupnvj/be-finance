import { createRouter } from "../../factory";
import {
  exemptDuesHandler,
  getDuesConfigHandler,
  listDuesHandler,
  myDuesHandler,
  payDuesHandler,
  upsertDuesConfigHandler,
  verifyDuesHandler,
} from "./dues.handlers";
import {
  exemptDuesRoute,
  getDuesConfigRoute,
  listDuesRoute,
  myDuesRoute,
  payDuesRoute,
  upsertDuesConfigRoute,
  verifyDuesRoute,
} from "./dues.routes";

const router = createRouter();

router.openapi(listDuesRoute, listDuesHandler);
router.openapi(myDuesRoute, myDuesHandler);
router.openapi(payDuesRoute, payDuesHandler);
router.openapi(verifyDuesRoute, verifyDuesHandler);
router.openapi(exemptDuesRoute, exemptDuesHandler);
router.openapi(getDuesConfigRoute, getDuesConfigHandler);
router.openapi(upsertDuesConfigRoute, upsertDuesConfigHandler);

export default router;
