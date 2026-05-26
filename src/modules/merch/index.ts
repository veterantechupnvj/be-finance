import { createRouter } from "../../factory";
import {
  createMerchProductHandler,
  createMerchSaleHandler,
  deleteMerchProductHandler,
  getMerchProductHandler,
  listMerchProductsHandler,
  listMerchSalesHandler,
  merchSummaryHandler,
  updateMerchProductHandler,
} from "./merch.handlers";
import {
  createMerchProductRoute,
  createMerchSaleRoute,
  deleteMerchProductRoute,
  getMerchProductRoute,
  listMerchProductsRoute,
  listMerchSalesRoute,
  merchSummaryRoute,
  updateMerchProductRoute,
} from "./merch.routes";

const router = createRouter();

router.openapi(listMerchProductsRoute, listMerchProductsHandler);
router.openapi(getMerchProductRoute, getMerchProductHandler);
router.openapi(createMerchProductRoute, createMerchProductHandler);
router.openapi(updateMerchProductRoute, updateMerchProductHandler);
router.openapi(deleteMerchProductRoute, deleteMerchProductHandler);
router.openapi(listMerchSalesRoute, listMerchSalesHandler);
router.openapi(createMerchSaleRoute, createMerchSaleHandler);
router.openapi(merchSummaryRoute, merchSummaryHandler);

export default router;
