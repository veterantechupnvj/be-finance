import { createRouter } from "../../factory";
import {
  approveReimbursementHandler,
  cancelReimbursementHandler,
  createReimbursementHandler,
  getReimbursementHandler,
  listReimbursementsHandler,
  markReimbursementPaidHandler,
  myReimbursementsHandler,
  rejectReimbursementHandler,
} from "./reimbursements.handlers";
import {
  approveReimbursementRoute,
  cancelReimbursementRoute,
  createReimbursementRoute,
  getReimbursementRoute,
  listReimbursementsRoute,
  markReimbursementPaidRoute,
  myReimbursementsRoute,
  rejectReimbursementRoute,
} from "./reimbursements.routes";

const router = createRouter();

router.openapi(listReimbursementsRoute, listReimbursementsHandler);
router.openapi(myReimbursementsRoute, myReimbursementsHandler);
router.openapi(getReimbursementRoute, getReimbursementHandler);
router.openapi(createReimbursementRoute, createReimbursementHandler);
router.openapi(approveReimbursementRoute, approveReimbursementHandler);
router.openapi(rejectReimbursementRoute, rejectReimbursementHandler);
router.openapi(markReimbursementPaidRoute, markReimbursementPaidHandler);
router.openapi(cancelReimbursementRoute, cancelReimbursementHandler);

export default router;
