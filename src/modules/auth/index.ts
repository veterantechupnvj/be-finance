import { createRouter } from "../../factory";
import { changePasswordHandler, loginHandler, logoutHandler, meHandler } from "./auth.handlers";
import { changePasswordRoute, loginRoute, logoutRoute, meRoute } from "./auth.routes";

const router = createRouter();

router.openapi(loginRoute, loginHandler);
router.openapi(meRoute, meHandler);
router.openapi(changePasswordRoute, changePasswordHandler);
router.openapi(logoutRoute, logoutHandler);

export default router;
