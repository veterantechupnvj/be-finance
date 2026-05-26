import { createRouter } from "../../factory";
import {
  createProgramHandler,
  getProgramHandler,
  listProgramsHandler,
  updateProgramHandler,
} from "./programs.handlers";
import {
  createProgramRoute,
  getProgramRoute,
  listProgramsRoute,
  updateProgramRoute,
} from "./programs.routes";

const router = createRouter();

router.openapi(listProgramsRoute, listProgramsHandler);
router.openapi(getProgramRoute, getProgramHandler);
router.openapi(createProgramRoute, createProgramHandler);
router.openapi(updateProgramRoute, updateProgramHandler);

export default router;
