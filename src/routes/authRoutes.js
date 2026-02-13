const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const middleware = require("../middleware/auth");

router.get("/login", authController.getLogin);
router.get("/register", authController.getRegister);

router.post("/login", authController.postLogin);
router.post("/register", authController.postRegister);

router.post("/logout", middleware.requireAuth, authController.postLogout);

module.exports = router;