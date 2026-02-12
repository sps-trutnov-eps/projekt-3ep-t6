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

exports.postLogin = (req, res) => {
    const { username, password } = req.body;

    let errors = {};

    if (!password) { errors.password = "Zadejte heslo." }
    if (!username) { errors.username = "Zadejte uživatelské jméno." }

    if (Object.keys(errors).length > 0)
        return res.status(400).json({ errors });

    const user = findByUsername(username)

    if (!user) {
        errors.username = "Uživatel nebyl nalezen.";
        return res.status(400).json({ errors });
    }

    if (!BCrypt.compare(password, user.password)) {
        errors.password = "Špatné heslo.";
        return res.status(400).json({ errors });
    }

    req.session.id = user.id;
    req.session.username = user.username;

    res.json({ redirect: "/"});
};

exports.postRegister = (req, res) => {
    const { username, password, passwordConfirm } = req.body;

    let errors = {};

    if (!password) { errors.password = "Zadejte heslo." }
    if (!username) { errors.username = "Zadejte uživatelské jméno." }

    if (password != passwordConfirm) {
        errors.passwordConfirm = "Hesla se neschodují."
    }

    if (Object.keys(errors).length > 0)
        return res.status(400).json({ errors });

    if (findByUsername(username)) {
        errors.username = "Uživatelské jméno je již zabrané.";
        return res.status(400).json({ errors });
    }

    const hash = BCrypt.hash(password);
    const newUser = create(username, hash);

    req.session.id = newUser.id;
    req.session.username = newUser.username;

    res.json({ redirect: "/"});
};