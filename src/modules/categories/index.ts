import { createRouter } from "../../factory";
import {
  createCategoryHandler,
  listCategoriesHandler,
  updateCategoryHandler,
} from "./categories.handlers";
import { createCategoryRoute, listCategoriesRoute, updateCategoryRoute } from "./categories.routes";

const router = createRouter();

router.openapi(listCategoriesRoute, listCategoriesHandler);
router.openapi(createCategoryRoute, createCategoryHandler);
router.openapi(updateCategoryRoute, updateCategoryHandler);

export default router;
