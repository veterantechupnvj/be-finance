import { createRouter } from "../../factory";
import {
  cashflowSummaryHandler,
  createCashflowHandler,
  deleteCashflowHandler,
  listCashflowHandler,
  updateCashflowHandler,
} from "./cashflow.handlers";
import {
  cashflowSummaryRoute,
  createCashflowRoute,
  deleteCashflowRoute,
  listCashflowRoute,
  updateCashflowRoute,
} from "./cashflow.routes";

const router = createRouter();

router.openapi(listCashflowRoute, listCashflowHandler);
router.openapi(cashflowSummaryRoute, cashflowSummaryHandler);
router.openapi(createCashflowRoute, createCashflowHandler);
router.openapi(updateCashflowRoute, updateCashflowHandler);
router.openapi(deleteCashflowRoute, deleteCashflowHandler);

export default router;
