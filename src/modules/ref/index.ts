import { createRouter } from "../../factory";
import {
  getActiveStaffPeriodHandler,
  listDivisionsHandler,
  listStaffPeriodsHandler,
} from "./ref.handlers";
import { getActiveStaffPeriodRoute, listDivisionsRoute, listStaffPeriodsRoute } from "./ref.routes";

const router = createRouter();

router.openapi(listDivisionsRoute, listDivisionsHandler);
router.openapi(listStaffPeriodsRoute, listStaffPeriodsHandler);
router.openapi(getActiveStaffPeriodRoute, getActiveStaffPeriodHandler);

export default router;
