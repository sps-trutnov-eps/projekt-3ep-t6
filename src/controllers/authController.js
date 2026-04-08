const { findByUsername, create } = require("../models/userModel");
const BCrypt = require("bcrypt");

exports.getLogin = (req, res) => {
    res.render('auth/login', {
        title: "Přihlásit se",
        message: "Přihlásit se"
    })
};

exports.getRegister = (req, res) => {
    res.render('auth/register', {
        title: "Zaregistrovat se",
        message: "Zaregistrovat se"
    })
};

exports.postLogin = async (req, res) => {
    const { username, password } = req.body;

    let errors = {};
    if (!username) errors.username = "Zadejte uživatelské jméno.";
    if (!password) errors.password = "Zadejte heslo.";
    if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

    const user = await findByUsername(username);
    if (!user) {
        errors.username = "Uživatel nebyl nalezen.";
        return res.status(400).json({ errors });
    }

    const valid = await BCrypt.compare(password, user.password);
    if (!valid) {
        errors.password = "Špatné heslo.";
        return res.status(400).json({ errors });
    }

    req.session.user = { id: user.id, username: user.username };
    res.json({ redirect: "/" });
};

exports.postRegister = async (req, res) => {
    const { username, password, passwordConfirm } = req.body;

    let errors = {};
    if (!username) errors.username = "Zadejte uživatelské jméno.";
    if (!password) errors.password = "Zadejte heslo.";
    if (password !== passwordConfirm) errors.passwordConfirm = "Hesla se neschodují.";

    if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

    const existingUser = await findByUsername(username);
    if (existingUser) {
        errors.username = "Uživatelské jméno je již zabrané.";
        return res.status(400).json({ errors });
    }

    const hash = await BCrypt.hash(password, 10);
    const newUser = await create({ username, password: hash });

    req.session.user = { id: newUser.id, username: newUser.username };

    res.json({ redirect: "/" });
};

// není ajax
exports.postLogout = (req, res) => {
    req.session.destroy();
    res.redirect("/auth/login");
}